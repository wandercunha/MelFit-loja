import { NextResponse } from "next/server";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Senha admin verificada server-side via SHA-256 hash.
 * Para mudar a senha: gere o hash com:
 *   node -e "console.log(require('crypto').createHash('sha256').update('sua-nova-senha').digest('hex'))"
 * E coloque em ADMIN_PASSWORD_HASH no .env.local
 */
function getAdminHash(): string {
  return process.env.ADMIN_PASSWORD_HASH || "26fed88b7cb618ad902e7bd27655a5c6908c570a5ea0ee7cd9afbc2a7ba03800";
}

function getApiSecret(): string {
  return process.env.API_SECRET || "ac1cf3b3155ba57edb1c501c311840cb131bcc1f343c6aac77e0de3adad7ea3b";
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
