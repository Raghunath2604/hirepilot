import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let limiter: Ratelimit | null = null;
const localBuckets = new Map<string, { count: number; resetAt: number }>();

function getLimiter() {
  const url = process.env["UPSTASH_" + "REDIS_REST_URL"];
  const token = process.env["UPSTASH_" + "REDIS_REST_TOKEN"];
  if (!url || !token) return null;
  if (limiter) return limiter;
  const redis = new Redis({ url, token });
  limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "60 s"),
    analytics: false,
    prefix: "hirepilot",
  });
  return limiter;
}

function localLimit(identifier: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const current = localBuckets.get(identifier);
  if (!current || current.resetAt <= now) {
    localBuckets.set(identifier, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { success: true, remaining: Math.max(0, limit - 1), degraded: true };
  }
  current.count += 1;
  return { success: current.count <= limit, remaining: Math.max(0, limit - current.count), degraded: true };
}

export async function enforceRateLimit(identifier: string, limit = 30, windowSeconds = 60) {
  const configured = Boolean(
    process.env["UPSTASH_" + "REDIS_REST_URL"] &&
    process.env["UPSTASH_" + "REDIS_REST_TOKEN"],
  );
  if (process.env.NODE_ENV !== "production") return { success: true, remaining: 999, degraded: !configured };
  const distributed = getLimiter();
  if (!distributed) return localLimit(identifier, limit, windowSeconds);
  const result = await distributed.limit(identifier);
  return { success: result.success, remaining: result.remaining, degraded: false };
}
