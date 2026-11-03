import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { requirePermissionPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { buildQuery, int, str } from "@/lib/search-params";
import { formatDate, formatDateTime } from "@/lib/format";
import { moderateReviewAction } from "@/lib/actions/admin";
import { Badge, EmptyState, PageHeader, Pagination, Table, cx } from "@/components/ui/primitives";
import { StatusBadge, Stars } from "@/components/ui/status";
import { ActionButton, ReasonForm } from "@/components/admin/action-forms";

export const metadata: Metadata = { title: "Reviews" };

const PAGE_SIZE = 25;
const TABS = [
  { value: undefined, label: "All" },
  { value: "VISIBLE", label: "Visible" },
  { value: "HIDDEN", label: "Hidden" },
] as const;

export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requirePermissionPage("content.moderate");
  const sp = await searchParams;
  const raw = str(sp, "status");
  const status = raw === "VISIBLE" || raw === "HIDDEN" ? raw : undefined;
  const reported = str(sp, "reported") === "1";
  const page = int(sp, "page") ?? 1;

  const where: Prisma.ReviewWhereInput = status ? { status } : {};
  if (reported) {
    const ids = await db.report.findMany({ where: { targetType: "REVIEW", status: { in: ["OPEN", "IN_REVIEW"] } }, select: { targetId: true }, distinct: ["targetId"] });
    where.id = { in: ids.map((r) => r.targetId) };
  }

  const [total, reviews] = await Promise.all([
    db.review.count({ where }),
    db.review.findMany({
      where,
      include: {
        author: { select: { id: true, fullName: true } },
        subject: { select: { id: true, fullName: true } },
        serviceRequest: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const reportCounts = reviews.length
    ? await db.report.groupBy({
        by: ["targetId"],
        where: { targetType: "REVIEW", targetId: { in: reviews.map((r) => r.id) }, status: { in: ["OPEN", "IN_REVIEW"] } },
        _count: true,
      })
    : [];
  const openReports = new Map(reportCounts.map((r) => [r.targetId, r._count]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="Reviews" description="Hide reviews that break the rules. Hidden reviews no longer count toward the worker's rating." />

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filter reviews">
        {TABS.map((t) => (
          <Link
            key={t.label}
            href={`/admin/reviews${buildQuery(sp, { status: t.value, page: undefined })}`}
            aria-current={status === t.value ? "page" : undefined}
            className={cx("rounded-full border px-3 py-1 text-sm font-medium", status === t.value ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:bg-brand-50")}
          >
            {t.label}
          </Link>
        ))}
        <Link
          href={`/admin/reviews${buildQuery(sp, { reported: reported ? undefined : "1", page: undefined })}`}
          className={cx("rounded-full border px-3 py-1 text-sm font-medium", reported ? "border-danger bg-danger text-white" : "border-line bg-white text-ink hover:bg-brand-50")}
        >
          With open reports
        </Link>
      </nav>

      {reviews.length === 0 ? (
        <EmptyState icon={<Star className="h-8 w-8" />} title="No reviews found" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Rating</th>
              <th>Comment</th>
              <th>Author → subject</th>
              <th>Request</th>
              <th>Reports</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {reviews.map((r) => {
              const reports = openReports.get(r.id) ?? 0;
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">
                    <Stars value={r.rating} />
                    <p className="text-xs text-muted">{formatDate(r.createdAt)}</p>
                  </td>
                  <td className="min-w-[16rem] max-w-md whitespace-pre-line">{r.comment ?? <span className="text-muted">No comment</span>}</td>
                  <td className="whitespace-nowrap">
                    <Link href={`/admin/users/${r.author.id}`} className="hover:underline">{r.author.fullName}</Link>
                    <span className="text-muted"> → </span>
                    <Link href={`/admin/users/${r.subject.id}`} className="hover:underline">{r.subject.fullName}</Link>
                  </td>
                  <td className="text-muted">{r.serviceRequest.title}</td>
                  <td>{reports > 0 ? <Badge tone="danger">{reports} open</Badge> : <span className="text-muted">0</span>}</td>
                  <td>
                    <StatusBadge status={r.status} />
                    {r.status === "HIDDEN" && (
                      <p className="mt-1 max-w-[14rem] text-xs text-muted">
                        {r.hiddenReason}
                        {r.hiddenAt && <> · {formatDateTime(r.hiddenAt)}</>}
                      </p>
                    )}
                  </td>
                  <td>
                    {r.status === "VISIBLE" ? (
                      <ReasonForm action={moderateReviewAction} fields={{ id: r.id, hide: "1" }} label="Hide" noteLabel="Reason for hiding" />
                    ) : (
                      <ActionButton action={moderateReviewAction} fields={{ id: r.id, hide: "0" }} label="Restore" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pages={pages} hrefFor={(p) => `/admin/reviews${buildQuery(sp, { page: p })}`} />
    </div>
  );
}
