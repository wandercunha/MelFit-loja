import { NextResponse } from "next/server";
import {
  initSchema,
  getScrapedPriceMap,
  upsertScrapedPrice,
  addPriceChange,
  addPriceSnapshot,
} from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Pro: até 60s

const BASE_URL = "https://www.floraamar.com.br";

const CATEGORY_URLS = [
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

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function parseProducts(html: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];

  // Regex para extrair dados dos itens de produto
  // Cada produto está dentro de <div class="item compra_rapida">
  const blockRegex =
    /<div[^>]*class="item compra_rapida"[^>]*>([\s\S]*?)(?=<div[^>]*class="item compra_rapida"|<\/section|$)/g;

  let blockMatch;
  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[1];

    // Nome do produto
    const titleMatch = block.match(/title="([^"]+)"/);
    const name = titleMatch?.[1] || "";

    // Slug (link)
    const slugMatch = block.match(/href="([a-z0-9][a-z0-9-]*)\/?"/);
    const slug = slugMatch?.[1] || "";

    // Imagem (data-src do lazy load)
    const imgMatch = block.match(
      /data-src="(https:\/\/cdn\.sistemawbuy\.com\.br[^"]+)"/
    );
    const img = (imgMatch?.[1] || "").replace("_mini.", ".");

    // Preço (base64 JSON no data-comprarapida)
    let price = 0;
    const compraMatch = block.match(/data-comprarapida="([^"]+)"/);
    if (compraMatch) {
      try {
        const decoded = JSON.parse(
          Buffer.from(compraMatch[1], "base64").toString("utf-8")
        );
        if (decoded.variacoes?.[0]?.preco) {
          price = parseFloat(
            decoded.variacoes[0].preco.valor_venda ||
              decoded.variacoes[0].preco.valor_de ||
              "0"
          );
        }
      } catch {}
    }

    if (name && slug) {
      products.push({ name, price, slug, img });
    }
  }

  return products;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  // Também aceita header Authorization para cron jobs
  const authHeader = request.headers.get("authorization");
  const isAuthorized =
    secret === "melfit2024" ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Garantir schema existe
    await initSchema();

    // Buscar preços anteriores para comparação
    const prevPrices = await getScrapedPriceMap();

    // Scrape das páginas de categoria (rápido: ~4 requests)
    const allProducts: ScrapedProduct[] = [];
    const seenSlugs = new Set<string>();

    for (const cat of CATEGORY_URLS) {
      try {
        const html = await fetchPage(`${BASE_URL}${cat.url}`);
        const products = parseProducts(html);

        for (const p of products) {
          if (!seenSlugs.has(p.slug)) {
            seenSlugs.add(p.slug);
            allProducts.push(p);
          }
        }
      } catch (err) {
        console.error(`Error scraping ${cat.url}:`, err);
      }
    }

    // Salvar no banco e detectar mudanças
    let changesDetected = 0;
    const changes: Array<{
      product: string;
      oldPrice: number;
      newPrice: number;
    }> = [];

    for (const p of allProducts) {
      // Upsert no banco
      await upsertScrapedPrice({
        name: p.name,
        slug: p.slug,
        price: p.price,
        img: p.img,
      });

      // Detectar mudança de preço
      if (p.price > 0) {
        const prevPrice = prevPrices[p.name];
        if (prevPrice && prevPrice !== p.price) {
          await addPriceChange({
            productName: p.name,
            slug: p.slug,
            oldValue: prevPrice,
            newValue: p.price,
          });
          changes.push({
            product: p.name,
            oldPrice: prevPrice,
            newPrice: p.price,
          });
          changesDetected++;
        }
      }
    }

    // Snapshot diário
    const prices = allProducts
      .filter((p) => p.price > 0)
      .map((p) => p.price);
    if (prices.length > 0) {
      await addPriceSnapshot({
        productCount: prices.length,
        avgPrice:
          Math.round(
            (prices.reduce((a, b) => a + b, 0) / prices.length) * 100
          ) / 100,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      source: BASE_URL,
      count: allProducts.length,
      pricesTracked: prices.length,
      changesDetected,
      changes,
    });
  } catch (error: any) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: error.message || "Scrape failed" },
      { status: 500 }
    );
  }
}
