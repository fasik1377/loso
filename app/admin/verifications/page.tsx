import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { requirePermissionPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { fileUrl } from "@/lib/services/files";
import { buildQuery, int, str } from "@/lib/search-params";
import { formatMoney } from "@/lib/money";
import { formatDateTime, humanize, timeAgo } from "@/lib/format";
import { reviewVerificationAction } from "@/lib/actions/admin";
import { Badge, Card, CardBody, EmptyState, PageHeader, Pagination, Table, cx } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { DecisionForm, FileLink, SectionTitle } from "@/components/admin/action-forms";

export const metadata: Metadata = { title: "Verifications" };

const PAGE_SIZE = 25;
const TABS = [
  { value: undefined, label: "All" },
  { value: "user", label: "Workers" },
  { value: "company", label: "Companies" },
] as const;

export default async function AdminVerificationsPage({ searchParams }: PageProps<"/admin/verifications">) {
  const viewer = await requirePermissionPage("verifications.review");
  const sp = await searchParams;
  const rawType = str(sp, "type");
  const type = rawType === "user" || rawType === "company" ? rawType : undefined;
  const page = int(sp, "page") ?? 1;
  const now = new Date();

  const typeWhere: Prisma.VerificationSubmissionWhereInput =
    type === "user" ? { companyId: null } : type === "company" ? { companyId: { not: null } } : {};
  const where: Prisma.VerificationSubmissionWhereInput = { ...typeWhere, status: "SUBMITTED" };

  const [total, queue, recent] = await Promise.all([
    db.verificationSubmission.count({ where }),
    db.verificationSubmission.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            status: true,
            roles: { select: { role: true } },
            registrationPayments: { select: { status: true, amountMinor: true, currency: true } },
          },
        },
        company: { select: { id: true, name: true, industry: true, status: true } },
        documents: { include: { file: { select: { originalName: true, mimeType: true } } } },
      },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.verificationSubmission.findMany({
      where: { ...typeWhere, status: { not: "SUBMITTED" }, reviewedAt: { not: null } },
      include: {
        user: { select: { id: true, fullName: true } },
        company: { select: { name: true } },
        reviewedBy: { select: { fullName: true } },
      },
      orderBy: { reviewedAt: "desc" },
      take: 15,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Verification queue"
        description="Review identity and company documents. Document verification is independent of the registration payment — approving documents never confirms a payment, and activation needs both."
      />

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Submission type">
        {TABS.map((t) => (
          <Link
            key={t.label}
            href={`/admin/verifications${buildQuery(sp, { type: t.value, page: undefined })}`}
            aria-current={type === t.value ? "page" : undefined}
            className={cx(
              "rounded-full border px-3 py-1 text-sm font-medium",
              type === t.value ? "border-brand bg-brand text-on-brand" : "border-line bg-card text-ink hover:bg-brand-50",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <SectionTitle title={`Waiting for review (${total})`} description="Oldest first." />
      {queue.length === 0 ? (
        <EmptyState icon={<BadgeCheck className="h-8 w-8" />} title="Nothing to review" description="New submissions will appear here." />
      ) : (
        <div className="space-y-4">
          {queue.map((s) => {
            const payment = s.user.registrationPayments[0];
            const isWorker = s.user.roles.some((r) => r.role === "WORKER");
            const ownSubmission = s.userId === viewer.id;
            return (
              <Card key={s.id}>
                <CardBody>
                  <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
                    <div className="space-y-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={s.company ? "gold" : "brand"}>{s.company ? "Company" : "Worker identity"}</Badge>
                        <span className="text-muted">Submitted {timeAgo(s.createdAt, now)} · {formatDateTime(s.createdAt)}</span>
                      </div>
                      {s.company && (
                        <p className="text-base font-semibold text-ink">
                          {s.company.name}
                          {s.company.industry && <span className="font-normal text-muted"> · {s.company.industry}</span>}
                          <span className="ml-2 align-middle"><StatusBadge status={s.company.status} /></span>
                        </p>
                      )}
                      <p>
                        <span className="text-muted">{s.company ? "Submitted by" : "Applicant"}: </span>
                        <Link href={`/admin/users/${s.user.id}`} className="font-medium text-brand hover:underline">{s.user.fullName}</Link>
                        <span className="text-muted"> · {s.user.phone} · account </span>
                        <StatusBadge status={s.user.status} />
                      </p>
                      {!s.company && isWorker && (
                        <div className="rounded-lg border border-line bg-canvas px-3 py-2">
                          <p className="text-xs font-medium text-muted">Registration payment (separate check)</p>
                          {payment ? (
                            <p className="mt-1">
                              <StatusBadge status={payment.status} /> <span className="text-muted">{formatMoney(payment.amountMinor, payment.currency)}</span>
                            </p>
                          ) : (
                            <p className="mt-1 text-muted">No payment record.</p>
                          )}
                        </div>
                      )}
                      {s.applicantNote && (
                        <div>
                          <p className="text-xs font-medium text-muted">Applicant note</p>
                          <p className="whitespace-pre-line text-ink">{s.applicantNote}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-muted">Documents ({s.documents.length})</p>
                        <ul className="mt-1 space-y-1">
                          {s.documents.map((d) => (
                            <li key={d.id}>
                              <FileLink href={fileUrl(d.fileId)}>
                                {humanize(d.kind)} — {d.file.originalName}
                              </FileLink>
                              <span className="ml-1 text-xs text-muted">({d.file.mimeType})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                      {ownSubmission ? (
                        <p className="text-sm text-muted">You cannot review your own submission.</p>
                      ) : (
                        <DecisionForm
                          action={reviewVerificationAction}
                          id={s.id}
                          noteHint="Required for “Request changes” and “Reject”. The applicant sees this note."
                          decisions={[
                            { value: "approve", label: "Approve", variant: "primary" },
                            { value: "request_changes", label: "Request changes", variant: "outline" },
                            { value: "reject", label: "Reject", variant: "danger" },
                          ]}
                        />
                      )}
                      {!s.company && (
                        <p className="mt-3 text-xs text-muted">
                          After approval, activate the account from the admin overview or the user page once the payment is also verified.
                        </p>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
      <Pagination page={page} pages={pages} hrefFor={(p) => `/admin/verifications${buildQuery(sp, { page: p })}`} />

      <SectionTitle title="Recent decisions" />
      {recent.length === 0 ? (
        <p className="text-sm text-muted">No decisions yet.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Type</th>
              <th>Decision</th>
              <th>Note</th>
              <th>Reviewer</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {recent.map((s) => (
              <tr key={s.id}>
                <td><Link href={`/admin/users/${s.user.id}`} className="text-brand hover:underline">{s.user.fullName}</Link></td>
                <td>{s.company ? `Company: ${s.company.name}` : "Worker identity"}</td>
                <td><StatusBadge status={s.status} /></td>
                <td className="max-w-xs text-xs text-muted">{s.reviewerNote ?? "—"}</td>
                <td>{s.reviewedBy?.fullName ?? "—"}</td>
                <td className="whitespace-nowrap">{formatDateTime(s.reviewedAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
