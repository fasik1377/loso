import type { Permission } from "@/lib/domain/permissions";
import { hasPermission, isStaff } from "@/lib/domain/permissions";
import type { Role } from "@/lib/generated/prisma";

export interface NavItem {
  href: string;
  label: string;
  icon: string; // lucide icon key, resolved in the client sidebar
  badge?: "messages" | "notifications";
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

/** Each role gets its own navigation; a user with several roles sees each relevant group. */
export function navFor(roles: Role[]): NavGroup[] {
  const groups: NavGroup[] = [];
  const common: NavItem[] = [
    { href: "/dashboard/messages", label: "Messages", icon: "message", badge: "messages" },
    { href: "/dashboard/notifications", label: "Notifications", icon: "bell", badge: "notifications" },
    { href: "/dashboard/settings", label: "Settings", icon: "settings" },
  ];

  if (roles.includes("WORKER")) {
    groups.push({
      title: "Work",
      items: [
        { href: "/dashboard", label: "Overview", icon: "home" },
        { href: "/dashboard/profile", label: "My profile & services", icon: "user" },
        { href: "/dashboard/jobs", label: "Jobs for me", icon: "briefcase" },
        { href: "/dashboard/applications", label: "My applications", icon: "file" },
        { href: "/dashboard/service-requests", label: "Service requests", icon: "wrench" },
        { href: "/dashboard/reviews", label: "Reviews", icon: "star" },
      ],
    });
  }
  if (roles.includes("CUSTOMER")) {
    groups.push({
      title: "Hiring help",
      items: [
        { href: "/dashboard", label: "Overview", icon: "home" },
        { href: "/services", label: "Find a worker", icon: "search" },
        { href: "/dashboard/service-requests", label: "My requests", icon: "wrench" },
        { href: "/dashboard/reviews", label: "My reviews", icon: "star" },
        { href: "/dashboard/profile", label: "Profile", icon: "user" },
      ],
    });
  }
  if (roles.includes("EMPLOYER")) {
    groups.push({
      title: "Employer",
      items: [
        { href: "/employer/dashboard", label: "Overview", icon: "home" },
        { href: "/employer/company", label: "Company", icon: "building" },
        { href: "/employer/jobs", label: "Job posts", icon: "briefcase" },
        { href: "/employer/jobs/new", label: "Post a job", icon: "plus" },
        { href: "/employer/applicants", label: "Applicants", icon: "users" },
        { href: "/employer/advertisements", label: "Advertising", icon: "megaphone" },
      ],
    });
  }
  if (isStaff(roles)) {
    const admin: (NavItem & { perm: Permission })[] = [
      { href: "/admin", label: "Overview", icon: "chart", perm: "admin.access" },
      { href: "/admin/verifications", label: "Verifications", icon: "badge", perm: "verifications.review" },
      { href: "/admin/payments", label: "Payments", icon: "wallet", perm: "payments.review" },
      { href: "/admin/users", label: "Users", icon: "users", perm: "users.view" },
      { href: "/admin/jobs", label: "Jobs & companies", icon: "briefcase", perm: "content.moderate" },
      { href: "/admin/services", label: "Services", icon: "wrench", perm: "content.moderate" },
      { href: "/admin/reviews", label: "Reviews", icon: "star", perm: "content.moderate" },
      { href: "/admin/reports", label: "Reports & support", icon: "flag", perm: "reports.handle" },
      { href: "/admin/advertisements", label: "Advertisements", icon: "megaphone", perm: "ads.manage" },
      { href: "/admin/categories", label: "Categories & locations", icon: "tags", perm: "taxonomy.manage" },
      { href: "/admin/settings", label: "Platform settings", icon: "settings", perm: "settings.manage" },
      { href: "/admin/audit-logs", label: "Audit log", icon: "scroll", perm: "audit.view" },
    ];
    groups.unshift({ title: "Administration", items: admin.filter((i) => hasPermission(roles, i.perm)) });
  }
  // De-duplicate hrefs across groups (e.g. a worker who is also a customer).
  const seen = new Set<string>();
  for (const g of groups) g.items = g.items.filter((i) => (seen.has(i.href) ? false : (seen.add(i.href), true)));
  groups.push({ title: "Account", items: common.filter((i) => !seen.has(i.href)) });
  return groups;
}
