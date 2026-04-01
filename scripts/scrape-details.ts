/**
 * Scrape de detalhes dos produtos: múltiplas imagens, estoque por tamanho,
 * tabela de medidas e descrição.
 *
 * Roda via: npx tsx scripts/scrape-details.ts
 */

import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const BASE_URL = "https://www.floraamar.com.br";
const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY || "5000", 10);

interface ProductDetail {
  slug: string;
  name: string;
  images: string[];
  sizeChart: string;
  description: string;
  stock: Record<string, number>;
  totalStock: number;
}

function fetchHTML(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redir = res.headers.location.startsWith("http") ? res.headers.location : `${BASE_URL}${res.headers.location}`;
        fetchHTML(redir).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function scrapeProductDetail(slug: string): Promise<ProductDetail | null> {
  try {
    const html = await fetchHTML(`${BASE_URL}/${slug}/`);
    if (html.length < 1000) return null; // anti-bot page

    const $ = cheerio.load(html);

    // 1. Get the product's image folder from og:image
    const ogImg = $('meta[property="og:image"]').attr("content") || "";
    const folderMatch = ogImg.match(/\/produtos\/([^/]+)\//);
    const productFolder = folderMatch?.[1] || "";

    // 2. Get ALL gallery images belonging to this product's folder
    const images: string[] = [];
    $(".galeria img, .fotos img, .gallery img").each((_, el) => {
      const src = $(el).attr("data-src") || $(el).attr("src") || "";
      if (src.includes("/produtos/") && src.includes(productFolder) && !src.includes("_mini")) {
        // Skip size chart images
        if (!src.includes("template") && !src.includes("duvida")) {
          const fullUrl = src.startsWith("http") ? src : `https://${src}`;
          if (!images.includes(fullUrl)) images.push(fullUrl);
        }
      }
    });

    // If no gallery images found, also check regular img tags
    if (images.length === 0 && productFolder) {
      $("img").each((_, el) => {
        const src = $(el).attr("data-src") || $(el).attr("src") || "";
        if (src.includes(productFolder) && !src.includes("_mini") && !src.includes("template")) {
          const fullUrl = src.startsWith("http") ? src : `https://${src}`;
          if (!images.includes(fullUrl)) images.push(fullUrl);
        }
      });
    }

    // 3. Get size chart image
    let sizeChart = "";
    $("img").each((_, el) => {
      const src = $(el).attr("data-src") || $(el).attr("src") || "";
      if (src.includes(productFolder) && (src.includes("template") || src.includes("medida") || src.includes("tabela"))) {
        sizeChart = src.startsWith("http") ? src : `https://${src}`;
      }
    });

    // 4. Get stock by size from compra_rapida
    const stock: Record<string, number> = {};
    let totalStock = 0;
    let name = $("h1").first().text().trim() || $("title").text().split("-")[0].trim();

    // The first compra_rapida on the page is usually the main product
    const compraRapida = $("[data-comprarapida]").first().attr("data-comprarapida") || "";
    if (compraRapida) {
      try {
        const decoded = JSON.parse(Buffer.from(compraRapida, "base64").toString("utf-8"));
        if (decoded.nome) name = decoded.nome;
        for (const v of decoded.variacoes || []) {
          const sizeName = v.atributos?.tamanho?.nome || "U";
          const qty = parseInt(v.estoque || "0");
          stock[sizeName] = qty;
          totalStock += qty;
        }
      } catch {}
    }

    // 5. Get description
    const description = $('meta[name="description"]').attr("content") || "";

    return { slug, name, images, sizeChart, description, stock, totalStock };
  } catch (err) {
    console.error(`  [WARN] ${slug}: ${err}`);
    return null;
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Scraping product details...\n`);

  // Load existing scraped data to get slugs
  const dataDir = path.join(__dirname, "..", "src", "data");
  const scrapedFile = path.join(dataDir, "scraped-prices.json");
  const scraped = JSON.parse(fs.readFileSync(scrapedFile, "utf-8"));

  // Also get slugs from products.ts for items not in scraped data
  const productsContent = fs.readFileSync(path.join(dataDir, "products.ts"), "utf-8");
  const allSlugs = new Set<string>();

  for (const p of scraped.products) {
    if (p.slug) allSlugs.add(p.slug);
  }

  // Generate slugs from product names
  const nameRegex = /name:\s*"([^"]+)"/g;
  let m;
  while ((m = nameRegex.exec(productsContent)) !== null) {
    const slug = m[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+c\/\s*/g, "-c-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    allSlugs.add(slug);
  }

  const slugs = Array.from(allSlugs);
  console.log(`  ${slugs.length} products to scrape\n`);

  const details: Record<string, ProductDetail> = {};
  let success = 0;

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    process.stdout.write(`  [${i + 1}/${slugs.length}] ${slug}...`);

    const detail = await scrapeProductDetail(slug);
    if (detail && (detail.images.length > 0 || detail.totalStock > 0)) {
      details[slug] = detail;
      success++;
      console.log(` ${detail.images.length} imgs, stock: ${detail.totalStock}, chart: ${detail.sizeChart ? "yes" : "no"}`);
    } else {
      console.log(" skip");
    }

    await delay(SCRAPE_DELAY);
  }

  // Save details
  const outputPath = path.join(dataDir, "product-details.json");
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    count: Object.keys(details).length,
    products: details,
  }, null, 2));

  console.log(`\n  Saved ${success} product details to product-details.json`);
  console.log(`[${new Date().toISOString()}] Done!`);
}

main().catch(console.error);
