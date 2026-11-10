import type { Role } from "@/lib/generated/prisma";

/**
 * Staff permissions. Centralized here so every server action/route checks the same map.
 * SUPER_ADMIN implicitly has everything; ADMIN and MODERATOR are least-privilege subsets.
 */
export const PERMISSIONS = [
  "admin.access",
  "users.view",
  "users.manage", // suspend / reactivate
  "roles.manage", // grant/revoke staff roles (super admin only)
  "verifications.review",
  "payments.review",
  "content.moderate", // jobs, reviews, messages after report, companies
  "jobs.post", // publish vacancies on behalf of employers
  "reports.handle",
  "taxonomy.manage", // categories, skills, locations
  "ads.manage",
  "settings.manage",
  "audit.view",
  "data.export",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  ADMIN: [
    "admin.access",
    "users.view",
    "users.manage",
    "verifications.review",
    "payments.review",
    "content.moderate",
    "jobs.post",
    "reports.handle",
    "taxonomy.manage",
    "ads.manage",
    "audit.view",
    "data.export",
  ],
  MODERATOR: ["admin.access", "users.view", "verifications.review", "content.moderate", "reports.handle"],
  WORKER: [],
  CUSTOMER: [],
  EMPLOYER: [],
};

export const STAFF_ROLES: readonly Role[] = ["SUPER_ADMIN", "ADMIN", "MODERATOR"];
export const MEMBER_ROLES: readonly Role[] = ["WORKER", "CUSTOMER", "EMPLOYER"];

export function permissionsFor(roles: readonly Role[]): Set<Permission> {
  return new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r]));
}

export function hasPermission(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((r) => ROLE_PERMISSIONS[r].includes(permission));
}

export function isStaff(roles: readonly Role[]): boolean {
  return roles.some((r) => STAFF_ROLES.includes(r));
}

/**
 * Only a super admin may grant/revoke staff roles, and nobody may change their own roles.
 * Granting SUPER_ADMIN through the UI is not allowed at all (use the CLI bootstrap script).
 */
export function canAssignRole(actorRoles: readonly Role[], actorId: string, targetId: string, role: Role): boolean {
  if (actorId === targetId) return false;
  if (role === "SUPER_ADMIN") return false;
  return actorRoles.includes("SUPER_ADMIN");
}
