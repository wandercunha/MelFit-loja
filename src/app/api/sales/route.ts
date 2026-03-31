import { NextResponse } from "next/server";
import { addSale, getSales, getSalesSummary, updateSaleStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/sales?secret=melfit2024&days=30&status=completed
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== "melfit2024") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = parseInt(searchParams.get("days") || "30");
  const status = searchParams.get("status") || undefined;

  const sales = getSales(days, status);
  const summary = getSalesSummary(days);

  return NextResponse.json({ sales, summary });
}

// POST /api/sales - registrar nova venda
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== "melfit2024") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const { productId, quantity, size, unitCost, unitPrice,
            paymentMethod, installments, customerName, customerPhone, notes } = body;

    if (!productId || !unitCost || !unitPrice) {
      return NextResponse.json(
        { error: "productId, unitCost and unitPrice are required" },
        { status: 400 }
      );
    }

    const id = addSale({
      productId,
      quantity: quantity || 1,
      size,
      unitCost,
      unitPrice,
      paymentMethod: paymentMethod || "pix",
      installments,
      customerName,
      customerPhone,
      notes,
    });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to add sale" },
      { status: 500 }
    );
  }
}

// PATCH /api/sales?id=1&status=completed
export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== "melfit2024") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(searchParams.get("id") || "0");
  const status = searchParams.get("status") || "";

  if (!id || !status) {
    return NextResponse.json(
      { error: "id and status are required" },
      { status: 400 }
    );
  }

  const validStatuses = ["pending", "completed", "shipped", "cancelled"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  updateSaleStatus(id, status);
  return NextResponse.json({ success: true });
}
