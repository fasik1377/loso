import "server-only";
import { redirect } from "next/navigation";
import { AppError, forbidden } from "@/lib/errors";
import { hasPermission, isStaff, type Permission } from "@/lib/domain/permissions";
import type { Role } from "@/lib/generated/prisma";
import { getCurrentUser, type SessionUser } from "./session";

/*
 * Two flavours of guard:
 *  - require*Page: for server components/pages. Redirects instead of throwing.
 *  - assert*:      for server actions/route handlers. Throws AppError (rendered as a safe message).
 * Every protected read or write must go through one of these; hiding UI is never enough.
 */

export async function requireUserPage(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Active account required. Pending/rejected/suspended users are sent to the status page. */
export async function requireActivePage(): Promise<SessionUser> {
  const user = await requireUserPage();
  if (user.status !== "ACTIVE") redirect("/account-status");
  return user;
}

export async function requireRolePage(...roles: Role[]): Promise<SessionUser> {
  const user = await requireActivePage();
  if (!roles.some((r) => user.roles.includes(r))) redirect("/dashboard");
  return user;
}

export async function requirePermissionPage(permission: Permission): Promise<SessionUser> {
  const user = await requireActivePage();
  if (!hasPermission(user.roles, permission)) redirect(isStaff(user.roles) ? "/admin" : "/dashboard");
  return user;
}

export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("Please sign in to continue.", "UNAUTHORIZED");
  return user;
}

export async function assertActive(): Promise<SessionUser> {
  const user = await assertUser();
  if (user.status !== "ACTIVE") throw forbidden("Your account must be active to do this.");
  return user;
}

export async function assertRole(...roles: Role[]): Promise<SessionUser> {
  const user = await assertActive();
  if (!roles.some((r) => user.roles.includes(r))) throw forbidden();
  return user;
}

export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const user = await assertActive();
  if (!hasPermission(user.roles, permission)) throw forbidden();
  return user;
}

/** Where to send a user right after login, based on status and primary role. */
export function homePathFor(user: Pick<SessionUser, "status" | "roles">): string {
  if (user.status !== "ACTIVE") return "/account-status";
  if (isStaff(user.roles)) return "/admin";
  if (user.roles.includes("EMPLOYER")) return "/employer/dashboard";
  return "/dashboard";
}
