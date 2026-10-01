import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getInterview, startRound } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/security";
import { roundSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const user = await requireUser();
    const limit = await enforceRateLimit(`${user.id}:round-start`, 20, 60);
    if (!limit.success) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    const { id } = await ctx.params;
    const interview = await getInterview(id, user.id);
    if (!interview) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    const body = await req.json();
    const round = roundSchema.parse(body?.round);
    await startRound(id, user.id, round);
    return NextResponse.json({ ok: true, round });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (message === "TECHNICAL_ROUND_REQUIRED") return NextResponse.json({ error: "Complete the Technical round first." }, { status: 409 });
    return NextResponse.json({ error: "Unable to start this round." }, { status: 400 });
  }
}
