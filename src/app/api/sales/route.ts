import { NextResponse } from "next/server";
import { initSchema, addSale, getSales, getSalesSummary, updateSaleStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== "melfit2024") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initSchema();
  const days = parseInt(searchParams.get("days") || "30");
  const status = searchParams.get("status") || undefined;

  const sales = await getSales(days, status);
  const summary = await getSalesSummary(days);

  return NextResponse.json({ sales, summary });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== "melfit2024") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initSchema();
    const body = await request.json();
    const { productId, quantity, size, unitCost, unitPrice,
            paymentMethod, installments, customerName, customerPhone, notes } = body;

    if (!productId || !unitCost || !unitPrice) {
      return NextResponse.json(
        { error: "productId, unitCost and unitPrice are required" },
        { status: 400 }
      );
    }

    const id = await addSale({
      productId, quantity: quantity || 1, size,
      unitCost, unitPrice, paymentMethod: paymentMethod || "pix",
      installments, customerName, customerPhone, notes,
    });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== "melfit2024") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(searchParams.get("id") || "0");
  const status = searchParams.get("status") || "";

  if (!id || !["pending", "completed", "shipped", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Invalid id or status" }, { status: 400 });
  }

  await initSchema();
  await updateSaleStatus(id, status);
  return NextResponse.json({ success: true });
}
