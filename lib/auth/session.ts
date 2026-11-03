import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { generateToken, hashToken } from "./tokens";
import type { AccountStatus, Role } from "@/lib/generated/prisma";

export const SESSION_COOKIE = "loso_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RENEW_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: AccountStatus;
  roles: Role[];
}

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 255) ?? null;
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt, userAgent } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

/**
 * Resolve the current user from the session cookie. Cached per request.
 * Returns users in any status; use guards in ./guards.ts to enforce access.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { roles: { select: { role: true } } } } },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() < now) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // Sliding expiry: extend the DB record; the cookie is refreshed on next login/action that can set cookies.
  if (session.expiresAt.getTime() - now < RENEW_THRESHOLD_MS) {
    await db.session
      .update({ where: { id: session.id }, data: { expiresAt: new Date(now + SESSION_TTL_MS), lastSeenAt: new Date() } })
      .catch(() => undefined);
  }
  const u = session.user;
  return {
    id: u.id,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    status: u.status,
    roles: u.roles.map((r) => r.role),
  };
});
