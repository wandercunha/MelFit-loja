import { NextResponse } from "next/server";
import { initSchema, getCatalogData } from "@/lib/db";

/**
 * GET /api/catalog-data
 * Endpoint PUBLICO — retorna estoque atacado e precos varejo do banco.
 * Usado pelo app em runtime para dados atualizados sem precisar de redeploy.
 */
export async function GET() {
  try {
    await initSchema();
    const data = await getCatalogData();

    if (!data.atacado) {
      return NextResponse.json({ source: "none" }, { status: 404 });
    }

    // SQLite datetime('now') retorna sem timezone — normalizar para UTC ISO
    const updatedAt = data.updatedAt && !data.updatedAt.endsWith("Z")
      ? data.updatedAt.replace(" ", "T") + "Z"
      : data.updatedAt;

    return NextResponse.json({
      source: "turso",
      updatedAt,
      atacado: data.atacado,
      varejoPrecos: data.varejoPrecos,
      productInfo: data.productInfo,
    }, {
      headers: {
        // Cache por 5 minutos no CDN, stale-while-revalidate por 1 hora
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("catalog-data GET error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
