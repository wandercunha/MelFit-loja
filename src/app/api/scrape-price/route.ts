import { NextResponse } from "next/server";
import { initSchema, setSetting, getSetting } from "@/lib/db";
import { isAuthorized as checkAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const VAREJO_URL = "https://www.floraamar.com.br";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

// Palavras significativas (ignora artigos/preposições)
const STOP = new Set(["e", "de", "do", "da", "c", "com", "no", "na", "em"]);
function keywords(s: string): string[] {
  return normalize(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w));
}

function wordScore(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  return a.filter((w) => setB.has(w)).length / Math.max(a.length, b.length);
}

/** Extrai preço de um HTML de produto individual */
function extractPriceFromPage(html: string, expectedName: string): number {
  // 1. data-comprarapida (base64 JSON) — validar nome
  const b64Match = html.match(/data-comprarapida="([^"]+)"/);
  if (b64Match) {
    try {
      const decoded = JSON.parse(Buffer.from(b64Match[1], "base64").toString("utf-8"));
      const nameOk = !decoded.nome || normalize(decoded.nome) === normalize(expectedName);
      if (nameOk) {
        for (const v of decoded.variacoes || []) {
          const p = parseFloat(v.preco?.valor_venda || v.preco?.valor_de || "0");
          if (p > 0) return p;
        }
      }
    } catch {}
  }

  // 2. grade_biquini (conjuntos — soma das peças: pegar primeiro preço de cada opcao)
  if (html.includes("grade_biquini")) {
    let price = 0;
    // Contar quantas <div class="opcao aparecem ANTES de cada data-valorvenda
    // para saber de qual peça é o preço
    const seen = new Set<number>();
    const valRegex = /data-valorvenda="([^"]+)"/g;
    const gradeStart = html.indexOf("grade_biquini");
    let m;
    while ((m = valRegex.exec(html)) !== null) {
      if (m.index < gradeStart) continue;
      const val = parseFloat(m[1]);
      if (val > 0) {
        // Contar opcoes abertas até este ponto
        const section = html.substring(gradeStart, m.index);
        const opcaoCount = (section.match(/class="[^"]*\bopcao\b/g) || []).length;
        if (!seen.has(opcaoCount)) {
          seen.add(opcaoCount);
          price += val;
        }
      }
    }
    if (price > 0) return price;
  }

  // 3. JSON-LD
  const ldMatch = html.match(/"@type"\s*:\s*"Product"[\s\S]*?"price"\s*:\s*"?(\d+\.?\d*)"?/);
  if (ldMatch) { const p = parseFloat(ldMatch[1]); if (p > 0) return p; }

  // 4. <title> "a partir de R$XX,XX" (preço PIX -15%)
  const titleMatch = html.match(/a partir de R\$([\d.,]+)/);
  if (titleMatch) {
    const pix = parseFloat(titleMatch[1].replace(".", "").replace(",", "."));
    if (pix > 0) return Math.round(pix / 0.85);
  }

  return 0;
}

