import { NextResponse } from "next/server";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Senha admin verificada server-side.
 * Hash SHA-256 — a senha plain text nunca vai pro bundle JS do browser.
 * Para mudar a senha: gere o hash com:
 *   node -e "console.log(require('crypto').createHash('sha256').update('sua-nova-senha').digest('hex'))"
 * E coloque em ADMIN_PASSWORD_HASH no .env.local
 */
const DEFAULT_HASH = createHash("sha256").update("flora2024").digest("hex");

function getAdminHash(): string {
  return process.env.ADMIN_PASSWORD_HASH || DEFAULT_HASH;
}

function getApiSecret(): string {
  return process.env.API_SECRET || "melfit2024";
}

export async function POST(request: Request) {
  try {
    const { user, pass } = await request.json();

    if (!user || !pass) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    const inputHash = createHash("sha256").update(pass).digest("hex");
    const validHash = getAdminHash();

    if (user === "admin" && inputHash === validHash) {
      // Return a session token (hash of hash + timestamp, valid for 24h)
      const expiry = Date.now() + 24 * 60 * 60 * 1000;
      const token = createHash("sha256")
        .update(`${validHash}:${expiry}`)
        .digest("hex");

      return NextResponse.json({
        success: true,
        token,
        expiry,
        apiSecret: getApiSecret(),
      });
    }

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// Verify token (used by other API routes)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const expiry = parseInt(searchParams.get("expiry") || "0");

  if (!token || !expiry || Date.now() > expiry) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  const validHash = getAdminHash();
  const expectedToken = createHash("sha256")
    .update(`${validHash}:${expiry}`)
    .digest("hex");

  return NextResponse.json({ valid: token === expectedToken });
}
