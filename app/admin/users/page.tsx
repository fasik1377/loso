import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requirePermissionPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import type { AccountStatus, Role } from "@/lib/generated/prisma";
import { STAGE_INFO, deriveAccountStage } from "@/lib/domain/account";
import { buildQuery, int, str } from "@/lib/search-params";
import { formatDate, humanize } from "@/lib/format";
import { Badge, EmptyState, PageHeader, Pagination, Table, buttonClass } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { FilterField, adminInput } from "@/components/admin/action-forms";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 25;
const STATUSES: readonly AccountStatus[] = ["PENDING", "ACTIVE", "REJECTED", "SUSPENDED", "DEACTIVATED"];
const ROLES: readonly Role[] = ["WORKER", "CUSTOMER", "EMPLOYER", "MODERATOR", "ADMIN", "SUPER_ADMIN"];
const STAGE_TONE = { neutral: "neutral", warning: "warning", success: "success", danger: "danger" } as const;

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requirePermissionPage("users.view");
  const sp = await searchParams;
  const q = str(sp, "q");
  const status = STATUSES.find((s) => s === str(sp, "status"));
  const role = ROLES.find((r) => r === str(sp, "role"));
  const page = int(sp, "page") ?? 1;

  const phoneTerms = q ? [q.replace(/\s+/g, ""), q.replace(/\s+/g, "").replace(/^0/, "")].filter(Boolean) : [];
  const where: Prisma.UserWhereInput = {};
  if (q) {
    const or: Prisma.UserWhereInput[] = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      ...phoneTerms.map((t): Prisma.UserWhereInput => ({ phone: { contains: t } })),
    ];
    where.OR = or;
  }
  if (status) where.status = status;
  if (role) where.roles = { some: { role } };

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        status: true,
        isDemo: true,
        createdAt: true,
        roles: { select: { role: true } },
        registrationPayments: { select: { status: true } },
        verifications: { where: { companyId: null }, orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="Users" description={`${total} ${total === 1 ? "account" : "accounts"} match the current filters.`} />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4" aria-label="Filter users">
        <FilterField label="Search" className="flex-1">
          <input name="q" defaultValue={q} placeholder="Name, phone or email" className={adminInput} />
        </FilterField>
        <FilterField label="Status">
          <select name="status" defaultValue={status ?? ""} className={adminInput}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </FilterField>
        <FilterField label="Role">
          <select name="role" defaultValue={role ?? ""} className={adminInput}>
            <option value="">Any role</option>
            {ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
          </select>
        </FilterField>
        <div className="flex gap-2">
          <button className={buttonClass("primary", "md")}>Apply</button>
          <Link href="/admin/users" className={buttonClass("outline", "md")}>Reset</Link>
        </div>
      </form>

      {users.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="No users found" description="Try a different search or remove filters." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Roles</th>
              <th>Status</th>
              <th>Stage</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => {
              const roles = u.roles.map((r) => r.role);
              const stage = STAGE_INFO[
                deriveAccountStage({ status: u.status, roles, payment: u.registrationPayments[0] ?? null, verification: u.verifications[0] ?? null })
              ];
              return (
                <tr key={u.id}>
                  <td>
                    <Link href={`/admin/users/${u.id}`} className="font-medium text-brand hover:underline">{u.fullName}</Link>
                    {u.isDemo && <Badge tone="warning" className="ml-2">Demo</Badge>}
                    {u.email && <p className="text-xs text-muted">{u.email}</p>}
                  </td>
                  <td className="whitespace-nowrap">{u.phone}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {roles.map((r) => <Badge key={r} tone={r === "WORKER" || r === "CUSTOMER" || r === "EMPLOYER" ? "neutral" : "brand"}>{humanize(r)}</Badge>)}
                    </div>
                  </td>
                  <td><StatusBadge status={u.status} /></td>
                  <td><Badge tone={STAGE_TONE[stage.tone]}>{stage.label}</Badge></td>
                  <td className="whitespace-nowrap">{formatDate(u.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pages={pages} hrefFor={(p) => `/admin/users${buildQuery(sp, { page: p })}`} />
    </div>
  );
}
