import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  category: string;
  slug: string;
  img: string;
}

async function fetchAndParse(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  return res.text();
}

function parseProducts(html: string, category: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];

  // Parse compra_rapida items using regex (no cheerio in API routes)
  const itemRegex = /<div class="item compra_rapida">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  const nameRegex = /title="([^"]+)"/;
  const imgRegex = /data-src="(https:\/\/cdn\.sistemawbuy\.com\.br[^"]+)"/;
  const slugRegex = /href="([a-z0-9-]+)\/?"/;
  const compraRapidaRegex = /data-comprarapida="([^"]+)"/;

  let match;
  while ((match = itemRegex.exec(html)) !== null) {
    const block = match[1];
    const name = nameRegex.exec(block)?.[1] || "";
    const img = (imgRegex.exec(block)?.[1] || "").replace("_mini.", ".");
    const slug = slugRegex.exec(block)?.[1] || "";

    let price = 0;
    const compraRapida = compraRapidaRegex.exec(block)?.[1];
    if (compraRapida) {
      try {
        const decoded = JSON.parse(Buffer.from(compraRapida, "base64").toString("utf-8"));
        if (decoded.variacoes?.[0]?.preco) {
          price = parseFloat(decoded.variacoes[0].preco.valor_venda || "0");
        }
      } catch {}
    }

    if (name && slug) {
      products.push({ name, price, category, slug, img });
    }
  }

  return products;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== "melfit2024") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allProducts: ScrapedProduct[] = [];
    const seenSlugs = new Set<string>();

    for (const cat of CATEGORY_URLS) {
      const html = await fetchAndParse(`${BASE_URL}${cat.url}`);
      const products = parseProducts(html, cat.label);

      for (const p of products) {
        if (!seenSlugs.has(p.slug)) {
          seenSlugs.add(p.slug);
          allProducts.push(p);
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      source: BASE_URL,
      count: allProducts.length,
      products: allProducts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Scrape failed" },
      { status: 500 }
    );
  }
}
