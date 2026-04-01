/**
 * Scrape de imagens do ATACADO (sem marca Flora Amar)
 * As páginas de produto exigem login, mas as de categoria não.
 * Roda via: npx tsx scripts/scrape-atacado-images.ts
 */

import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

const BASE_URL = "https://www.floraamaratacado.com.br";
const ATACADO_CDN = "97065044c3a1a212e5c7a4f183fed028";

const CATEGORIES = [
  { url: "/pecas-avulsas/tops/", label: "tops" },
  { url: "/pecas-avulsas/shorts/", label: "shorts" },
  { url: "/pecas-avulsas/leggings/", label: "leggings" },
  { url: "/pecas-avulsas/macaquinhos/", label: "macaquinhos" },
  { url: "/pecas-avulsas/macacao/", label: "macacoes" },
  { url: "/conjuntos/", label: "conjuntos" },
  { url: "/colecao-exclusiva/", label: "colecao-exclusiva" },
  { url: "/novidade/", label: "novidade" },
];

interface AtacadoProduct {
  name: string;
  slug: string;
  atacadoSlug: string;
  images: string[];       // Full-size images from atacado CDN
  stock: Record<string, number>;
  totalStock: number;
  price: number;
  folder: string;         // CDN folder ID
}

let sessionCookies = "";

async function initSession() {
  // Visit homepage to get session cookies
  return new Promise<void>((resolve, reject) => {
    https.get(BASE_URL + "/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    }, (res) => {
      const cookies = res.headers["set-cookie"] || [];
      sessionCookies = cookies.map((c) => c.split(";")[0]).join("; ");
      res.resume();
      res.on("end", () => {
        console.log(`  Session cookies: ${sessionCookies ? "OK" : "none"}`);
        resolve();
      });
    }).on("error", reject);
  });
}

