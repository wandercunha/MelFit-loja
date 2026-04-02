import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;

/**
 * Retorna o client do banco.
 * - Em produção (Vercel): conecta ao Turso via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 * - Local: usa arquivo SQLite em data/melfit.db
 */
export function getDb(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (url && authToken) {
      // Produção: Turso cloud
      _client = createClient({ url, authToken });
    } else {
      // Local: arquivo SQLite
      _client = createClient({ url: "file:data/melfit.db" });
    }
  }
  return _client;
}

/** Roda o schema de criação (idempotente) */
export async function initSchema() {
  const db = getDb();
  await db.executeMultiple(`
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

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      payment_method TEXT NOT NULL DEFAULT 'pix',
      installments INTEGER DEFAULT 1,
      total_price REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations: add columns if they don't exist yet
  const migrations = [
    "ALTER TABLE sales ADD COLUMN order_id TEXT",
    "ALTER TABLE sales ADD COLUMN product_name TEXT",
  ];
  for (const sql of migrations) {
    try { await db.execute(sql); } catch { /* column already exists */ }
  }
}

// ─── Scraped prices ───

export async function upsertScrapedPrice(p: {
  name: string;
  slug: string;
  price: number;
  img: string;
}) {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO scraped_prices (product_name, slug, price, img, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(slug) DO UPDATE SET
            product_name = excluded.product_name,
            price = excluded.price,
            img = CASE WHEN excluded.img != '' THEN excluded.img ELSE scraped_prices.img END,
            updated_at = datetime('now')`,
    args: [p.name, p.slug, p.price, p.img],
  });
}

export async function getScrapedPriceMap(): Promise<Record<string, number>> {
  const db = getDb();
  const result = await db.execute("SELECT product_name, price FROM scraped_prices WHERE price > 0");
  const map: Record<string, number> = {};
  for (const row of result.rows) {
    map[row.product_name as string] = row.price as number;
  }
  return map;
}

// ─── Price history ───

export async function addPriceChange(change: {
  productName: string;
  slug: string;
  oldValue: number;
  newValue: number;
}) {
  const db = getDb();
  await db.execute({
    sql: "INSERT INTO price_history (product_name, slug, field, old_value, new_value) VALUES (?, ?, 'price', ?, ?)",
    args: [change.productName, change.slug, change.oldValue, change.newValue],
  });
}

export async function addPriceSnapshot(s: {
  productCount: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
}) {
  const db = getDb();
  await db.execute({
    sql: "INSERT INTO price_snapshots (product_count, avg_price, min_price, max_price) VALUES (?, ?, ?, ?)",
    args: [s.productCount, s.avgPrice, s.minPrice, s.maxPrice],
  });
}

export async function getPriceHistory(days: number = 30, product?: string) {
  const db = getDb();
  let sql = `SELECT * FROM price_history WHERE created_at >= datetime('now', '-${days} days')`;
  const args: any[] = [];

  if (product) {
    sql += " AND product_name LIKE ?";
    args.push(`%${product}%`);
  }
  sql += " ORDER BY created_at DESC LIMIT 500";
  const result = await db.execute({ sql, args });
  return result.rows;
}

export async function getPriceSnapshots(days: number = 30) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM price_snapshots WHERE created_at >= datetime('now', '-${days} days') ORDER BY created_at ASC`,
    args: [],
  });
  return result.rows;
}

// ─── Sales ───

export async function addSale(sale: {
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
  const result = await db.execute({
    sql: `INSERT INTO sales (product_id, quantity, size, unit_cost, unit_price,
            payment_method, installments, customer_name, customer_phone, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      sale.productId, sale.quantity, sale.size || null,
      sale.unitCost, sale.unitPrice, sale.paymentMethod,
      sale.installments || 1, sale.customerName || null,
      sale.customerPhone || null, sale.notes || null,
    ],
  });
  return result.lastInsertRowid;
}

export async function getSales(days: number = 30, status?: string) {
  const db = getDb();
  let sql = `
    SELECT s.*, p.name as product_name, p.category, p.img
    FROM sales s
    JOIN products p ON p.id = s.product_id
    WHERE s.sold_at >= datetime('now', '-${days} days')
  `;
  const args: any[] = [];
  if (status) {
    sql += " AND s.status = ?";
    args.push(status);
  }
  sql += " ORDER BY s.sold_at DESC";
  const result = await db.execute({ sql, args });
  return result.rows;
}

