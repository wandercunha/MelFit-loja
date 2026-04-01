import { NextResponse } from "next/server";
import {
  initSchema,
  getScrapedPriceMap,
  upsertScrapedPrice,
  addPriceChange,
  addPriceSnapshot,
} from "@/lib/db";
import { isAuthorized as checkAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE_URL = "https://www.floraamar.com.br";

const CATEGORY_URLS = [
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
  img: string;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      Referer: BASE_URL + "/",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseProducts(html: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  const blockRegex =
    /<div[^>]*class="item compra_rapida"[^>]*>([\s\S]*?)(?=<div[^>]*class="item compra_rapida"|<\/section|$)/g;

  let blockMatch;
  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[1];
    const titleMatch = block.match(/title="([^"]+)"/);
    const name = titleMatch?.[1] || "";
    const slugMatch = block.match(/href="([a-z0-9][a-z0-9-]*)\/?"/);
    const slug = slugMatch?.[1] || "";
    const imgMatch = block.match(/data-src="(https:\/\/cdn\.sistemawbuy\.com\.br[^"]+)"/);
    const img = (imgMatch?.[1] || "").replace("_mini.", ".");

    let price = 0;
    const compraMatch = block.match(/data-comprarapida="([^"]+)"/);
    if (compraMatch) {
      try {
        const decoded = JSON.parse(Buffer.from(compraMatch[1], "base64").toString("utf-8"));
        if (decoded.variacoes?.[0]?.preco) {
          price = parseFloat(decoded.variacoes[0].preco.valor_venda || decoded.variacoes[0].preco.valor_de || "0");
        }
      } catch {}
    }

    if (name && slug) products.push({ name, price, slug, img });
  }

  return products;
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initSchema();
    const prevPrices = await getScrapedPriceMap();

    const allProducts: ScrapedProduct[] = [];
    const seenSlugs = new Set<string>();
    let scrapeErrors = 0;

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
      } catch {
        scrapeErrors++;
      }
    }

    // CloudFront bloqueia requests de servidor — retorna aviso claro
    if (allProducts.length === 0 && scrapeErrors > 0) {
      return NextResponse.json({
        success: false,
        timestamp: new Date().toISOString(),
        source: BASE_URL,
        count: 0,
        error: "Fornecedor bloqueou acesso remoto (CloudFront). Rode 'npm run scrape' no seu computador para atualizar.",
        scrapeErrors,
      });
    }

    // Conjuntos com price=0: buscar pagina individual
    const conjuntos = allProducts.filter(
      (p) => p.price === 0 && p.name.toLowerCase().startsWith("conjunto")
    );
    for (const p of conjuntos) {
      try {
        const pageHtml = await fetchPage(`${BASE_URL}/${p.slug}/`);
        if (pageHtml.includes("grade_biquini")) {
          let total = 0;
          const opcaoBlocks = pageHtml.split('class="opcao"');
          for (let i = 1; i < opcaoBlocks.length; i++) {
            const valMatch = opcaoBlocks[i].substring(0, 2000).match(/data-valorvenda="(\d+(?:\.\d+)?)"/);
            if (valMatch) total += parseFloat(valMatch[1]);
          }
          if (total > 0) p.price = total;
        }
      } catch {}
    }

    // Salvar e detectar mudancas
    let changesDetected = 0;
    const changes: Array<{ product: string; oldPrice: number; newPrice: number }> = [];

    for (const p of allProducts) {
      await upsertScrapedPrice({ name: p.name, slug: p.slug, price: p.price, img: p.img });
      if (p.price > 0) {
        const prev = prevPrices[p.name];
        if (prev && prev !== p.price) {
          await addPriceChange({ productName: p.name, slug: p.slug, oldValue: prev, newValue: p.price });
          changes.push({ product: p.name, oldPrice: prev, newPrice: p.price });
          changesDetected++;
        }
      }
    }

    const prices = allProducts.filter((p) => p.price > 0).map((p) => p.price);
    if (prices.length > 0) {
      await addPriceSnapshot({
        productCount: prices.length,
        avgPrice: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
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
    return NextResponse.json({ error: error.message || "Scrape failed" }, { status: 500 });
  }
}
