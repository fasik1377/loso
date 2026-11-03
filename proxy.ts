import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate only: sends visitors without a session cookie to /login early.
 * Real authorization (session validity, account status, roles) happens in server guards
 * (lib/auth/guards.ts) on every protected page, action and route handler.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("loso_session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/employer/:path*", "/admin/:path*", "/account-status"],
};
