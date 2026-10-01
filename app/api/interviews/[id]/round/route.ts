import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { startRound } from "@/lib/db";
import { roundSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}

function requestIdentifier(req: Request, userId: string) {
  const forwarded = req.headers.get("x-forwarded-for") || "local";
  return `${userId}:${forwarded.split(",")[0]?.trim() || "local"}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });

  try {
    const user = await requireUser();
    const limit = await enforceRateLimit(requestIdentifier(req, user.id));
    if (!limit.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

    const { id } = await params;
    const payload = await req.json();
    const round = roundSchema.parse(payload.round);
    await startRound(id, user.id, round);
    return NextResponse.json({ ok: true, round });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "TECHNICAL_ROUND_REQUIRED" ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
