import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "melfit.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    -- Produtos do catálogo
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

    -- Histórico de preços raspados (varejo)
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_name TEXT NOT NULL,
      slug TEXT,
      field TEXT NOT NULL DEFAULT 'price',
      old_value REAL,
      new_value REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Snapshots diários de preços
    CREATE TABLE IF NOT EXISTS price_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_count INTEGER NOT NULL,
      avg_price REAL NOT NULL,
      min_price REAL NOT NULL,
      max_price REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Preços raspados (último scrape por produto)
    CREATE TABLE IF NOT EXISTS scraped_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      price REAL NOT NULL DEFAULT 0,
      img TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'floraamar.com.br',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Vendas (preparado para uso futuro)
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

    -- Configurações do admin (margem, taxas etc)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Índices
    CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_name);
    CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(created_at);
    CREATE INDEX IF NOT EXISTS idx_price_snapshots_date ON price_snapshots(created_at);
    CREATE INDEX IF NOT EXISTS idx_scraped_prices_slug ON scraped_prices(slug);
    CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sold_at);
    CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
  `);
}

// ─── Product helpers ───

export function upsertProduct(p: {
  id: number;
  name: string;
  cost: number;
  category: string;
  tags: string[];
  sizes: string;
  img: string;
  slug?: string;
  soldOut?: boolean;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO products (id, name, cost, category, tags, sizes, img, slug, sold_out, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      cost = excluded.cost,
      category = excluded.category,
      tags = excluded.tags,
      sizes = excluded.sizes,
      img = excluded.img,
      slug = excluded.slug,
      sold_out = excluded.sold_out,
      updated_at = datetime('now')
  `).run(
    p.id, p.name, p.cost, p.category,
    JSON.stringify(p.tags), p.sizes, p.img,
    p.slug || null, p.soldOut ? 1 : 0
  );
}

export function getAllProducts() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM products ORDER BY category, id").all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    cost: r.cost,
    category: r.category,
    tags: JSON.parse(r.tags || "[]"),
    sizes: r.sizes,
    img: r.img,
    slug: r.slug,
    soldOut: r.sold_out === 1,
  }));
}

// ─── Scraped prices helpers ───

export function upsertScrapedPrice(p: {
  name: string;
  slug: string;
  price: number;
  img: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO scraped_prices (product_name, slug, price, img, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      product_name = excluded.product_name,
      price = excluded.price,
      img = CASE WHEN excluded.img != '' THEN excluded.img ELSE scraped_prices.img END,
      updated_at = datetime('now')
  `).run(p.name, p.slug, p.price, p.img);
}

export function getScrapedPrice(slug: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM scraped_prices WHERE slug = ?").get(slug) as any;
}

export function getAllScrapedPrices() {
  const db = getDb();
  return db.prepare("SELECT * FROM scraped_prices ORDER BY product_name").all();
}

// ─── Price history helpers ───

export function addPriceChange(change: {
  productName: string;
  slug: string;
  field: string;
  oldValue: number;
  newValue: number;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO price_history (product_name, slug, field, old_value, new_value)
    VALUES (?, ?, ?, ?, ?)
  `).run(change.productName, change.slug, change.field, change.oldValue, change.newValue);
}

export function addPriceSnapshot(snapshot: {
  productCount: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO price_snapshots (product_count, avg_price, min_price, max_price)
    VALUES (?, ?, ?, ?)
  `).run(snapshot.productCount, snapshot.avgPrice, snapshot.minPrice, snapshot.maxPrice);
}

export function getPriceHistory(days: number = 30, product?: string) {
  const db = getDb();
  let query = `
    SELECT * FROM price_history
    WHERE created_at >= datetime('now', '-${days} days')
  `;
  const params: any[] = [];

  if (product) {
    query += " AND product_name LIKE ?";
    params.push(`%${product}%`);
  }

  query += " ORDER BY created_at DESC LIMIT 500";
  return db.prepare(query).all(...params);
}

export function getPriceSnapshots(days: number = 30) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM price_snapshots
    WHERE created_at >= datetime('now', '-${days} days')
    ORDER BY created_at ASC
  `).all();
}

// ─── Sales helpers ───

export function addSale(sale: {
  productId: number;
  quantity: number;
  size?: string;
  unitCost: number;
  unitPrice: number;
  paymentMethod: string;
  installments?: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
}) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO sales (product_id, quantity, size, unit_cost, unit_price,
      payment_method, installments, customer_name, customer_phone, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sale.productId, sale.quantity, sale.size || null,
    sale.unitCost, sale.unitPrice, sale.paymentMethod,
    sale.installments || 1, sale.customerName || null,
    sale.customerPhone || null, sale.notes || null
  );
  return result.lastInsertRowid;
}

export function getSales(days: number = 30, status?: string) {
  const db = getDb();
  let query = `
    SELECT s.*, p.name as product_name, p.category, p.img
    FROM sales s
    JOIN products p ON p.id = s.product_id
    WHERE s.sold_at >= datetime('now', '-${days} days')
  `;
  const params: any[] = [];

  if (status) {
    query += " AND s.status = ?";
    params.push(status);
  }

  query += " ORDER BY s.sold_at DESC";
  return db.prepare(query).all(...params);
}

export function updateSaleStatus(id: number, status: string) {
  const db = getDb();
  db.prepare("UPDATE sales SET status = ? WHERE id = ?").run(status, id);
}

export function getSalesSummary(days: number = 30) {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COUNT(*) as total_sales,
      SUM(quantity) as total_items,
      SUM(unit_price * quantity) as total_revenue,
      SUM(unit_cost * quantity) as total_cost,
      SUM((unit_price - unit_cost) * quantity) as total_profit
    FROM sales
    WHERE sold_at >= datetime('now', '-${days} days')
      AND status != 'cancelled'
  `).get() as any;
  return row;
}

// ─── Settings helpers ───

export function getSetting(key: string, defaultValue?: string): string | undefined {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
  return row?.value ?? defaultValue;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value);
}
