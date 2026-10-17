import "server-only";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";

/** CSRF defence for JSON route handlers: require a same-origin Origin header. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host && o.host === host) return true;
    return o.origin === new URL(serverEnv().appUrl).origin;
  } catch {
    return false;
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

export function jsonOk(body: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...body }, { headers: { "Cache-Control": "no-store" } });
}

export async function readJson(req: Request): Promise<unknown> {
  if (!req.headers.get("content-type")?.includes("application/json")) return null;
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export const SIGNUP_CHALLENGE_COOKIE = "qx_signup_challenge";
export const SIGNUP_TOKEN_COOKIE = "qx_signup_token";

export const signupCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/auth/signup",
  maxAge: maxAgeSeconds,
});
