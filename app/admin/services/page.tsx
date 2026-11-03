import type { Metadata } from "next";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { requirePermissionPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import type { ServiceRequestStatus } from "@/lib/generated/prisma";
import { buildQuery, int, str } from "@/lib/search-params";
import { formatDate, humanize } from "@/lib/format";
import { Badge, Card, CardBody, EmptyState, PageHeader, Pagination, Table, buttonClass } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { FilterField, SectionTitle, adminInput } from "@/components/admin/action-forms";

export const metadata: Metadata = { title: "Services" };

const PAGE_SIZE = 25;
const REQUEST_STATUSES: readonly ServiceRequestStatus[] = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "DECLINED", "CANCELLED"];

export default async function AdminServicesPage({ searchParams }: PageProps<"/admin/services">) {
  await requirePermissionPage("content.moderate");
  const sp = await searchParams;
  const q = str(sp, "q");
  const page = int(sp, "page") ?? 1;
  const rstatus = REQUEST_STATUSES.find((s) => s === str(sp, "rstatus"));
  const rpage = int(sp, "rpage") ?? 1;

  const providerWhere: Prisma.WorkerProfileWhereInput = { offersServices: true };
  if (q) providerWhere.user = { fullName: { contains: q, mode: "insensitive" } };
  const requestWhere: Prisma.ServiceRequestWhereInput = rstatus ? { status: rstatus } : {};

  const [providerTotal, providers, counts, requestTotal, requests] = await Promise.all([
    db.workerProfile.count({ where: providerWhere }),
    db.workerProfile.findMany({
      where: providerWhere,
      include: {
        user: { select: { id: true, fullName: true, status: true, isDemo: true } },
        services: { include: { category: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ completedCount: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.serviceRequest.groupBy({ by: ["status"], _count: true }),
    db.serviceRequest.count({ where: requestWhere }),
    db.serviceRequest.findMany({
      where: requestWhere,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { name: true } },
        customer: { select: { id: true, fullName: true } },
        worker: { select: { id: true, fullName: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (rpage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const providerPages = Math.max(1, Math.ceil(providerTotal / PAGE_SIZE));
  const requestPages = Math.max(1, Math.ceil(requestTotal / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="Services" description="Service providers and the status of service requests. Request descriptions and messages stay private." />

      <Card className="mb-2">
        <CardBody>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {REQUEST_STATUSES.map((s) => (
              <div key={s}>
                <dt className="text-xs text-muted">{humanize(s)}</dt>
                <dd className="text-lg font-semibold text-ink">{counts.find((c) => c.status === s)?._count ?? 0}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <SectionTitle title={`Service providers (${providerTotal})`} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3" aria-label="Search providers">
        <FilterField label="Provider name" className="flex-1">
          <input name="q" defaultValue={q} placeholder="Search by name" className={adminInput} />
        </FilterField>
        {rstatus && <input type="hidden" name="rstatus" value={rstatus} />}
        <button className={buttonClass("outline", "md")}>Search</button>
      </form>
      {providers.length === 0 ? (
        <EmptyState icon={<Wrench className="h-8 w-8" />} title="No service providers found" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Account</th>
              <th>Availability</th>
              <th>Rating</th>
              <th>Completed</th>
              <th>Services</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {providers.map((w) => (
              <tr key={w.id}>
                <td className="min-w-[12rem]">
                  <Link href={`/admin/users/${w.user.id}`} className="font-medium text-brand hover:underline">{w.user.fullName}</Link>
                  {w.user.isDemo && <Badge tone="warning" className="ml-2">Demo</Badge>}
                  <p className="text-xs">
                    <Link href={`/workers/${w.user.id}`} className="text-muted hover:underline">Public profile →</Link>
                  </p>
                </td>
                <td><StatusBadge status={w.user.status} /></td>
                <td>{humanize(w.availability)}</td>
                <td className="whitespace-nowrap">
                  {w.ratingCount > 0 && w.ratingAverage != null ? `${Number(w.ratingAverage).toFixed(1)} ★ (${w.ratingCount})` : <span className="text-muted">—</span>}
                </td>
                <td>{w.completedCount}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {w.services.length === 0 && <span className="text-xs text-muted">None listed</span>}
                    {w.services.map((s) => (
                      <Badge key={s.id} tone={s.active ? "brand" : "neutral"}>{s.category.name}{s.active ? "" : " (inactive)"}</Badge>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pages={providerPages} hrefFor={(p) => `/admin/services${buildQuery(sp, { page: p })}`} />

      <SectionTitle title={`Service requests (${requestTotal})`} description="Read-only. Most recently updated first." />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3" aria-label="Filter service requests">
        <FilterField label="Status">
          <select name="rstatus" defaultValue={rstatus ?? ""} className={adminInput}>
            <option value="">Any status</option>
            {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </FilterField>
        {q && <input type="hidden" name="q" value={q} />}
        <button className={buttonClass("outline", "md")}>Filter</button>
      </form>
      {requests.length === 0 ? (
        <p className="text-sm text-muted">No service requests.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Category</th>
              <th>Customer</th>
              <th>Worker</th>
              <th>Status</th>
              <th>Created</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="min-w-[12rem] font-medium text-ink">{r.title}</td>
                <td>{r.category.name}</td>
                <td><Link href={`/admin/users/${r.customer.id}`} className="hover:underline">{r.customer.fullName}</Link></td>
                <td><Link href={`/admin/users/${r.worker.id}`} className="hover:underline">{r.worker.fullName}</Link></td>
                <td><StatusBadge status={r.status} /></td>
                <td className="whitespace-nowrap">{formatDate(r.createdAt)}</td>
                <td className="whitespace-nowrap">{formatDate(r.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={rpage} pages={requestPages} hrefFor={(p) => `/admin/services${buildQuery(sp, { rpage: p })}`} />
    </div>
  );
}
