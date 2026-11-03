import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { requirePermissionPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/domain/permissions";
import type { Prisma } from "@/lib/generated/prisma";
import type { ReportStatus } from "@/lib/generated/prisma";
import { buildQuery, int, str } from "@/lib/search-params";
import { formatDateTime, humanize, timeAgo } from "@/lib/format";
import { hideMessageAction, resolveReportAction, supportStatusAction } from "@/lib/actions/admin";
import { Badge, Card, CardBody, EmptyState, PageHeader, Pagination, cx } from "@/components/ui/primitives";
import { StatusBadge, Stars } from "@/components/ui/status";
import { ActionButton, ReasonForm, SectionTitle } from "@/components/admin/action-forms";

export const metadata: Metadata = { title: "Reports & support" };

const PAGE_SIZE = 25;
const OPEN: ReportStatus[] = ["OPEN", "IN_REVIEW"];

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const viewer = await requirePermissionPage("reports.handle");
  const canModerate = hasPermission(viewer.roles, "content.moderate");
  const sp = await searchParams;
  const page = int(sp, "page") ?? 1;
  const spage = int(sp, "spage") ?? 1;
  const supportAll = str(sp, "support") === "all";
  const now = new Date();

  const supportWhere: Prisma.SupportRequestWhereInput = supportAll ? {} : { status: { in: OPEN } };
  const [total, reports, supportTotal, support] = await Promise.all([
    db.report.count({ where: { status: { in: OPEN } } }),
    db.report.findMany({
      where: { status: { in: OPEN } },
      include: { reporter: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.supportRequest.count({ where: supportWhere }),
    db.supportRequest.findMany({ where: supportWhere, orderBy: { createdAt: "desc" }, skip: (spage - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);

  // Batch-load report targets by type.
  const idsOf = (t: string) => reports.filter((r) => r.targetType === t).map((r) => r.targetId);
  const [users, jobs, companies, reviews, messages, ads, requests] = await Promise.all([
    db.user.findMany({ where: { id: { in: idsOf("USER") } }, select: { id: true, fullName: true, status: true } }),
    db.job.findMany({ where: { id: { in: idsOf("JOB") } }, select: { id: true, title: true, status: true } }),
    db.company.findMany({ where: { id: { in: idsOf("COMPANY") } }, select: { id: true, name: true, status: true } }),
    db.review.findMany({
      where: { id: { in: idsOf("REVIEW") } },
      select: { id: true, rating: true, comment: true, status: true, author: { select: { fullName: true } }, subject: { select: { fullName: true } } },
    }),
    // Only the reported message itself — never the surrounding conversation.
    db.message.findMany({
      where: { id: { in: idsOf("MESSAGE") } },
      select: { id: true, body: true, hiddenAt: true, createdAt: true, sender: { select: { id: true, fullName: true } } },
    }),
    db.advertisement.findMany({ where: { id: { in: idsOf("ADVERTISEMENT") } }, select: { id: true, title: true, businessName: true } }),
    db.serviceRequest.findMany({ where: { id: { in: idsOf("SERVICE_REQUEST") } }, select: { id: true, title: true, status: true } }),
  ]);
  const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const userMap = byId(users), jobMap = byId(jobs), companyMap = byId(companies), reviewMap = byId(reviews);
  const messageMap = byId(messages), adMap = byId(ads), requestMap = byId(requests);

  function target(type: string, id: string): ReactNode {
    const missing = <span className="text-muted">Item no longer exists.</span>;
    switch (type) {
      case "USER": {
        const u = userMap.get(id);
        return u ? <><Link href={`/admin/users/${u.id}`} className="font-medium text-brand hover:underline">{u.fullName}</Link> <StatusBadge status={u.status} /></> : missing;
      }
      case "JOB": {
        const j = jobMap.get(id);
        return j ? <><Link href={`/jobs/${j.id}`} className="font-medium text-brand hover:underline">{j.title}</Link> <StatusBadge status={j.status} /> <Link href={`/admin/jobs?q=${encodeURIComponent(j.title)}`} className="text-xs text-muted hover:underline">moderate</Link></> : missing;
      }
      case "COMPANY": {
        const c = companyMap.get(id);
        return c ? <><Link href={`/companies/${c.id}`} className="font-medium text-brand hover:underline">{c.name}</Link> <StatusBadge status={c.status} /></> : missing;
      }
      case "REVIEW": {
        const r = reviewMap.get(id);
        return r ? (
          <div className="space-y-1">
            <p className="flex items-center gap-2"><Stars value={r.rating} /> <StatusBadge status={r.status} /></p>
            <p className="whitespace-pre-line">{r.comment ?? <span className="text-muted">No comment</span>}</p>
            <p className="text-xs text-muted">By {r.author.fullName} about {r.subject.fullName} · <Link href="/admin/reviews?reported=1" className="hover:underline">moderate reviews</Link></p>
          </div>
        ) : missing;
      }
      case "MESSAGE": {
        const m = messageMap.get(id);
        return m ? (
          <div className="space-y-2">
            <blockquote className="whitespace-pre-line rounded-lg border border-line bg-canvas px-3 py-2">{m.body}</blockquote>
            <p className="text-xs text-muted">
              Sent by <Link href={`/admin/users/${m.sender.id}`} className="hover:underline">{m.sender.fullName}</Link> · {formatDateTime(m.createdAt)}
            </p>
            {m.hiddenAt ? (
              <Badge>Hidden {formatDateTime(m.hiddenAt)}</Badge>
            ) : canModerate ? (
              <ActionButton action={hideMessageAction} fields={{ id: m.id }} label="Hide message" variant="danger" />
            ) : null}
          </div>
        ) : missing;
      }
      case "ADVERTISEMENT": {
        const a = adMap.get(id);
        return a ? <><Link href="/admin/advertisements" className="font-medium text-brand hover:underline">{a.title}</Link> <span className="text-muted">· {a.businessName}</span></> : missing;
      }
      case "SERVICE_REQUEST": {
        const s = requestMap.get(id);
        return s ? <><span className="font-medium text-ink">{s.title}</span> <StatusBadge status={s.status} /></> : missing;
      }
      default:
        return missing;
    }
  }

  return (
    <div>
      <PageHeader title="Reports & support" description="Handle user reports and contact-form messages. Always record what was done." />

      <SectionTitle title={`Open reports (${total})`} description="Oldest first." />
      {reports.length === 0 ? (
        <EmptyState icon={<Flag className="h-8 w-8" />} title="No open reports" />
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardBody>
                <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{humanize(r.targetType)}</Badge>
                      <Badge tone="danger">{humanize(r.reason)}</Badge>
                      <StatusBadge status={r.status} />
                      <span className="text-xs text-muted">
                        Reported {timeAgo(r.createdAt, now)} by <Link href={`/admin/users/${r.reporter.id}`} className="hover:underline">{r.reporter.fullName}</Link>
                      </span>
                    </div>
                    <div>{target(r.targetType, r.targetId)}</div>
                    {r.details && (
                      <div>
                        <p className="text-xs font-medium text-muted">Reporter&apos;s details</p>
                        <p className="whitespace-pre-line">{r.details}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap content-start gap-2 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                    {r.status === "OPEN" && <ActionButton action={resolveReportAction} fields={{ id: r.id, outcome: "IN_REVIEW" }} label="Mark in review" />}
                    <ReasonForm action={resolveReportAction} fields={{ id: r.id, outcome: "RESOLVED" }} label="Resolve" variant="primary" noteLabel="What action was taken?" />
                    <ReasonForm action={resolveReportAction} fields={{ id: r.id, outcome: "DISMISSED" }} label="Dismiss" variant="outline" noteLabel="Why is it dismissed?" />
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE_SIZE))} hrefFor={(p) => `/admin/reports${buildQuery(sp, { page: p })}`} />

      <SectionTitle
        title={`Support requests (${supportTotal})`}
        description="Messages sent through the contact form."
        actions={
          <nav className="flex gap-2" aria-label="Support filter">
            {[
              { v: undefined, label: "Open" },
              { v: "all", label: "All" },
            ].map((t) => (
              <Link
                key={t.label}
                href={`/admin/reports${buildQuery(sp, { support: t.v, spage: undefined })}`}
                className={cx("rounded-full border px-3 py-1 text-sm font-medium", (t.v === "all") === supportAll ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:bg-brand-50")}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        }
      />
      {support.length === 0 ? (
        <p className="text-sm text-muted">No support requests.</p>
      ) : (
        <div className="space-y-3">
          {support.map((s) => (
            <Card key={s.id}>
              <CardBody className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={s.status} />
                  <span className="font-semibold text-ink">{s.subject}</span>
                  <span className="text-xs text-muted">· {formatDateTime(s.createdAt)}</span>
                </div>
                <p className="text-muted">
                  From {s.name} · {s.contact}
                  {s.userId && <> · <Link href={`/admin/users/${s.userId}`} className="text-brand hover:underline">registered user</Link></>}
                </p>
                <p className="whitespace-pre-line text-ink">{s.message}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(["IN_REVIEW", "RESOLVED", "DISMISSED"] as const)
                    .filter((st) => st !== s.status)
                    .map((st) => (
                      <ActionButton key={st} action={supportStatusAction} fields={{ id: s.id, status: st }} label={st === "IN_REVIEW" ? "Mark in review" : st === "RESOLVED" ? "Mark resolved" : "Dismiss"} />
                    ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={spage} pages={Math.max(1, Math.ceil(supportTotal / PAGE_SIZE))} hrefFor={(p) => `/admin/reports${buildQuery(sp, { spage: p })}`} />
    </div>
  );
}
