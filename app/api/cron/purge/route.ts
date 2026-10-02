import { NextResponse } from "next/server";
import { purgeOldData } from "@/lib/db";
import { safeCompareSecret } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expected = process.env.CRON_SECRET;
  if (!safeCompareSecret(supplied, expected)) return new Response("Unauthorized", { status: 401 });

  const retentionDays = Number(process.env.RETENTION_DAYS || 30);
  if (!Number.isFinite(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
    return NextResponse.json({ error: "Invalid retention configuration." }, { status: 500 });
  }

  await purgeOldData(retentionDays);
  return NextResponse.json({ ok: true });
}
