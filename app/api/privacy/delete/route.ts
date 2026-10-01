import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteUserData } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function requestIdentifier(req: Request, userId: string) {
  const forwarded = req.headers.get("x-forwarded-for") || "local";
  return `${userId}:${forwarded.split(",")[0]?.trim() || "local"}`;
}

async function remove(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return new Response("Invalid origin", { status: 403 });

  try {
    const user = await requireUser();
    const limit = await enforceRateLimit(requestIdentifier(req, user.id));
    if (!limit.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

    await deleteUserData(user.id);
    return NextResponse.json({ deleted: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Deletion failed";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function POST(req: Request) {
  return remove(req);
}

export async function DELETE(req: Request) {
  return remove(req);
}
