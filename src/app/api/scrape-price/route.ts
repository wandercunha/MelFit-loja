import { NextResponse } from "next/server";
import { initSchema, setSetting, getSetting } from "@/lib/db";
import { isAuthorized as checkAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const VAREJO_URL = "https://www.floraamar.com.br";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

/**
 * POST /api/scrape-price
 * Busca preco individual de um produto no varejo e atualiza catalog_varejo_prices no Turso.
 * Body: { productName: "Top Air Verde Militar", slug: "top-air-verde-militar" }
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

    // Buscar pagina do produto no varejo
    const url = `${VAREJO_URL}/${slug}/`;
    const res = await fetch(url, { headers: HEADERS, redirect: "follow" });

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}`, url }, { status: 502 });
    }

    const html = await res.text();
    let price = 0;

    // Tentar data-comprarapida (base64 JSON)
    const b64Match = html.match(/data-comprarapida="([^"]+)"/);
    if (b64Match) {
      try {
        const decoded = JSON.parse(Buffer.from(b64Match[1], "base64").toString("utf-8"));
        const normalize = (s: string) =>
          s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

        // Validar nome — varejo tem bug de retornar dados de outro produto
        // Se nome não bate, ignora data-comprarapida e tenta fallbacks
        const nameMatches = !decoded.nome || normalize(decoded.nome) === normalize(productName);

        if (nameMatches) {
          for (const v of decoded.variacoes || []) {
            const p = parseFloat(v.preco?.valor_venda || v.preco?.valor_de || "0");
            if (p > 0) { price = p; break; }
          }
        }
      } catch {}
    }

    // Fallback: grade_biquini (conjuntos — soma das pecas)
    if (!price && html.includes("grade_biquini")) {
      const valRegex = /data-valorvenda="([^"]+)"/g;
      const pieces = new Set<string>();
      let m;
      while ((m = valRegex.exec(html)) !== null) {
        // Pegar primeiro valor de cada opcao (peca)
        const val = parseFloat(m[1]);
        if (val > 0) {
          // Verificar se é uma nova opcao
          const before = html.substring(Math.max(0, m.index - 500), m.index);
          const opcaoMatch = before.match(/class="[^"]*opcao[^"]*"/g);
          const opcaoKey = opcaoMatch ? opcaoMatch.length.toString() : "0";
          if (!pieces.has(opcaoKey)) {
            pieces.add(opcaoKey);
            price += val;
          }
        }
      }
    }

    // Fallback: JSON-LD
    if (!price) {
      const ldMatch = html.match(/"@type"\s*:\s*"Product"[\s\S]*?"price"\s*:\s*"?(\d+\.?\d*)"?/);
      if (ldMatch) price = parseFloat(ldMatch[1]);
    }

    // Fallback: <title> ou og:title contém "a partir de R$XX,XX" (preço PIX com -15%)
    // Páginas de produto do varejo carregam preço via JS — único dado server-side é o título
    if (!price) {
      const titleMatch = html.match(/a partir de R\$([\d.,]+)/);
      if (titleMatch) {
        const pixPrice = parseFloat(titleMatch[1].replace(".", "").replace(",", "."));
        if (pixPrice > 0) {
          // Reverter desconto PIX de 15% para obter preço cheio
          price = Math.round(pixPrice / 0.85);
        }
      }
    }

    if (price <= 0) {
      return NextResponse.json({ success: false, error: "Preco nao encontrado", url });
    }

    // Atualizar catalog_varejo_prices no Turso
    try {
      const raw = await getSetting("catalog_varejo_prices");
      const prices: Record<string, number> = raw ? JSON.parse(raw) : {};
      prices[productName] = price;
      await setSetting("catalog_varejo_prices", JSON.stringify(prices));
    } catch {}

    return NextResponse.json({
      success: true,
      productName,
      price,
      url,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Scrape failed" }, { status: 500 });
  }
}
