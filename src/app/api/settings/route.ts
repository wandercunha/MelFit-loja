import { NextResponse } from "next/server";
import { initSchema, getAllSettings, setSetting } from "@/lib/db";
import { isAuthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET — retorna todas as configurações salvas */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initSchema();
    const settings = await getAllSettings();
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** PUT — salva configurações (recebe objeto { key: value }) */
export async function PUT(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initSchema();
    const body = await request.json();

    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") {
        await setSetting(key, value);
      } else {
        await setSetting(key, JSON.stringify(value));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
