/**
 * Scrape de PREÇOS do VAREJO (floraamar.com.br)
 * ⚠ SOMENTE PREÇO! Imagens, estoque e qualquer outro dado vêm do ATACADO.
 *
 * Roda via: npx tsx scripts/scrape-prices.ts
 */

import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const BASE_URL = "https://www.floraamar.com.br";
const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY || "5000", 10);

// Categorias do varejo (só as que revendemos)
const CATEGORY_PAGES = [
  { url: "/tops/", label: "Tops" },
  { url: "/shorts/", label: "Shorts" },
  { url: "/leggings/", label: "Leggings" },
  { url: "/macaquinhos/", label: "Macaquinhos" },
  { url: "/macacao/", label: "Macacoes" },
  { url: "/conjuntos/", label: "Conjuntos" },
];

interface ScrapedProduct {
  name: string;
  price: number;
  slug: string;
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
      products.push({ name, price, slug });
    }
  });

  return products;
}

async function scrapeProductPage(slug: string): Promise<{ price: number }> {
  try {
    const html = await fetchHTML(`${BASE_URL}/${slug}/`);
    const $ = cheerio.load(html);

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

    // Conjuntos (grade_biquini): soma das pecas
    if (!price && $(".grade_biquini").length > 0) {
      $(".grade_biquini .opcao").each((_, opcao) => {
        const item = $(opcao).find(".item[data-valorvenda]").first();
        const val = parseFloat(item.attr("data-valorvenda") || "0");
        if (val > 0) price += val;
      });
      if (price > 0) {
        console.log(`    [CONJUNTO] ${slug}: total R$ ${price} (soma das pecas)`);
      }
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

    return { price };
  } catch (err) {
    console.error(`  [WARN] Failed to scrape ${slug}: ${err}`);
    return { price: 0 };
  }
}

async function main() {
  const startTime = Date.now();
  const log = (phase: string, msg: string) => console.log(`  [${phase}] ${msg}`);
  const logErr = (phase: string, msg: string) => console.error(`  [${phase}][ERRO] ${msg}`);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  SCRAPE VAREJO — SOMENTE PREÇOS`);
  console.log(`  Fonte: ${BASE_URL} (VAREJO)`);
  console.log(`  ⚠ Capturando: PREÇO`);
  console.log(`  ⚠ NÃO captura: imagens, estoque, descrições`);
  console.log(`  Data: ${new Date().toISOString()}`);
  console.log(`  Delay: ${SCRAPE_DELAY}ms entre requests`);
  console.log(`${"=".repeat(60)}\n`);

  const dataDir = path.join(__dirname, "..", "src", "data");
  const allScraped: ScrapedProduct[] = [];
  const seenSlugs = new Set<string>();
  let totalRequests = 0;
  const stats = { fase1: 0, fase2: 0, fase3: 0, fase4: 0, fase5: 0, erros: 0 };

  // ── Carregar URL overrides manuais ──
  const overridesPath = path.join(dataDir, "url-overrides.json");
  let urlOverrides: Record<string, { varejoSlug?: string; atacadoSlug?: string }> = {};
  try {
    const overridesData = JSON.parse(fs.readFileSync(overridesPath, "utf-8"));
    urlOverrides = overridesData.products || {};
    const count = Object.keys(urlOverrides).length;
    if (count > 0) log("INIT", `${count} URL overrides manuais carregados`);
  } catch {
    log("INIT", "Sem url-overrides.json (opcional)");
  }

  // Helper: gera slug a partir do nome
  const nameToSlug = (name: string) =>
    name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+c\/\s*/g, "-c-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  // Helper: busca produto com override ou slug gerado
  const getVarejoSlug = (name: string): string => {
    if (urlOverrides[name]?.varejoSlug) return urlOverrides[name].varejoSlug!;
    return nameToSlug(name);
  };

  // ══════════════════════════════════════════════════════════════
  // FASE 1: Categorias do varejo
  // ══════════════════════════════════════════════════════════════
  console.log(`\n── FASE 1: Listagens de categoria (${CATEGORY_PAGES.length} paginas) ──`);
  for (const cat of CATEGORY_PAGES) {
    try {
      const html = await fetchHTML(`${BASE_URL}${cat.url}`);
      totalRequests++;
      const products = parseProductsFromHTML(html);
      let added = 0;
      for (const p of products) {
        if (!seenSlugs.has(p.slug)) {
          seenSlugs.add(p.slug);
          allScraped.push(p);
          added++;
        }
      }
      stats.fase1 += added;
      log("FASE1", `${cat.label}: ${products.length} encontrados, ${added} novos`);
    } catch (err: any) {
      stats.erros++;
      logErr("FASE1", `${cat.label}: ${err.message || err}`);
    }
    await delay(SCRAPE_DELAY);
  }
  log("FASE1", `Total unico: ${allScraped.length} produtos`);

  // ══════════════════════════════════════════════════════════════
  // FASE 2: Produtos sem preco — busca pagina individual
  // ══════════════════════════════════════════════════════════════
  const needPrice = allScraped.filter((p) => !p.price);
  if (needPrice.length > 0) {
    console.log(`\n── FASE 2: Precos faltantes (${needPrice.length} produtos) ──`);
    for (let i = 0; i < needPrice.length; i++) {
      const p = needPrice[i];
      try {
        const detail = await scrapeProductPage(p.slug);
        totalRequests++;
        if (detail.price > 0) { p.price = detail.price; stats.fase2++; }
        log("FASE2", `[${i + 1}/${needPrice.length}] ${p.slug} → ${detail.price > 0 ? `R$${detail.price}` : "sem preco"}`);
      } catch (err: any) {
        stats.erros++;
        logErr("FASE2", `${p.slug}: ${err.message || err}`);
      }
      await delay(SCRAPE_DELAY);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // FASE 3: Produtos do catalogo nao encontrados nas listagens
  // ══════════════════════════════════════════════════════════════
  const productsFile = path.join(dataDir, "products.ts");
  const productsContent = fs.readFileSync(productsFile, "utf-8");
  const nameRegex = /name:\s*"([^"]+)"/g;
  const catalogNames: string[] = [];
  let match;
  while ((match = nameRegex.exec(productsContent)) !== null) {
    catalogNames.push(match[1]);
  }

  const missingFromCatalog: { name: string; slug: string }[] = [];
  for (const name of catalogNames) {
    if (name.toLowerCase().startsWith("conjunto ")) continue; // conjuntos vao na fase 4
    const slug = getVarejoSlug(name);
    if (!seenSlugs.has(slug)) {
      missingFromCatalog.push({ name, slug });
    }
  }

  if (missingFromCatalog.length > 0) {
    console.log(`\n── FASE 3: Pecas avulsas faltantes (${missingFromCatalog.length} produtos) ──`);
    for (let i = 0; i < missingFromCatalog.length; i++) {
      const { name, slug } = missingFromCatalog[i];
      const isOverride = urlOverrides[name]?.varejoSlug ? " [OVERRIDE]" : "";
      try {
        const detail = await scrapeProductPage(slug);
        totalRequests++;
        if (detail.price > 0) {
          seenSlugs.add(slug);
          allScraped.push({ name, slug, price: detail.price });
          stats.fase3++;
          log("FASE3", `[${i + 1}/${missingFromCatalog.length}] ${slug}${isOverride} → R$${detail.price}`);
        } else {
          log("FASE3", `[${i + 1}/${missingFromCatalog.length}] ${slug}${isOverride} → nao encontrado`);
        }
      } catch (err: any) {
        stats.erros++;
        logErr("FASE3", `${slug}: ${err.message || err}`);
      }
      await delay(SCRAPE_DELAY);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // FASE 4: Pecas de conjuntos (desmembra e busca individual)
  // ══════════════════════════════════════════════════════════════
  const conjuntoNames = catalogNames.filter((n) => n.toLowerCase().startsWith("conjunto "));
  const pieceSlugs: { name: string; slug: string; conjuntoName: string; source: string }[] = [];

  for (const conjName of conjuntoNames) {
    // Primeiro: checa se tem override manual para o conjunto inteiro
    if (urlOverrides[conjName]?.varejoSlug) {
      const slug = urlOverrides[conjName].varejoSlug!;
      if (!seenSlugs.has(slug)) {
        pieceSlugs.push({ name: conjName, slug, conjuntoName: conjName, source: "override" });
      }
      continue;
    }

    const norm = conjName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const pieceMatch = norm.match(/^conjunto\s+(.+?)\s+e\s+((?:short|legging|calca|calcinha).+)$/);
    if (!pieceMatch) {
      log("FASE4", `${conjName} → nao consegui extrair pecas do nome`);
      continue;
    }

    const piece1Base = pieceMatch[1];
    const piece2Full = pieceMatch[2];
    const piece2Words = piece2Full.split(" ");
    const pieceTypes = ["short", "legging", "calca", "calcinha", "basic", "edge", "cross", "run", "speed", "adapt", "line", "flare", "classic"];
    const colorWords = piece2Words.filter((w) => !pieceTypes.includes(w));
    const color = colorWords.join(" ");

    const toSlugLocal = (s: string) =>
      s.replace(/\s+c\/\s*/g, "-c-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const piece1HasColor = colorWords.some((w) => piece1Base.includes(w));
    const piece1Name = piece1HasColor ? piece1Base : `${piece1Base} ${color}`;
    const slug1 = toSlugLocal(piece1Name);
    const slug2 = toSlugLocal(piece2Full);

    // Checa overrides para pecas individuais tambem
    const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
    const p1Name = titleCase(piece1Name);
    const p2Name = titleCase(piece2Full);

    if (!seenSlugs.has(urlOverrides[p1Name]?.varejoSlug || slug1)) {
      pieceSlugs.push({
        name: p1Name,
        slug: urlOverrides[p1Name]?.varejoSlug || slug1,
        conjuntoName: conjName,
        source: urlOverrides[p1Name]?.varejoSlug ? "override" : "auto",
      });
    }
    if (!seenSlugs.has(urlOverrides[p2Name]?.varejoSlug || slug2)) {
      pieceSlugs.push({
        name: p2Name,
        slug: urlOverrides[p2Name]?.varejoSlug || slug2,
        conjuntoName: conjName,
        source: urlOverrides[p2Name]?.varejoSlug ? "override" : "auto",
      });
    }
  }

  if (pieceSlugs.length > 0) {
    console.log(`\n── FASE 4: Pecas de conjuntos (${pieceSlugs.length} pecas) ──`);
    for (let i = 0; i < pieceSlugs.length; i++) {
      const { name, slug, conjuntoName, source } = pieceSlugs[i];
      if (seenSlugs.has(slug)) {
        log("FASE4", `[${i + 1}/${pieceSlugs.length}] ${slug} → ja existe (skip)`);
        continue;
      }
      const tag = source === "override" ? " [OVERRIDE]" : "";
      try {
        const detail = await scrapeProductPage(slug);
        totalRequests++;
        if (detail.price > 0) {
          seenSlugs.add(slug);
          allScraped.push({ name, slug, price: detail.price });
          stats.fase4++;
          log("FASE4", `[${i + 1}/${pieceSlugs.length}] ${slug}${tag} → R$${detail.price} (${conjuntoName})`);
        } else {
          log("FASE4", `[${i + 1}/${pieceSlugs.length}] ${slug}${tag} → nao encontrado`);
        }
      } catch (err: any) {
        stats.erros++;
        logErr("FASE4", `${slug}: ${err.message || err}`);
      }
      await delay(SCRAPE_DELAY);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // FASE 5: URL overrides manuais que ainda nao foram buscados
  // ══════════════════════════════════════════════════════════════
  const manualPending = Object.entries(urlOverrides).filter(
    ([name, o]) => o.varejoSlug && !seenSlugs.has(o.varejoSlug)
  );
  if (manualPending.length > 0) {
    console.log(`\n── FASE 5: Overrides manuais pendentes (${manualPending.length}) ──`);
    for (const [name, o] of manualPending) {
      const slug = o.varejoSlug!;
      try {
        const detail = await scrapeProductPage(slug);
        totalRequests++;
        if (detail.price > 0) {
          seenSlugs.add(slug);
          allScraped.push({ name, slug, price: detail.price });
          stats.fase5++;
          log("FASE5", `${slug} → R$${detail.price} [OVERRIDE manual]`);
        } else {
          log("FASE5", `${slug} → nao encontrado [OVERRIDE manual]`);
        }
      } catch (err: any) {
        stats.erros++;
        logErr("FASE5", `${slug}: ${err.message || err}`);
      }
      await delay(SCRAPE_DELAY);
    }
  }

  // ── Resumo ──
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  RESUMO DO SCRAPE`);
  console.log(`  Tempo: ${elapsed}s | Requests: ${totalRequests} | Delay: ${SCRAPE_DELAY}ms`);
  console.log(`  Fase 1 (categorias):     ${stats.fase1} produtos`);
  console.log(`  Fase 2 (precos):         ${stats.fase2} encontrados`);
  console.log(`  Fase 3 (pecas avulsas):  ${stats.fase3} encontradas`);
  console.log(`  Fase 4 (conjuntos):      ${stats.fase4} pecas encontradas`);
  console.log(`  Fase 5 (overrides):      ${stats.fase5} encontrados`);
  console.log(`  Erros:                   ${stats.erros}`);
  console.log(`  Total final:             ${allScraped.length} produtos`);
  console.log(`${"─".repeat(60)}\n`);

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

  // Generate maps for quick lookup (somente precos — imagens vem do atacado)
  const priceMap: Record<string, number> = {};

  allScraped.forEach((p) => {
    if (p.price > 0) priceMap[p.name] = p.price;
  });

  const mapsPath = path.join(dataDir, "scrape-maps.json");
  fs.writeFileSync(
    mapsPath,
    JSON.stringify({ timestamp: new Date().toISOString(), priceMap }, null, 2)
  );
  console.log(`  Saved maps (${Object.keys(priceMap).length} prices)`);

  // NOTA: Imagens NÃO são atualizadas aqui — vêm exclusivamente do atacado
  // (via scrape-atacado-images.ts)

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

    // Upsert scraped prices (somente precos — sem imagens)
    const upsertScraped = db.prepare(`
      INSERT INTO scraped_prices (product_name, slug, price, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET
        product_name = excluded.product_name,
        price = excluded.price,
        updated_at = datetime('now')
    `);

    const upsertMany = db.transaction((products: ScrapedProduct[]) => {
      for (const p of products) {
        upsertScraped.run(p.name, p.slug, p.price);
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

    db.close();
    console.log(`    SQLite synced successfully`);
  } catch (err) {
    console.error(`    [WARN] SQLite sync failed: ${err}`);
  }

  const withPrices = allScraped.filter((p) => p.price > 0).length;
  console.log(`\n  Summary:`);
  console.log(`    Products scraped: ${allScraped.length}`);
  console.log(`    With prices: ${withPrices}`);

  // ── Sync precos para Turso ──
  await syncPricesToTurso(priceMap);

  console.log(`\n[${new Date().toISOString()}] Scrape complete!`);
}

async function syncPricesToTurso(priceMap: Record<string, number>) {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    console.log("\n  [SYNC] TURSO_DATABASE_URL nao configurado — skip sync");
    return;
  }

  try {
    const { createClient } = await import("@libsql/client");
    const db = createClient({ url, authToken });

    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    const priceJson = JSON.stringify(priceMap);
    const size = (Buffer.byteLength(priceJson) / 1024).toFixed(1);
    await db.execute({
      sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      args: ["catalog_varejo_prices", priceJson],
    });
    console.log(`\n  [SYNC] varejo prices → Turso (${size}KB) ✓`);
  } catch (err) {
    console.error(`\n  [SYNC] Falha ao sincronizar com Turso: ${err}`);
  }
}

main().catch(console.error);