function fetchHTML(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9",
        Referer: BASE_URL + "/",
        Cookie: sessionCookies,
      },
    }, (res) => {
      // Capture any new cookies
      const newCookies = res.headers["set-cookie"] || [];
      if (newCookies.length > 0) {
        const existing = new Map(sessionCookies.split("; ").filter(Boolean).map(c => {
          const [k] = c.split("=");
          return [k, c] as [string, string];
        }));
        newCookies.forEach(c => {
          const pair = c.split(";")[0];
          const [k] = pair.split("=");
          existing.set(k, pair);
        });
        sessionCookies = Array.from(existing.values()).join("; ");
      }

      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const r = res.headers.location.startsWith("http") ? res.headers.location : `${BASE_URL}${res.headers.location}`;
        fetchHTML(r).then(resolve).catch(reject);
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
    }).on("error", reject).setTimeout(15000, () => reject(new Error("Timeout")));
  });
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function parseListingPage(html: string): AtacadoProduct[] {
  const $ = cheerio.load(html);
  const products: AtacadoProduct[] = [];

  $(".item.compra_rapida").each((_, el) => {
    const $el = $(el);
    const h3 = $el.find("h3.produto");
    const name = h3.attr("title") || "";
    const atacadoSlug = ($el.find("a").first().attr("href") || "").replace(/\//g, "");
    // Remove -at suffix for matching with our catalog
    const slug = atacadoSlug.replace(/-at$/, "");

    // Get ALL images from this item (atacado CDN only)
    const images: string[] = [];
    let folder = "";
    $el.find("img[data-src]").each((_, img) => {
      const src = $(img).attr("data-src") || "";
      if (src.includes(ATACADO_CDN) && src.includes("/produtos/")) {
        // Extract folder ID
        const folderMatch = src.match(/\/produtos\/([^/]+)\//);
        if (folderMatch && !folder) folder = folderMatch[1];

        // Convert to full-size
        const fullSize = src.replace("_mini.", ".");
        if (!images.includes(fullSize)) images.push(fullSize);
      }
    });

    // Extract stock and price from compra_rapida
    const stock: Record<string, number> = {};
    let totalStock = 0;
    let price = 0;
    const b64 = h3.attr("data-comprarapida") || "";
    if (b64) {
      try {
        const data = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
        for (const v of data.variacoes || []) {
          const sizeName = v.atributos?.tamanho?.nome || "U";
          const qty = parseInt(v.estoque || "0");
          stock[sizeName] = qty;
          totalStock += qty;
          if (!price) price = parseFloat(v.preco?.valor_venda || "0");
        }
      } catch {}
    }

    if (name && slug) {
      products.push({ name, slug, atacadoSlug, images, stock, totalStock, price, folder });
    }
  });

  return products;
}

async function scrapeProductPage(slug: string, folder: string): Promise<string[]> {
  // Product pages need login on atacado, but we can try
  // If it fails, we use listing images only
  try {
    const html = await fetchHTML(`${BASE_URL}/${slug}/`);
    if (html.length < 5000) return []; // login page

    const $ = cheerio.load(html);
    const images: string[] = [];

    // Gallery images from the same folder
    $(".galeria img, .fotos img, .big img, a.fancybox img").each((_, el) => {
      const src = $(el).attr("data-src") || $(el).attr("src") || "";
      if (src.includes(ATACADO_CDN) && src.includes(folder) && !src.includes("template") && !src.includes("_mini")) {
        if (!images.includes(src)) images.push(src);
      }
    });

    // Also check href of fancybox links
    $("a.fancybox").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href.includes(ATACADO_CDN) && href.includes(folder) && !href.includes("template")) {
        if (!images.includes(href)) images.push(href);
      }
    });

    return images;
  } catch {
    return [];
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Scraping atacado images...\n`);

  await initSession();

  const allProducts = new Map<string, AtacadoProduct>();

  // Phase 1: Scrape all category listings
  for (const cat of CATEGORIES) {
    console.log(`  ${cat.label} (${cat.url})...`);
    try {
      const html = await fetchHTML(`${BASE_URL}${cat.url}`);
      const products = parseListingPage(html);
      let added = 0;
      for (const p of products) {
        if (!allProducts.has(p.slug)) {
          allProducts.set(p.slug, p);
          added++;
        }
      }
      console.log(`    ${products.length} products (${added} new)`);
    } catch (err) {
      console.error(`    ERROR: ${err}`);
    }
    await delay(300);
  }

  console.log(`\n  Total unique: ${allProducts.size}`);

  // Phase 2: Try to get full gallery from product pages
  console.log(`\n  Fetching full galleries from product pages...`);
  let enhanced = 0;
  const entries = Array.from(allProducts.entries());

  for (let i = 0; i < entries.length; i++) {
    const [slug, product] = entries[i];
    if (!product.folder) continue;

    process.stdout.write(`  [${i + 1}/${entries.length}] ${product.atacadoSlug}...`);
    const fullImages = await scrapeProductPage(product.atacadoSlug, product.folder);

    if (fullImages.length > product.images.length) {
      product.images = fullImages;
      enhanced++;
      console.log(` ${fullImages.length} imgs`);
    } else {
      console.log(` listing only (${product.images.length})`);
    }
    await delay(400);
  }

  console.log(`\n  Enhanced ${enhanced} products with full galleries`);

  // Save atacado data
  const dataDir = path.join(__dirname, "..", "src", "data");
  const outputPath = path.join(dataDir, "atacado-details.json");

  const output: Record<string, any> = {};
  for (const [slug, p] of allProducts) {
    output[slug] = {
      name: p.name,
      atacadoSlug: p.atacadoSlug,
      images: p.images,
      stock: p.stock,
      totalStock: p.totalStock,
      price: p.price,
      folder: p.folder,
    };
  }

  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    source: "floraamaratacado.com.br",
    cdn: ATACADO_CDN,
    count: allProducts.size,
    products: output,
  }, null, 2));

  // Also update products.ts with atacado images
  console.log(`\n  Updating products.ts with atacado images...`);
  const productsFile = path.join(dataDir, "products.ts");
  let content = fs.readFileSync(productsFile, "utf-8");
  let updated = 0;

  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/c\/\s*/g, "").replace(/\s+/g, " ").trim();

  for (const [slug, p] of allProducts) {
    if (p.images.length === 0) continue;
    const mainImg = p.images[0];
    const normScraped = normalize(p.name);

    const lines = content.split("\n");
    for (let li = 0; li < lines.length; li++) {
      const nameMatch = lines[li].match(/name:\s*"([^"]+)"/);
      if (!nameMatch) continue;
      const normExisting = normalize(nameMatch[1]);

      if (normScraped === normExisting || normScraped.includes(normExisting) || normExisting.includes(normScraped)) {
        const imgMatch = lines[li].match(/img:\s*"([^"]*)"/);
        if (imgMatch && imgMatch[1] !== mainImg) {
          lines[li] = lines[li].replace(/img:\s*"[^"]*"/, `img: "${mainImg}"`);
          updated++;
        }
        break;
      }
    }
    content = lines.join("\n");
  }

  fs.writeFileSync(productsFile, content);

  const withImgs = Array.from(allProducts.values()).filter(p => p.images.length > 0).length;
  console.log(`  Updated ${updated} images in products.ts`);
  console.log(`\n  Summary:`);
  console.log(`    Products: ${allProducts.size}`);
  console.log(`    With images: ${withImgs}`);
  console.log(`    Stock data: ${Array.from(allProducts.values()).filter(p => p.totalStock > 0).length}`);

  console.log(`\n[${new Date().toISOString()}] Done!`);
}

main().catch(console.error);
