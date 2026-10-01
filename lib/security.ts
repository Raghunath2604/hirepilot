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
