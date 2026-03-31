import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== "melfit2024") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const historyPath = path.join(process.cwd(), "src", "data", "price-history.json");

  if (!fs.existsSync(historyPath)) {
    return NextResponse.json({
      lastUpdate: null,
      changes: [],
      snapshots: [],
    });
  }

  try {
    const data = JSON.parse(fs.readFileSync(historyPath, "utf-8"));

    // Optional filters
    const product = searchParams.get("product");
    const days = parseInt(searchParams.get("days") || "30");
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let changes = data.changes || [];
    let snapshots = data.snapshots || [];

    // Filter by date
    changes = changes.filter((c: any) => new Date(c.date) >= cutoff);
    snapshots = snapshots.filter((s: any) => new Date(s.date) >= cutoff);

    // Filter by product name
    if (product) {
      changes = changes.filter((c: any) =>
        c.product.toLowerCase().includes(product.toLowerCase())
      );
    }

    return NextResponse.json({
      lastUpdate: data.lastUpdate,
      totalChanges: (data.changes || []).length,
      filteredChanges: changes.length,
      changes,
      snapshots,
    });
  } catch {
    return NextResponse.json({ error: "Failed to read history" }, { status: 500 });
  }
}
