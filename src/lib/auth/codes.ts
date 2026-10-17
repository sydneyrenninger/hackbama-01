import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_PATTERN = /^\d{6}$/;

/** Six digits from a CSPRNG, leading zeros preserved. */
export function generateVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Keyed hash bound to one challenge, so equal codes never share a hash. */
export function hashVerificationCode(pepper: string, challengeId: string, code: string): string {
  return createHmac("sha256", pepper).update(`vc:${challengeId}:${code}`).digest("hex");
}

/** Opaque one-time token that authorizes the final signup step. */
export function generateSignupToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Rate-limit keys never contain raw emails or IPs. */
export function rateLimitKey(pepper: string, scope: string, value: string): string {
  return `${scope}:${createHmac("sha256", pepper).update(`rl:${scope}:${value}`).digest("hex").slice(0, 32)}`;
}

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Cookie value format: "<challengeId>.<token>" */
export function parseSignupCookie(value: string | undefined): { challengeId: string; token: string } | null {
  if (!value) return null;
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(value);
  return m ? { challengeId: m[1], token: m[2] } : null;
}
