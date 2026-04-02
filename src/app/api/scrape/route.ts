import { NextResponse } from "next/server";
import {
  initSchema,
  getScrapedPriceMap,
  upsertScrapedPrice,
  addPriceChange,
  addPriceSnapshot,
  saveCatalogData,
  setSetting,
} from "@/lib/db";
import { isAuthorized as checkAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby max

// ─── URLs ───
const VAREJO_URL = "https://www.floraamar.com.br";
const ATACADO_URL = "https://www.floraamaratacado.com.br";
const ATACADO_CDN = "97065044c3a1a212e5c7a4f183fed028";

const VAREJO_CATEGORIES = [
  { url: "/tops/", label: "Tops" },
  { url: "/shorts/", label: "Shorts" },
  { url: "/leggings/", label: "Leggings" },
  { url: "/macaquinhos/", label: "Macaquinhos" },
  { url: "/macacao/", label: "Macacoes" },
  { url: "/conjuntos/", label: "Conjuntos" },
];

const ATACADO_CATEGORIES = [
  { url: "/pecas-avulsas/tops/", label: "tops" },
  { url: "/pecas-avulsas/shorts/", label: "shorts" },
  { url: "/pecas-avulsas/leggings/", label: "leggings" },
  { url: "/pecas-avulsas/macaquinhos/", label: "macaquinhos" },
  { url: "/pecas-avulsas/macacao/", label: "macacoes" },
  { url: "/conjuntos/", label: "conjuntos" },
  { url: "/colecao-exclusiva/", label: "colecao-exclusiva" },
  { url: "/novidade/", label: "novidade" },
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

async function fetchPage(url: string, referer: string): Promise<string> {
  const res = await fetch(url, {
    headers: { ...HEADERS, Referer: referer + "/" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ─── Parser genérico (funciona para varejo e atacado) ───
function parseListingProducts(html: string, cdn?: string) {
  const products: Array<{
    name: string;
    slug: string;
    price: number;
    img: string;
    stock: Record<string, number>;
    totalStock: number;
    folder: string;
  }> = [];

  const blockRegex =
    /<div[^>]*class="item compra_rapida"[^>]*>([\s\S]*?)(?=<div[^>]*class="item compra_rapida"|<\/section|$)/g;

  let blockMatch;
  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[1];
    const titleMatch = block.match(/title="([^"]+)"/);
    const name = titleMatch?.[1] || "";
    const slugMatch = block.match(/href="([a-z0-9][a-z0-9-]*)\/?"/);
    const slug = slugMatch?.[1] || "";

    // Imagem (somente do CDN especificado, se fornecido)
    let img = "";
    const imgRegex = /data-src="(https:\/\/cdn\.sistemawbuy\.com\.br[^"]+)"/g;
    let imgMatch;
    const images: string[] = [];
    let folder = "";
    while ((imgMatch = imgRegex.exec(block)) !== null) {
      const src = imgMatch[1];
      if (!cdn || src.includes(cdn)) {
        const fullSize = src.replace("_mini.", ".");
        if (!images.includes(fullSize)) images.push(fullSize);
        if (!img) img = fullSize;
        const folderMatch = src.match(/\/produtos\/([^/]+)\//);
        if (folderMatch && !folder) folder = folderMatch[1];
      }
    }

    // Preço e estoque do data-comprarapida
    let price = 0;
    const stock: Record<string, number> = {};
    let totalStock = 0;
    const compraMatch = block.match(/data-comprarapida="([^"]+)"/);
    if (compraMatch) {
      try {
        const decoded = JSON.parse(Buffer.from(compraMatch[1], "base64").toString("utf-8"));
        for (const v of decoded.variacoes || []) {
          const sizeName = v.atributos?.tamanho?.nome || "U";
          const qty = parseInt(v.estoque || "0");
          stock[sizeName] = qty;
          totalStock += qty;
          if (!price) price = parseFloat(v.preco?.valor_venda || v.preco?.valor_de || "0");
        }
      } catch {}
    }

    if (name && slug) {
      products.push({ name, slug, price, img, stock, totalStock, folder });
    }
  }

  return products;
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initSchema();

    const log: string[] = [];
    const addLog = (msg: string) => { log.push(msg); console.log(`[SCRAPE] ${msg}`); };

    // ═══════════════════════════════════════════
    // FASE 1: Atacado — estoque + imagens
    // ═══════════════════════════════════════════
    addLog("Fase 1: Scraping atacado...");
    const atacadoMap: Record<string, any> = {};
    let atacadoErrors = 0;

    for (const cat of ATACADO_CATEGORIES) {
      try {
        const html = await fetchPage(`${ATACADO_URL}${cat.url}`, ATACADO_URL);
        const products = parseListingProducts(html, ATACADO_CDN);
        let added = 0;
        for (const p of products) {
          const baseSlug = p.slug.replace(/-at$/, "");
          if (!atacadoMap[baseSlug]) {
            atacadoMap[baseSlug] = {
              name: p.name,
              atacadoSlug: p.slug,
              images: [p.img].filter(Boolean),
              stock: p.stock,
              totalStock: p.totalStock,
              price: p.price,
              folder: p.folder,
            };
            added++;
          }
        }
        addLog(`  ${cat.label}: ${products.length} produtos, ${added} novos`);
      } catch (err: any) {
        atacadoErrors++;
        addLog(`  ${cat.label}: ERRO - ${err.message || err}`);
      }
    }

    const atacadoCount = Object.keys(atacadoMap).length;
    addLog(`  Total atacado: ${atacadoCount} produtos`);

    // Salvar dados do atacado no Turso
    if (atacadoCount > 0) {
      const atacadoData = {
        timestamp: new Date().toISOString(),
        source: "floraamaratacado.com.br",
        cdn: ATACADO_CDN,
        count: atacadoCount,
        products: atacadoMap,
      };
      await saveCatalogData(atacadoData);
      addLog(`  Atacado salvo no Turso (${atacadoCount} produtos)`);
    }

    // ═══════════════════════════════════════════
    // FASE 2: Varejo — preços de referência
    // ═══════════════════════════════════════════
    addLog("Fase 2: Scraping varejo (precos)...");
    const prevPrices = await getScrapedPriceMap();
    const allVarejo: Array<{ name: string; price: number; slug: string }> = [];
    const seenSlugs = new Set<string>();
    let varejoErrors = 0;

    for (const cat of VAREJO_CATEGORIES) {
      try {
        const html = await fetchPage(`${VAREJO_URL}${cat.url}`, VAREJO_URL);
        const products = parseListingProducts(html);
        let added = 0;
        for (const p of products) {
          if (!seenSlugs.has(p.slug)) {
            seenSlugs.add(p.slug);
            allVarejo.push({ name: p.name, price: p.price, slug: p.slug });
            added++;
          }
        }
        addLog(`  ${cat.label}: ${products.length} produtos, ${added} novos`);
      } catch (err: any) {
        varejoErrors++;
        addLog(`  ${cat.label}: ERRO - ${err.message || err}`);
      }
    }

    addLog(`  Total varejo: ${allVarejo.length} produtos`);

    // Salvar preços e detectar mudanças
    let changesDetected = 0;
    const changes: Array<{ product: string; oldPrice: number; newPrice: number }> = [];
    const priceMap: Record<string, number> = {};

    for (const p of allVarejo) {
      await upsertScrapedPrice({ name: p.name, slug: p.slug, price: p.price, img: "" });
      if (p.price > 0) {
        priceMap[p.name] = p.price;
        const prev = prevPrices[p.name];
        if (prev && prev !== p.price) {
          await addPriceChange({ productName: p.name, slug: p.slug, oldValue: prev, newValue: p.price });
          changes.push({ product: p.name, oldPrice: prev, newPrice: p.price });
          changesDetected++;
        }
      }
    }

    // Salvar mapa de preços no Turso
    if (Object.keys(priceMap).length > 0) {
      await setSetting("catalog_varejo_prices", JSON.stringify(priceMap));
      addLog(`  Precos salvos no Turso (${Object.keys(priceMap).length})`);
    }

    // Snapshot de preços
    const prices = allVarejo.filter((p) => p.price > 0).map((p) => p.price);
    if (prices.length > 0) {
      await addPriceSnapshot({
        productCount: prices.length,
        avgPrice: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
      });
    }

    // ═══════════════════════════════════════════
    // Resultado
    // ═══════════════════════════════════════════
    const blocked = atacadoCount === 0 && allVarejo.length === 0;

    return NextResponse.json({
      success: !blocked,
      timestamp: new Date().toISOString(),
      atacado: {
        count: atacadoCount,
        errors: atacadoErrors,
        withStock: Object.values(atacadoMap).filter((p: any) => p.totalStock > 0).length,
      },
      varejo: {
        count: allVarejo.length,
        errors: varejoErrors,
        pricesTracked: prices.length,
        changesDetected,
        changes,
      },
      log,
      ...(blocked ? {
        error: "Fornecedor bloqueou acesso remoto (CloudFront). Rode 'npm run scrape:all' no seu computador.",
      } : {}),
    });
  } catch (error: any) {
    console.error("Scrape error:", error);
    return NextResponse.json({ error: error.message || "Scrape failed" }, { status: 500 });
  }
}
