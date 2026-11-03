import type { Metadata } from "next";
import Link from "next/link";
import { requireActivePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { str } from "@/lib/search-params";
import { formatDate, timeAgo } from "@/lib/format";
import { ButtonLink, EmptyState, PageHeader, Table, cx } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";

export const metadata: Metadata = { title: "Service requests" };

export default async function ServiceRequestsPage({ searchParams }: PageProps<"/dashboard/service-requests">) {
  const user = await requireActivePage();
  const sp = await searchParams;
  const isWorker = user.roles.includes("WORKER");
  const isCustomer = user.roles.includes("CUSTOMER");
  const view = str(sp, "view") === "sent" || !isWorker ? "sent" : "received";
  const requests = await db.serviceRequest.findMany({
    where: view === "received" ? { workerId: user.id } : { customerId: user.id },
    include: { customer: { select: { fullName: true } }, worker: { select: { fullName: true } }, category: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Service requests"
        description={view === "received" ? "Requests customers sent to you." : "Requests you sent to workers."}
        actions={isCustomer || !isWorker ? <ButtonLink href="/services">Find a worker</ButtonLink> : undefined}
      />
      {isWorker && (
        <div className="mb-4 inline-flex rounded-lg border border-line bg-white p-1 text-sm">
          {(["received", "sent"] as const).map((v) => (
            <Link key={v} href={`?view=${v}`} className={cx("rounded-md px-3 py-1.5 font-medium", view === v ? "bg-brand text-white" : "text-muted hover:text-ink")}>
              {v === "received" ? "Received" : "Sent"}
            </Link>
          ))}
        </div>
      )}
      {requests.length === 0 ? (
        <EmptyState title="No service requests" description={view === "received" ? "Make sure your profile lists your services and areas." : "Find a worker and send a request."} />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Request</th>
              <th>{view === "received" ? "Customer" : "Worker"}</th>
              <th>Preferred time</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {requests.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/dashboard/service-requests/${r.id}`} className="font-medium text-ink hover:text-brand">{r.title}</Link>
                  <p className="text-xs text-muted">{r.category.name}</p>
                </td>
                <td>{view === "received" ? r.customer.fullName : r.worker.fullName}</td>
                <td>{r.preferredAt ? formatDate(r.preferredAt) : "Flexible"}</td>
                <td><StatusBadge status={r.status} /></td>
                <td className="text-muted">{timeAgo(r.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
