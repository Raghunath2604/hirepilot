import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const limiters = new Map<string, Ratelimit>();
const localBuckets = new Map<string, { count: number; resetAt: number }>();

function getLimiter(limit: number, windowSeconds: number) {
  const url = process.env["UPSTASH_" + "REDIS_REST_URL"];
  const token = process.env["UPSTASH_" + "REDIS_REST_TOKEN"];
  if (!url || !token) return null;

  const cacheKey = `${limit}:${windowSeconds}`;
  const existing = limiters.get(cacheKey);
  if (existing) return existing;

  const redis = new Redis({ url, token });
  const created = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    analytics: false,
    prefix: `hirepilot:${cacheKey}`,
  });
  limiters.set(cacheKey, created);
  return created;
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

  const distributed = getLimiter(limit, windowSeconds);
  if (!distributed) return localLimit(identifier, limit, windowSeconds);

  const result = await distributed.limit(identifier);
  return { success: result.success, remaining: result.remaining, degraded: false };
}
