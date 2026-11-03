import type { NextRequest } from "next/server";

/**
 * CSRF defence for cookie-authenticated route handlers that change state.
 * (Server Actions already get an Origin/Host check from Next.js.)
 */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}
