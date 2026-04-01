import { NextResponse } from "next/server";
import {
  initSchema,
  createOrder,
  addOrderItem,
  getOrders,
  getOrdersSummary,
  updateOrderStatus,
} from "@/lib/db";
import { isAuthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// ── Rate limiting simples por IP ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minuto
const RATE_LIMIT_MAX = 5; // max 5 pedidos/minuto por IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function getClientIP(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

// ── Validação ──
function sanitize(s: unknown, maxLen = 200): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  if (!email) return true; // opcional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  if (!phone) return true; // opcional
  return /^[\d\s()+-]{8,20}$/.test(phone);
}

/** POST — público. Chamado pelo carrinho ao enviar pedido via WhatsApp. */
export async function POST(request: Request) {
  try {
    // Rate limit
    const ip = getClientIP(request);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Muitos pedidos em pouco tempo. Aguarde um momento." },
        { status: 429 }
      );
    }

    await initSchema();
    const body = await request.json();
    const { cartId, customer, items, paymentMethod, installments, totalPrice } = body;

    // Validação
    if (!cartId || typeof cartId !== "string") {
      return NextResponse.json({ error: "cartId invalido" }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0 || items.length > 50) {
      return NextResponse.json({ error: "items invalido (1-50 itens)" }, { status: 400 });
    }

    const customerName = sanitize(customer?.name, 100);
    const customerPhone = sanitize(customer?.phone, 20);
    const customerEmail = sanitize(customer?.email, 100);

    if (!isValidEmail(customerEmail)) {
      return NextResponse.json({ error: "Email invalido" }, { status: 400 });
    }
    if (!isValidPhone(customerPhone)) {
      return NextResponse.json({ error: "Telefone invalido" }, { status: 400 });
    }

    const validPayments = ["pix", "credito_parcelado"];
    const pm = validPayments.includes(paymentMethod) ? paymentMethod : "pix";

    await createOrder({
      id: sanitize(cartId, 50),
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      customerEmail: customerEmail || undefined,
      paymentMethod: pm,
      installments: Math.min(Math.max(1, Number(installments) || 1), 12),
      totalPrice: Math.max(0, Number(totalPrice) || 0),
    });

    for (const item of items) {
      await addOrderItem({
        orderId: sanitize(cartId, 50),
        productId: Number(item.productId) || 0,
        productName: sanitize(item.name, 100),
        quantity: Math.min(Math.max(1, Number(item.quantity) || 1), 99),
        size: sanitize(item.size, 10) || undefined,
        unitCost: Math.max(0, Number(item.unitCost) || 0),
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
        paymentMethod: pm,
        installments: Math.min(Math.max(1, Number(installments) || 1), 12),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
      });
    }

    return NextResponse.json({ success: true, orderId: cartId });
  } catch (error: any) {
    console.error("[ORDERS] Erro ao criar pedido:", error.message);
    return NextResponse.json({ error: "Erro ao processar pedido" }, { status: 500 });
  }
}

/** GET — protegido. Usado pelo painel admin. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initSchema();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "60");
    const status = searchParams.get("status") || undefined;

    const orders = await getOrders(days, status);
    const summary = await getOrdersSummary(days);

    return NextResponse.json({ orders, summary });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** PATCH — protegido. Atualiza status de um pedido. */
export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const status = searchParams.get("status") || "";

    if (!id || !["pending", "completed", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "id ou status inválido" }, { status: 400 });
    }

    await initSchema();
    await updateOrderStatus(id, status);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
