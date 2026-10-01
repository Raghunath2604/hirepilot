import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const store = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    { cookies: {
      getAll: () => store.getAll(),
      setAll(items) { items.forEach(({name,value,options}) => store.set(name,value,options)); },
    }},
  );
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