export async function updateSaleStatus(id: number, status: string) {
  const db = getDb();
  await db.execute({ sql: "UPDATE sales SET status = ? WHERE id = ?", args: [status, id] });
}

export async function getSalesSummary(days: number = 30) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT
            COUNT(*) as total_sales,
            COALESCE(SUM(quantity), 0) as total_items,
            COALESCE(SUM(unit_price * quantity), 0) as total_revenue,
            COALESCE(SUM(unit_cost * quantity), 0) as total_cost,
            COALESCE(SUM((unit_price - unit_cost) * quantity), 0) as total_profit
          FROM sales
          WHERE sold_at >= datetime('now', '-${days} days')
            AND status != 'cancelled'`,
    args: [],
  });
  return result.rows[0];
}

// ─── Orders ───

export async function createOrder(order: {
  id: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentMethod: string;
  installments: number;
  totalPrice: number;
}) {
  const db = getDb();
  await db.execute({
    sql: `INSERT OR IGNORE INTO orders
            (id, customer_name, customer_phone, customer_email, payment_method, installments, total_price)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      order.id,
      order.customerName || null,
      order.customerPhone || null,
      order.customerEmail || null,
      order.paymentMethod,
      order.installments,
      order.totalPrice,
    ],
  });
}

export async function addOrderItem(item: {
  orderId: string;
  productId: number;
  productName: string;
  quantity: number;
  size?: string;
  unitCost: number;
  unitPrice: number;
  paymentMethod: string;
  installments?: number;
  customerName?: string;
  customerPhone?: string;
}) {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO sales
            (order_id, product_id, product_name, quantity, size, unit_cost, unit_price,
             payment_method, installments, customer_name, customer_phone)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      item.orderId,
      item.productId,
      item.productName,
      item.quantity,
      item.size || null,
      item.unitCost,
      item.unitPrice,
      item.paymentMethod,
      item.installments || 1,
      item.customerName || null,
      item.customerPhone || null,
    ],
  });
}

export async function getOrders(days: number = 60, status?: string) {
  const db = getDb();
  let sql = `
    SELECT o.*,
           COALESCE(
             (SELECT SUM(s.quantity) FROM sales s WHERE s.order_id = o.id), 0
           ) as total_items,
           COALESCE(
             (SELECT json_group_array(json_object(
               'id', s.id,
               'product_id', s.product_id,
               'product_name', COALESCE(s.product_name, ''),
               'quantity', s.quantity,
               'size', COALESCE(s.size, ''),
               'unit_price', s.unit_price,
               'unit_cost', s.unit_cost
             )) FROM sales s WHERE s.order_id = o.id), '[]'
           ) as items_json
    FROM orders o
    WHERE o.created_at >= datetime('now', '-${days} days')
  `;
  const args: any[] = [];
  if (status) {
    sql += " AND o.status = ?";
    args.push(status);
  }
  sql += " ORDER BY o.created_at DESC";
  const result = await db.execute({ sql, args });
  return result.rows.map((row) => ({
    ...row,
    items: (() => {
      try { return JSON.parse(row.items_json as string); } catch { return []; }
    })(),
  }));
}

export async function getOrdersSummary(days: number = 30) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT
            COUNT(*) as total_orders,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
            COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN total_price ELSE 0 END), 0) as revenue_completed,
            COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_price ELSE 0 END), 0) as revenue_total
          FROM orders
          WHERE created_at >= datetime('now', '-${days} days')`,
    args: [],
  });
  return result.rows[0];
}

export async function updateOrderStatus(id: string, status: string) {
  const db = getDb();
  await db.execute({
    sql: "UPDATE orders SET status = ? WHERE id = ?",
    args: [status, id],
  });
}

// ─── Settings (chave/valor persistente) ───

export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const result = await db.execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [key] });
  return result.rows.length > 0 ? (result.rows[0].value as string) : null;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = getDb();
  const result = await db.execute("SELECT key, value FROM settings");
  const map: Record<string, string> = {};
  for (const row of result.rows) {
    map[row.key as string] = row.value as string;
  }
  return map;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    args: [key, value],
  });
}

export async function deleteSetting(key: string): Promise<void> {
  const db = getDb();
  await db.execute({ sql: "DELETE FROM settings WHERE key = ?", args: [key] });
}
