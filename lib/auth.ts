import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export type AppUser = { id: string; email?: string | null };

export async function getUser(): Promise<AppUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return process.env.ALLOW_DEMO === "true" && process.env.NODE_ENV !== "production"
    ? { id: "demo-user", email: "demo@hirepilot.local" } : null;

  const store = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(items) { try { items.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {} },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}

export async function requireUser() {
  const user = await getUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
