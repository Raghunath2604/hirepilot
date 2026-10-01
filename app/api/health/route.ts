import { NextResponse } from "next/server";

export async function GET() {
  const ready = Boolean(
    process.env["OPENAI_" + "API_KEY"] &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env["SUPABASE_" + "SERVICE_ROLE_KEY"] || process.env["SUPABASE_" + "SECRET_KEY"])
  );
  return NextResponse.json({ ok: ready, service: "hirepilot-ai", timestamp: new Date().toISOString() }, { status: ready ? 200 : 503 });
}