/** Busca por palavras-chave no varejo e retorna melhor match */
async function searchVarejo(productName: string): Promise<{ price: number; matchedName: string; slug: string } | null> {
  const kw = keywords(productName);
  // Para busca: tipo do produto + cor/modelo (ex: "conjunto cereja", "top cross preto")
  const tipo = kw.find((w) => ["conjunto", "top", "short", "legging", "macaquinho", "macacao"].includes(w)) || "";
  const extra = new Set(["conjunto", "top", "short", "legging", "macaquinho", "macacao", "basic", "duplo", "saia"]);
  const descriptive = kw.filter((w) => !extra.has(w));
  const searchTerms = [tipo, ...descriptive].filter(Boolean).slice(0, 4).join("+");
  const searchUrl = `${VAREJO_URL}/busca/?q=${encodeURIComponent(searchTerms)}`;

  const res = await fetch(searchUrl, { headers: HEADERS, redirect: "follow" });
  if (!res.ok) return null;

  const html = await res.text();

  // Extrair produtos dos resultados (mesmo parser das listagens)
  const results: Array<{ name: string; price: number; slug: string }> = [];
  const blockRegex = /class="item compra_rapida"[^>]*>([\s\S]*?)(?=class="item compra_rapida"|<\/section|$)/g;
  let block;
  while ((block = blockRegex.exec(html)) !== null) {
    const content = block[1];
    const titleMatch = content.match(/title="([^"]+)"/);
    const slugMatch = content.match(/href="([a-z0-9][a-z0-9-]*)\/?"/);
    const priceMatch = content.match(/class="valor_final"[^>]*><span>R\$([\d.,]+)/);
    if (titleMatch && priceMatch) {
      const p = parseFloat(priceMatch[1].replace(".", "").replace(",", "."));
      if (p > 0) {
        results.push({
          name: titleMatch[1],
          price: p,
          slug: slugMatch?.[1] || "",
        });
      }
    }
  }

  if (results.length === 0) return null;

  // Encontrar melhor match por palavras-chave (ignorar biquínis/moda praia)
  const ignore = ["biquini", "bikini", "calcinha", "praia", "asa delta", "cortininha", "tomara que caia"];
  const targetKw = keywords(productName);
  let best: { score: number; result: (typeof results)[0] } | null = null;

  for (const r of results) {
    const rNorm = normalize(r.name);
    if (ignore.some((i) => rNorm.includes(i))) continue;
    const score = wordScore(targetKw, keywords(r.name));
    if (score >= 0.5 && (!best || score > best.score)) {
      best = { score, result: r };
    }
  }

  return best ? { price: best.result.price, matchedName: best.result.name, slug: best.result.slug } : null;
}

/**
 * POST /api/scrape-price
 * Busca preco individual de um produto no varejo e atualiza catalog_varejo_prices no Turso.
 * Body: { productName: "Top Air Verde Militar", slug: "top-air-verde-militar" }
 *
 * Estratégia:
 * 1. Tenta URL direta (/slug/)
 * 2. Se falhar, busca por palavras-chave (/busca/?q=...)
 */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { productName, slug } = await request.json();
    if (!productName || !slug) {
      return NextResponse.json({ error: "productName and slug required" }, { status: 400 });
    }

    await initSchema();

    let price = 0;
    let method = "";
    let matchedUrl = "";

    // === Tentativa 1: URL direta ===
    const directUrl = `${VAREJO_URL}/${slug}/`;
    try {
      const res = await fetch(directUrl, { headers: HEADERS, redirect: "follow" });
      if (res.ok) {
        const html = await res.text();
        price = extractPriceFromPage(html, productName);
        if (price > 0) {
          method = "url-direta";
          matchedUrl = directUrl;
        }
      }
    } catch {}

    // === Tentativa 2: Busca por palavras-chave ===
    if (price <= 0) {
      try {
        const found = await searchVarejo(productName);
        if (found) {
          price = found.price;
          method = `busca (${found.matchedName})`;
          matchedUrl = `${VAREJO_URL}/${found.slug}/`;
        }
      } catch {}
    }

    if (price <= 0) {
      return NextResponse.json({ success: false, error: "Preco nao encontrado", url: directUrl });
    }

    // Atualizar catalog_varejo_prices no Turso
    try {
      const raw = await getSetting("catalog_varejo_prices");
      const prices: Record<string, number> = raw ? JSON.parse(raw) : {};
      prices[productName] = price;
      await setSetting("catalog_varejo_prices", JSON.stringify(prices));
    } catch {}

    // Atualizar slug price map também
    try {
      const raw = await getSetting("catalog_varejo_slug_prices");
      const slugPrices: Record<string, number> = raw ? JSON.parse(raw) : {};
      slugPrices[slug] = price;
      await setSetting("catalog_varejo_slug_prices", JSON.stringify(slugPrices));
    } catch {}

    return NextResponse.json({
      success: true,
      productName,
      price,
      method,
      url: matchedUrl,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Scrape failed" }, { status: 500 });
  }
}
