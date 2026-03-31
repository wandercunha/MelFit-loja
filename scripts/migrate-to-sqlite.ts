/**
 * Migra dados existentes (products.ts, price-history.json, scraped-prices.json) para SQLite
 * Roda via: npx tsx scripts/migrate-to-sqlite.ts
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(__dirname, "..", "src", "data");
const DB_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DB_DIR, "melfit.db");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("=== Migrating data to SQLite ===\n");

// Create schema
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    cost REAL NOT NULL,
    category TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    sizes TEXT NOT NULL DEFAULT 'P, M, G',
    img TEXT NOT NULL DEFAULT '',
    slug TEXT,
    sold_out INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    slug TEXT,
    field TEXT NOT NULL DEFAULT 'price',
    old_value REAL,
    new_value REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS price_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_count INTEGER NOT NULL,
    avg_price REAL NOT NULL,
    min_price REAL NOT NULL,
    max_price REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scraped_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    price REAL NOT NULL DEFAULT 0,
    img TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'floraamar.com.br',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    size TEXT,
    unit_cost REAL NOT NULL,
    unit_price REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'pix',
    installments INTEGER DEFAULT 1,
    customer_name TEXT,
    customer_phone TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    sold_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_name);
  CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(created_at);
  CREATE INDEX IF NOT EXISTS idx_price_snapshots_date ON price_snapshots(created_at);
  CREATE INDEX IF NOT EXISTS idx_scraped_prices_slug ON scraped_prices(slug);
  CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id);
  CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sold_at);
  CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
`);

console.log("Schema created.\n");

// 1. Import products from products.ts
console.log("1. Importing products...");
const productsFile = path.join(DATA_DIR, "products.ts");
const productsContent = fs.readFileSync(productsFile, "utf-8");

// Parse products array from the TS file
const productRegex = /\{\s*id:\s*(\d+),\s*name:\s*"([^"]+)",\s*cost:\s*(\d+(?:\.\d+)?),\s*category:\s*"([^"]+)",\s*tags:\s*\[([^\]]*)\],\s*sizes:\s*"([^"]+)",\s*img:\s*"([^"]*)"(?:,\s*slug:\s*"([^"]*)")?(?:,\s*soldOut:\s*(true|false))?\s*\}/g;

const insertProduct = db.prepare(`
  INSERT OR REPLACE INTO products (id, name, cost, category, tags, sizes, img, slug, sold_out)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let productCount = 0;
let match;
while ((match = productRegex.exec(productsContent)) !== null) {
  const [, id, name, cost, category, tagsStr, sizes, img, slug, soldOut] = match;
  const tags = tagsStr
    .split(",")
    .map((t) => t.trim().replace(/"/g, ""))
    .filter(Boolean);

  insertProduct.run(
    parseInt(id), name, parseFloat(cost), category,
    JSON.stringify(tags), sizes, img, slug || null,
    soldOut === "true" ? 1 : 0
  );
  productCount++;
}
console.log(`   ${productCount} products imported.\n`);

// 2. Import scraped prices
console.log("2. Importing scraped prices...");
const scrapedFile = path.join(DATA_DIR, "scraped-prices.json");
if (fs.existsSync(scrapedFile)) {
  const scraped = JSON.parse(fs.readFileSync(scrapedFile, "utf-8"));
  const insertScraped = db.prepare(`
    INSERT OR REPLACE INTO scraped_prices (product_name, slug, price, img, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  let scrapedCount = 0;
  for (const p of scraped.products) {
    insertScraped.run(p.name, p.slug, p.price || 0, p.img || "", scraped.timestamp);
    scrapedCount++;
  }
  console.log(`   ${scrapedCount} scraped prices imported.\n`);
} else {
  console.log("   No scraped-prices.json found, skipping.\n");
}

// 3. Import price history
console.log("3. Importing price history...");
const historyFile = path.join(DATA_DIR, "price-history.json");
if (fs.existsSync(historyFile)) {
  const history = JSON.parse(fs.readFileSync(historyFile, "utf-8"));

  const insertChange = db.prepare(`
    INSERT INTO price_history (product_name, slug, field, old_value, new_value, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let changeCount = 0;
  for (const c of history.changes || []) {
    insertChange.run(c.product, c.slug || "", c.field || "price", c.oldValue, c.newValue, c.date);
    changeCount++;
  }
  console.log(`   ${changeCount} price changes imported.`);

  const insertSnapshot = db.prepare(`
    INSERT INTO price_snapshots (product_count, avg_price, min_price, max_price, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  let snapshotCount = 0;
  for (const s of history.snapshots || []) {
    insertSnapshot.run(s.productCount, s.avgPrice, s.minPrice, s.maxPrice, s.date);
    snapshotCount++;
  }
  console.log(`   ${snapshotCount} snapshots imported.\n`);
} else {
  console.log("   No price-history.json found, skipping.\n");
}

// Verify
const counts = {
  products: (db.prepare("SELECT COUNT(*) as c FROM products").get() as any).c,
  scraped: (db.prepare("SELECT COUNT(*) as c FROM scraped_prices").get() as any).c,
  changes: (db.prepare("SELECT COUNT(*) as c FROM price_history").get() as any).c,
  snapshots: (db.prepare("SELECT COUNT(*) as c FROM price_snapshots").get() as any).c,
};

console.log("=== Migration complete ===");
console.log(`Database: ${DB_PATH}`);
console.log(`Products: ${counts.products}`);
console.log(`Scraped prices: ${counts.scraped}`);
console.log(`Price changes: ${counts.changes}`);
console.log(`Snapshots: ${counts.snapshots}`);
console.log(`Sales: 0 (ready for use)`);

db.close();
