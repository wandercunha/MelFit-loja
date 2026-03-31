/**
 * Script para scrape de preços e imagens da Flora Amar (varejo → atacado)
 * Usa o site de varejo (floraamar.com.br) pois o atacado tem proteção CloudFront
 * Os produtos são os mesmos, apenas os preços diferem.
 *
 * Roda via: npx tsx scripts/scrape-prices.ts
 * Cron: 0 6 * * * cd /root/projetos/MelFit-loja && npx tsx scripts/scrape-prices.ts >> /tmp/melfit-scrape.log 2>&1
 */

import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

const BASE_URL = "https://www.floraamar.com.br";

// Páginas de categoria no site de varejo
const CATEGORY_PAGES = [
  { url: "/colecoes/", label: "Todas Coleções" },
  { url: "/exclusiva/", label: "Exclusiva" },
  { url: "/colecoes/move-collection/", label: "Move Collection" },
  { url: "/colecoes/vibe-collection/", label: "Vibe Collection" },
];

interface ScrapedProduct {
  name: string;
  price: number;
  slug: string;
  img: string;
}

function fetchHTML(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith("http")
            ? res.headers.location
            : `${BASE_URL}${res.headers.location}`;
          fetchHTML(redirectUrl).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`Timeout for ${url}`));
    });
  });
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseProductsFromHTML(html: string): ScrapedProduct[] {
  const $ = cheerio.load(html);
  const products: ScrapedProduct[] = [];

  $(".item.compra_rapida").each((_, el) => {
    const $el = $(el);

    // Get name and slug from the h3.produto link
    const h3 = $el.find("h3.produto");
    const name = h3.attr("title") || "";
    const slug = $el.find("a").first().attr("href")?.replace(/\//g, "") || "";

    // Get image from data-src (lazy loaded)
    let img = "";
    const imgEl = $el.find("img[data-src]").first();
    const dataSrc = imgEl.attr("data-src") || "";
    if (dataSrc.includes("cdn.sistemawbuy.com.br") && dataSrc.includes("/produtos/")) {
      // Replace _mini with larger version
      img = dataSrc.replace("_mini.", ".");
    }

    // Try to extract price from data-comprarapida (base64 JSON)
    let price = 0;
    const compraRapida = h3.attr("data-comprarapida") || "";
    if (compraRapida) {
      try {
        const decoded = JSON.parse(Buffer.from(compraRapida, "base64").toString("utf-8"));
        if (decoded.variacoes && decoded.variacoes.length > 0) {
          const preco = decoded.variacoes[0].preco;
          price = parseFloat(preco.valor_venda || preco.valor_de || "0");
        }
      } catch {}
    }

    if (name && slug) {
      products.push({ name, price, slug, img });
    }
  });

  return products;
}

async function scrapeProductPage(slug: string): Promise<{ img: string; price: number }> {
  try {
    const html = await fetchHTML(`${BASE_URL}/${slug}/`);
    const $ = cheerio.load(html);

    let img = "";
    // Try og:image first
    const ogImg = $('meta[property="og:image"]').attr("content") || "";
    if (ogImg.includes("cdn.sistemawbuy.com.br")) {
      img = ogImg;
    }
    // Fallback to product images
    if (!img) {
      $("img[data-src], img[src]").each((_, el) => {
        const src = $(el).attr("data-src") || $(el).attr("src") || "";
        if (src.includes("cdn.sistemawbuy.com.br") && src.includes("/produtos/") && !img) {
          img = src.replace("_mini.", ".");
        }
      });
    }

    // Extract price from compra_rapida data
    let price = 0;
    const h3 = $("h3.produto, [data-comprarapida]").first();
    const compraRapida = h3.attr("data-comprarapida") || "";
    if (compraRapida) {
      try {
        const decoded = JSON.parse(Buffer.from(compraRapida, "base64").toString("utf-8"));
        if (decoded.variacoes && decoded.variacoes.length > 0) {
          price = parseFloat(decoded.variacoes[0].preco.valor_venda || "0");
        }
      } catch {}
    }

    // Fallback: JSON-LD
    if (!price) {
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const data = JSON.parse($(el).html() || "{}");
          if (data["@type"] === "Product" && data.offers) {
            price = parseFloat(data.offers.price || data.offers.lowPrice || "0");
          }
        } catch {}
      });
    }

    return { img, price };
  } catch (err) {
    console.error(`  [WARN] Failed to scrape ${slug}: ${err}`);
    return { img: "", price: 0 };
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting scrape from ${BASE_URL}...`);

  const allScraped: ScrapedProduct[] = [];
  const seenSlugs = new Set<string>();

  // Phase 1: Scrape category listing pages
  for (const cat of CATEGORY_PAGES) {
    console.log(`  Scraping ${cat.label} (${cat.url})...`);
    try {
      const html = await fetchHTML(`${BASE_URL}${cat.url}`);
      const products = parseProductsFromHTML(html);

      let added = 0;
      for (const p of products) {
        if (!seenSlugs.has(p.slug)) {
          seenSlugs.add(p.slug);
          allScraped.push(p);
          added++;
        }
      }
      console.log(`    Found ${products.length} products (${added} new)`);
    } catch (err) {
      console.error(`    [ERROR] ${err}`);
    }
    await delay(300);
  }

  console.log(`  Total unique from listings: ${allScraped.length}`);

  // Phase 2: For products missing images, scrape individual pages
  const needDetail = allScraped.filter((p) => !p.img);
  if (needDetail.length > 0) {
    console.log(`\n  Fetching details for ${needDetail.length} products without images...`);
    for (let i = 0; i < needDetail.length; i++) {
      const p = needDetail[i];
      console.log(`    [${i + 1}/${needDetail.length}] ${p.slug}...`);
      const detail = await scrapeProductPage(p.slug);
      if (detail.img) p.img = detail.img;
      if (detail.price > 0 && !p.price) p.price = detail.price;
      await delay(500);
    }
  }

  // Phase 3: Also try to fetch individual pages for products in our catalog
  // that weren't found in the listings
  const dataDir = path.join(__dirname, "..", "src", "data");
  const productsFile = path.join(dataDir, "products.ts");
  const productsContent = fs.readFileSync(productsFile, "utf-8");

  // Extract all product names from products.ts
  const nameRegex = /name:\s*"([^"]+)"/g;
  const catalogNames: string[] = [];
  let match;
  while ((match = nameRegex.exec(productsContent)) !== null) {
    catalogNames.push(match[1]);
  }

  // Generate slugs from catalog names that we haven't scraped yet
  const missingFromCatalog: { name: string; slug: string }[] = [];
  for (const name of catalogNames) {
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+c\/\s+/g, "-com-")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    if (!seenSlugs.has(slug)) {
      missingFromCatalog.push({ name, slug });
    }
  }

  if (missingFromCatalog.length > 0) {
    console.log(`\n  Trying ${missingFromCatalog.length} additional products from catalog...`);
    for (let i = 0; i < missingFromCatalog.length; i++) {
      const { name, slug } = missingFromCatalog[i];
      console.log(`    [${i + 1}/${missingFromCatalog.length}] ${slug}...`);
      const detail = await scrapeProductPage(slug);
      if (detail.img || detail.price > 0) {
        seenSlugs.add(slug);
        allScraped.push({
          name,
          slug,
          img: detail.img,
          price: detail.price,
        });
      }
      await delay(500);
    }
  }

  // Save scraped data
  const outputPath = path.join(dataDir, "scraped-prices.json");
  const output = {
    timestamp: new Date().toISOString(),
    source: BASE_URL,
    productCount: allScraped.length,
    products: allScraped,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n  Saved ${allScraped.length} products to scraped-prices.json`);

  // === PRICE HISTORY TRACKING ===
  console.log(`\n  Tracking price history...`);
  const historyPath = path.join(dataDir, "price-history.json");

  interface PriceChange {
    date: string;
    product: string;
    slug: string;
    field: string;
    oldValue: number | string;
    newValue: number | string;
  }

  interface HistoryData {
    lastUpdate: string;
    changes: PriceChange[];
    snapshots: Array<{
      date: string;
      productCount: number;
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
    }>;
  }

  let history: HistoryData = { lastUpdate: "", changes: [], snapshots: [] };
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
    } catch {}
  }

  // Load previous scrape to compare
  const prevMapsPath = path.join(dataDir, "scrape-maps.json");
  let prevPriceMap: Record<string, number> = {};
  if (fs.existsSync(prevMapsPath)) {
    try {
      const prevMaps = JSON.parse(fs.readFileSync(prevMapsPath, "utf-8"));
      prevPriceMap = prevMaps.priceMap || {};
    } catch {}
  }

  const now = new Date().toISOString();
  let changesDetected = 0;

  for (const scraped of allScraped) {
    if (scraped.price <= 0) continue;

    const prevPrice = prevPriceMap[scraped.name];
    if (prevPrice && prevPrice !== scraped.price) {
      history.changes.push({
        date: now,
        product: scraped.name,
        slug: scraped.slug,
        field: "price",
        oldValue: prevPrice,
        newValue: scraped.price,
      });
      changesDetected++;
      const pct = (((scraped.price - prevPrice) / prevPrice) * 100).toFixed(1);
      const direction = scraped.price > prevPrice ? "↑" : "↓";
      console.log(`    ${direction} ${scraped.name}: R$ ${prevPrice} → R$ ${scraped.price} (${pct}%)`);
    }
  }

  // Also compare against catalog costs (atacado prices from products.ts)
  const costRegex = /name:\s*"([^"]+)".*?cost:\s*(\d+(?:\.\d+)?)/g;
  let costMatch;
  const catalogCosts: Record<string, number> = {};
  while ((costMatch = costRegex.exec(productsContent)) !== null) {
    catalogCosts[costMatch[1]] = parseFloat(costMatch[2]);
  }

  // Add a daily snapshot
  const prices = allScraped.filter((p) => p.price > 0).map((p) => p.price);
  if (prices.length > 0) {
    const snapshot = {
      date: now,
      productCount: prices.length,
      avgPrice: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
    };
    history.snapshots.push(snapshot);

    // Keep only last 365 days of snapshots
    if (history.snapshots.length > 365) {
      history.snapshots = history.snapshots.slice(-365);
    }
  }

  // Keep only last 1000 change records
  if (history.changes.length > 1000) {
    history.changes = history.changes.slice(-1000);
  }

  history.lastUpdate = now;
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

  if (changesDetected > 0) {
    console.log(`    ${changesDetected} price changes detected and logged`);
  } else {
    console.log(`    No price changes detected`);
  }

  // Generate maps for quick lookup
  const imageMap: Record<string, string> = {};
  const priceMap: Record<string, number> = {};
  const slugImageMap: Record<string, string> = {};

  allScraped.forEach((p) => {
    if (p.img) {
      imageMap[p.name] = p.img;
      slugImageMap[p.slug] = p.img;
    }
    if (p.price > 0) priceMap[p.name] = p.price;
  });

  const mapsPath = path.join(dataDir, "scrape-maps.json");
  fs.writeFileSync(
    mapsPath,
    JSON.stringify({ timestamp: new Date().toISOString(), imageMap, priceMap, slugImageMap }, null, 2)
  );
  console.log(`  Saved maps (${Object.keys(imageMap).length} images, ${Object.keys(priceMap).length} prices)`);

  // Phase 4: Update products.ts with scraped images
  console.log(`\n  Updating products.ts...`);

  let updatedContent = productsContent;
  let updatedImages = 0;

  for (const scraped of allScraped) {
    if (!scraped.img) continue;

    // Normalize the scraped name for matching
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

    const normalizedScraped = normalize(scraped.name);

    // Find the matching line in products.ts
    const lines = updatedContent.split("\n");
    for (let li = 0; li < lines.length; li++) {
      const nameMatch = lines[li].match(/name:\s*"([^"]+)"/);
      if (!nameMatch) continue;

      const normalizedExisting = normalize(nameMatch[1]);

      if (
        normalizedScraped === normalizedExisting ||
        normalizedScraped.includes(normalizedExisting) ||
        normalizedExisting.includes(normalizedScraped)
      ) {
        const imgMatch = lines[li].match(/img:\s*"([^"]*)"/);
        if (imgMatch && imgMatch[1] !== scraped.img) {
          lines[li] = lines[li].replace(/img:\s*"[^"]*"/, `img: "${scraped.img}"`);
          updatedImages++;
        }
        break;
      }
    }
    updatedContent = lines.join("\n");
  }

  fs.writeFileSync(productsFile, updatedContent);
  console.log(`  Updated ${updatedImages} images in products.ts`);

  // === SYNC TO SQLITE ===
  console.log(`\n  Syncing to SQLite...`);
  try {
    const Database = require("better-sqlite3");
    const dbDir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const db = new Database(path.join(dbDir, "melfit.db"));
    db.pragma("journal_mode = WAL");

    // Ensure tables exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS scraped_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        price REAL NOT NULL DEFAULT 0,
        img TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'floraamar.com.br',
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
    `);

    // Upsert scraped prices
    const upsertScraped = db.prepare(`
      INSERT INTO scraped_prices (product_name, slug, price, img, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET
        product_name = excluded.product_name,
        price = excluded.price,
        img = CASE WHEN excluded.img != '' THEN excluded.img ELSE scraped_prices.img END,
        updated_at = datetime('now')
    `);

    const upsertMany = db.transaction((products: ScrapedProduct[]) => {
      for (const p of products) {
        upsertScraped.run(p.name, p.slug, p.price, p.img);
      }
    });
    upsertMany(allScraped);

    // Insert price changes
    if (changesDetected > 0) {
      const insertChange = db.prepare(`
        INSERT INTO price_history (product_name, slug, field, old_value, new_value)
        VALUES (?, ?, 'price', ?, ?)
      `);
      const recentChanges = history.changes.slice(-changesDetected);
      for (const c of recentChanges) {
        insertChange.run(c.product, c.slug, c.oldValue, c.newValue);
      }
    }

    // Insert snapshot
    const prices = allScraped.filter((p) => p.price > 0).map((p) => p.price);
    if (prices.length > 0) {
      db.prepare(`
        INSERT INTO price_snapshots (product_count, avg_price, min_price, max_price)
        VALUES (?, ?, ?, ?)
      `).run(
        prices.length,
        Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
        Math.min(...prices),
        Math.max(...prices)
      );
    }

    // Update product images in DB
    const upsertProduct = db.prepare(`
      INSERT INTO products (id, name, cost, category, tags, sizes, img, slug, sold_out, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        img = CASE WHEN excluded.img != '' THEN excluded.img ELSE products.img END,
        updated_at = datetime('now')
    `);
    // Re-parse products.ts for DB sync
    const prodRegex = /\{\s*id:\s*(\d+),\s*name:\s*"([^"]+)",\s*cost:\s*(\d+(?:\.\d+)?),\s*category:\s*"([^"]+)",\s*tags:\s*\[([^\]]*)\],\s*sizes:\s*"([^"]+)",\s*img:\s*"([^"]*)"(?:,\s*slug:\s*"([^"]*)")?(?:,\s*soldOut:\s*(true|false))?\s*\}/g;
    const finalContent = fs.readFileSync(productsFile, "utf-8");
    let pm;
    while ((pm = prodRegex.exec(finalContent)) !== null) {
      const [, id, name, cost, category, tagsStr, sizes, img, slug, soldOut] = pm;
      const tags = tagsStr.split(",").map(t => t.trim().replace(/"/g, "")).filter(Boolean);
      upsertProduct.run(
        parseInt(id), name, parseFloat(cost), category,
        JSON.stringify(tags), sizes, img, slug || null,
        soldOut === "true" ? 1 : 0
      );
    }

    db.close();
    console.log(`    SQLite synced successfully`);
  } catch (err) {
    console.error(`    [WARN] SQLite sync failed: ${err}`);
  }

  const withImages = allScraped.filter((p) => p.img).length;
  const withPrices = allScraped.filter((p) => p.price > 0).length;
  console.log(`\n  Summary:`);
  console.log(`    Products scraped: ${allScraped.length}`);
  console.log(`    With images: ${withImages}`);
  console.log(`    With prices: ${withPrices}`);

  console.log(`\n[${new Date().toISOString()}] Scrape complete!`);
}

main().catch(console.error);
