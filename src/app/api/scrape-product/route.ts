import { NextResponse } from "next/server";
import { initSchema, setSetting, getSetting } from "@/lib/db";
import { isAuthorized as checkAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ATACADO_CDN = "97065044c3a1a212e5c7a4f183fed028";

/**
 * POST /api/scrape-product
 * Scrape individual de um produto do atacado por slug.
 * Body: { atacadoSlug: "short-run-preto-at" }
 * Retorna dados do produto e atualiza o catalog_atacado_data no Turso.
 */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { atacadoSlug } = await request.json();
    if (!atacadoSlug) {
      return NextResponse.json({ error: "atacadoSlug required" }, { status: 400 });
    }

    await initSchema();

    const url = `https://www.floraamaratacado.com.br/${atacadoSlug}/`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });
    }

    const html = await res.text();
    if (html.length < 3000) {
      return NextResponse.json({ error: "Pagina bloqueada ou nao encontrada" }, { status: 404 });
    }

    // Parse com regex simples (sem cheerio no server)
    const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const name = nameMatch?.[1]?.trim() || atacadoSlug;

    // Imagens do CDN atacado
    const imgRegex = new RegExp(`(?:src|data-src)="(https://cdn\\.sistemawbuy\\.com\\.br/arquivos/${ATACADO_CDN}/produtos/[^"]+)"`, "g");
    const images: string[] = [];
    let folder = "";
    let m;
    while ((m = imgRegex.exec(html)) !== null) {
      const src = m[1].replace("_mini.", ".");
      if (!src.includes("template") && !images.includes(src)) {
        images.push(src);
        if (!folder) {
          const fm = src.match(/\/produtos\/([^/]+)\//);
          if (fm) folder = fm[1];
        }
      }
    }

    // Stock e preço do data-comprarapida
    const stock: Record<string, number> = {};
    let totalStock = 0;
    let price = 0;
    const b64Match = html.match(/data-comprarapida="([^"]+)"/);
    if (b64Match) {
      try {
        const decoded = JSON.parse(Buffer.from(b64Match[1], "base64").toString("utf-8"));
        for (const v of decoded.variacoes || []) {
          const sizeName = v.atributos?.tamanho?.nome || "U";
          const qty = parseInt(v.estoque || "0");
          stock[sizeName] = qty;
          totalStock += qty;
          if (!price) price = parseFloat(v.preco?.valor_venda || "0");
        }
      } catch {}
    }

    // Peças do conjunto (grade_biquini)
    const pieces: Array<{ name: string; sizes: Record<string, number>; price: number }> = [];
    if (html.includes("grade_biquini")) {
      const opcaoRegex = /<div[^>]*class="[^"]*opcao[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*opcao|<\/div>\s*<\/div>\s*$)/g;
      let om;
      while ((om = opcaoRegex.exec(html)) !== null) {
        const block = om[1];
        const titleMatch = block.match(/<(?:h[1-6]|p|span|div|label|strong)[^>]*>([^<]{3,})/);
        const pieceName = titleMatch?.[1]?.trim() || "";
        const pieceSizes: Record<string, number> = {};
        let piecePrice = 0;
        const itemRegex = /data-variacaovalor="([^"]+)"[^>]*data-valorvenda="([^"]+)"/g;
        let im;
        while ((im = itemRegex.exec(block)) !== null) {
          pieceSizes[im[1]] = parseFloat(im[2]);
          if (!piecePrice) piecePrice = parseFloat(im[2]);
        }
        if (pieceName && Object.keys(pieceSizes).length > 0) {
          pieces.push({ name: pieceName, sizes: pieceSizes, price: piecePrice });
        }
      }
    }

    const baseSlug = atacadoSlug.replace(/-at$/, "");
    const productData = {
      name,
      atacadoSlug,
      images,
      stock,
      totalStock,
      price: pieces.length > 0 ? pieces.reduce((s, p) => s + p.price, 0) : price,
      folder,
      ...(pieces.length > 0 ? { pieces } : {}),
    };

    // Atualizar catalog_atacado_data no Turso
    try {
      const raw = await getSetting("catalog_atacado_data");
      if (raw) {
        const data = JSON.parse(raw);
        const products = data.products || data;
        products[baseSlug] = productData;
        data.products = products;
        data.timestamp = new Date().toISOString();
        await setSetting("catalog_atacado_data", JSON.stringify(data));
      }
    } catch {}

    return NextResponse.json({
      success: true,
      slug: baseSlug,
      product: productData,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Scrape failed" }, { status: 500 });
  }
}
