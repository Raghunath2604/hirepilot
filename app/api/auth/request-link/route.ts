import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

const inputSchema = z.object({
  email: z.string().trim().email().max(320),
});

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("AUTH_CONFIG");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = inputSchema.parse(await req.json());
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwarded || req.headers.get("x-real-ip") || "unknown";
    const limit = await enforceRateLimit(`auth:${ip}`, 5, 300);
    if (!limit.success) return NextResponse.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429 });

    const redirectTo = new URL("/auth/callback", req.url).toString();
    const { error } = await client().auth.signInWithOtp({
      email: body.email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) return NextResponse.json({ error: "Unable to send the sign-in link." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (error instanceof Error && error.message === "AUTH_CONFIG") return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
    return NextResponse.json({ error: "Unable to send the sign-in link." }, { status: 400 });
  }
}
