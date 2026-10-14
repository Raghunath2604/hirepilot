import crypto from "node:crypto";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function stableSafetyIdentifier(userId: string) {
  const secret = process.env["OPENAI_" + "SAFETY_HMAC_SECRET"] || "development-only";
  return crypto.createHmac("sha256", secret).update(userId).digest("hex");
}

export function safeCompareSecret(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const host = req.headers.get("host");
    if (!host) return false;

    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const requestUrl = new URL(req.url);
    const requestProtocol = forwardedProto || requestUrl.protocol.replace(":", "");

    if (originUrl.origin === `${requestProtocol}://${host}`) return true;

    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (configuredAppUrl && originUrl.origin === new URL(configuredAppUrl).origin) return true;

    if (LOOPBACK_HOSTS.has(originUrl.hostname) && originUrl.host === host) return true;

    return false;
  } catch {
    return false;
  }
}
