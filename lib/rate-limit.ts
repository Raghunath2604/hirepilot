import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let limiter: Ratelimit | null = null;

function getLimiter() {
  if (limiter) return limiter;
  const url = process.env["UPSTASH_" + "REDIS_REST_URL"];
  const token = process.env["UPSTASH_" + "REDIS_REST_TOKEN"];
  if (!url || !token) return null;
  const redis = new Redis({ url, token });
  limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "60 s"),
    analytics: true,
    prefix: "hirepilot"
  });
  return limiter;
}

export async function enforceRateLimit(identifier: string) {
  if (process.env.NODE_ENV !== "production") return { success: true, remaining: 999 };
  const l = getLimiter();
  if (!l) return { success: true, remaining: 999, degraded: true };
  const result = await l.limit(identifier);
  return { success: result.success, remaining: result.remaining };
}
