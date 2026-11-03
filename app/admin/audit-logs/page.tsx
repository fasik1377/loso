import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { requirePermissionPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { buildQuery, int, str } from "@/lib/search-params";
import { formatDateTime } from "@/lib/format";
import { EmptyState, PageHeader, Pagination, Table, buttonClass } from "@/components/ui/primitives";
import { FilterField, adminInput } from "@/components/admin/action-forms";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 25;

export default async function AdminAuditLogsPage({ searchParams }: PageProps<"/admin/audit-logs">) {
  await requirePermissionPage("audit.view");
  const sp = await searchParams;
  const q = str(sp, "q", 60);
  const entityType = str(sp, "entityType", 60);
  const entityId = str(sp, "entityId", 40);
  const page = int(sp, "page") ?? 1;

  const where: Prisma.AuditLogWhereInput = {};
  if (q) where.action = { startsWith: q };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const [total, entries, types] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="Audit log" description={`${total} entr${total === 1 ? "y" : "ies"}. Append-only record of administrative and financial actions.`} />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4" aria-label="Filter audit log">
        <FilterField label="Action starts with" className="flex-1">
          <input name="q" defaultValue={q} placeholder="e.g. payment. or user.activate" className={adminInput} />
        </FilterField>
        <FilterField label="Entity type">
          <select name="entityType" defaultValue={entityType ?? ""} className={adminInput}>
            <option value="">All types</option>
            {types.map((t) => <option key={t.entityType} value={t.entityType}>{t.entityType}</option>)}
          </select>
        </FilterField>
        <FilterField label="Entity ID">
          <input name="entityId" defaultValue={entityId} placeholder="Optional" className={adminInput} />
        </FilterField>
        <div className="flex gap-2">
          <button className={buttonClass("primary", "md")}>Apply</button>
          <a href="/admin/audit-logs" className={buttonClass("outline", "md")}>Reset</a>
        </div>
      </form>

      {entries.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-8 w-8" />} title="No audit entries" description="Try different filters." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
                <td>
                  {e.actor ? <Link href={`/admin/users/${e.actor.id}`} className="hover:underline">{e.actor.fullName}</Link> : <span className="text-muted">System</span>}
                </td>
                <td className="whitespace-nowrap font-mono text-xs">{e.action}</td>
                <td className="text-xs">
                  <p>{e.entityType}</p>
                  {e.entityId &&
                    (e.entityType === "User" ? (
                      <Link href={`/admin/users/${e.entityId}`} className="font-mono text-brand hover:underline">{e.entityId}</Link>
                    ) : (
                      <Link href={`/admin/audit-logs${buildQuery({}, { entityId: e.entityId })}`} className="font-mono text-muted hover:underline">{e.entityId}</Link>
                    ))}
                </td>
                <td>
                  {e.metadata != null ? (
                    <pre className="max-h-40 max-w-md overflow-auto whitespace-pre-wrap break-all rounded bg-canvas p-2 font-mono text-xs text-ink">{JSON.stringify(e.metadata)}</pre>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pages={pages} hrefFor={(p) => `/admin/audit-logs${buildQuery(sp, { page: p })}`} />
    </div>
  );
}
