/**
 * Sincroniza dados scrapeados (atacado + varejo) para o Turso.
 * Roda automaticamente ao final dos scrapers, ou manualmente:
 *   npx tsx scripts/sync-to-turso.ts
 *
 * Lê os JSONs locais e salva no banco para que a Vercel tenha dados atualizados.
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

import { createClient } from "@libsql/client";

const DATA_DIR = path.join(__dirname, "..", "src", "data");

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("  [SYNC] TURSO_DATABASE_URL e TURSO_AUTH_TOKEN necessarios no .env.local");
    process.exit(1);
  }

  const db = createClient({ url, authToken });

  // Garantir que a tabela settings existe
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  console.log(`\n  [SYNC] Sincronizando dados para Turso...`);

  // 1. Atacado details (estoque + imagens)
  const atacadoPath = path.join(DATA_DIR, "atacado-details.json");
  if (fs.existsSync(atacadoPath)) {
    const atacadoData = fs.readFileSync(atacadoPath, "utf-8");
    const size = (Buffer.byteLength(atacadoData) / 1024).toFixed(1);
    await db.execute({
      sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      args: ["catalog_atacado_data", atacadoData],
    });
    console.log(`  [SYNC] atacado-details.json → Turso (${size}KB)`);
  } else {
    console.log("  [SYNC] atacado-details.json nao encontrado (skip)");
  }

  // 2. Varejo prices (mapa de precos)
  const mapsPath = path.join(DATA_DIR, "scrape-maps.json");
  if (fs.existsSync(mapsPath)) {
    const mapsData = JSON.parse(fs.readFileSync(mapsPath, "utf-8"));
    const priceMap = mapsData.priceMap || {};
    const priceJson = JSON.stringify(priceMap);
    const size = (Buffer.byteLength(priceJson) / 1024).toFixed(1);
    await db.execute({
      sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      args: ["catalog_varejo_prices", priceJson],
    });
    console.log(`  [SYNC] scrape-maps.json (priceMap) → Turso (${size}KB)`);
  } else {
    console.log("  [SYNC] scrape-maps.json nao encontrado (skip)");
  }

  // 3. Product info (specs técnicas do ATACADO — composição, tecnologia, etc)
  const infoPath = path.join(DATA_DIR, "product-info.json");
  if (fs.existsSync(infoPath)) {
    const infoData = fs.readFileSync(infoPath, "utf-8");
    const size = (Buffer.byteLength(infoData) / 1024).toFixed(1);
    await db.execute({
      sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      args: ["catalog_product_info", infoData],
    });
    console.log(`  [SYNC] product-info.json (ATACADO specs) → Turso (${size}KB)`);
  }

  // NOTA: product-details.json (VAREJO) NÃO é sincronizado.
  // Do varejo capturamos SOMENTE PREÇO. Estoque e imagens vêm do ATACADO.

  console.log(`  [SYNC] Concluido!\n`);
}

main().catch(console.error);
