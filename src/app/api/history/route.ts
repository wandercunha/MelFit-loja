import { NextResponse } from "next/server";
import { getPriceHistory, getPriceSnapshots } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== "melfit2024") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const days = parseInt(searchParams.get("days") || "30");
    const product = searchParams.get("product") || undefined;

    const changes = getPriceHistory(days, product);
    const snapshots = getPriceSnapshots(days);

    return NextResponse.json({
      lastUpdate: changes.length > 0 ? (changes[0] as any).created_at : null,
      totalChanges: changes.length,
      filteredChanges: changes.length,
      changes: changes.map((c: any) => ({
        date: c.created_at,
        product: c.product_name,
        slug: c.slug,
        field: c.field,
        oldValue: c.old_value,
        newValue: c.new_value,
      })),
      snapshots: snapshots.map((s: any) => ({
        date: s.created_at,
        productCount: s.product_count,
        avgPrice: s.avg_price,
        minPrice: s.min_price,
        maxPrice: s.max_price,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to read history" },
      { status: 500 }
    );
  }
}
