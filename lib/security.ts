import crypto from "node:crypto";

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
    const host = req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

    if (host) {
      const protocol = forwardedProto || requestUrl.protocol.replace(":", "");
      return originUrl.protocol === `${protocol}:` && originUrl.host === host;
    }

    return originUrl.origin === requestUrl.origin;
  } catch {
    return false;
  }
}
