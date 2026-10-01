import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getInterview } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function requestIdentifier(req: Request, userId: string) {
  const forwarded = req.headers.get("x-forwarded-for") || "local";
  return `${userId}:${forwarded.split(",")[0]?.trim() || "local"}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const limit = await enforceRateLimit(requestIdentifier(req, user.id));
    if (!limit.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    const { id } = await params;
    const interview = await getInterview(id, user.id);
    if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    return NextResponse.json({ interview });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
