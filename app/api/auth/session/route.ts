import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
export const runtime = "nodejs";
export async function GET() {
  const user = await getUser();
  return NextResponse.json({ authenticated: Boolean(user), email: user?.email ?? null }, { headers: { "Cache-Control": "no-store" } });
}
