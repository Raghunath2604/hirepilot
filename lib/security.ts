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
    const requestUrl = new URL(req.url);

    if (process.env.NODE_ENV !== "production") {
      const requestHost = requestUrl.hostname;
      return (
        originUrl.protocol === requestUrl.protocol &&
        LOOPBACK_HOSTS.has(originUrl.hostname) &&
        LOOPBACK_HOSTS.has(requestHost) &&
        originUrl.port === requestUrl.port
      );
    }

    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (configuredAppUrl) {
      const configuredOrigin = new URL(configuredAppUrl).origin;
      return originUrl.origin === configuredOrigin;
    }

    const host = req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (!host) return originUrl.origin === requestUrl.origin;

    const protocol = forwardedProto || requestUrl.protocol.replace(":", "");
    const expectedOrigin = `${protocol}://${host}`;
    return originUrl.origin === expectedOrigin;
  } catch {
    return false;
  }
}
