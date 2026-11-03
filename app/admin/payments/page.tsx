import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { requirePermissionPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import type { TransactionStatus } from "@/lib/generated/prisma";
import { getSettings } from "@/lib/settings";
import { fileUrl } from "@/lib/services/files";
import { buildQuery, int, str } from "@/lib/search-params";
import { formatMoney } from "@/lib/money";
import { formatDateTime, humanize, timeAgo } from "@/lib/format";
import { reviewPaymentAction } from "@/lib/actions/admin";
import { Alert, Card, CardBody, EmptyState, PageHeader, Pagination, Table, buttonClass } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { DecisionForm, FileLink, FilterField, SectionTitle, adminInput } from "@/components/admin/action-forms";

export const metadata: Metadata = { title: "Manual payment review" };

const PAGE_SIZE = 25;
const TXN_STATUSES: readonly TransactionStatus[] = ["SUBMITTED", "PENDING", "SUCCEEDED", "FAILED", "REJECTED"];

export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const viewer = await requirePermissionPage("payments.review");
  const sp = await searchParams;
  const status = TXN_STATUSES.find((s) => s === str(sp, "status"));
  const page = int(sp, "page") ?? 1;
  const now = new Date();

  const historyWhere: Prisma.PaymentTransactionWhereInput = status ? { status } : {};
  const [settings, queue, historyTotal, history] = await Promise.all([
    getSettings(),
    db.registrationPayment.findMany({
      where: { status: "UNDER_REVIEW" },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        transactions: { where: { status: "SUBMITTED" }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "asc" },
      take: 50,
    }),
    db.paymentTransaction.count({ where: historyWhere }),
    db.paymentTransaction.findMany({
      where: historyWhere,
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(historyTotal / PAGE_SIZE));

  const reviewerIds = [...new Set(history.map((t) => t.verifiedById).filter((x): x is string => !!x))];
  const reviewers = reviewerIds.length ? await db.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, fullName: true } }) : [];
  const reviewerName = new Map(reviewers.map((r) => [r.id, r.fullName]));

  return (
    <div>
      <PageHeader
        title="Manual payment review"
        description="Confirm registration payments against the official account statement. No automated payment provider is configured."
      />

      <Alert title="Current registration fee">
        {settings.registrationFeeMinor === 0
          ? "Registration fee is currently waived (0). New registrations do not need to pay."
          : `${formatMoney(settings.registrationFeeMinor, settings.registrationFeeCurrency)} for new worker registrations.`}{" "}
        Each payment keeps the amount captured when the account was created.
      </Alert>

      <SectionTitle title={`Waiting for review (${queue.length})`} description="Verify only after you have matched the reference and amount on the statement." />
      {queue.length === 0 ? (
        <EmptyState icon={<Wallet className="h-8 w-8" />} title="No payments waiting" description="Submitted payment references will appear here." />
      ) : (
        <div className="space-y-4">
          {queue.map((p) => {
            const t = p.transactions[0];
            return (
              <Card key={p.id}>
                <CardBody>
                  <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
                    <div className="space-y-2 text-sm">
                      <p>
                        <Link href={`/admin/users/${p.user.id}`} className="text-base font-semibold text-brand hover:underline">{p.user.fullName}</Link>
                        <span className="text-muted"> · {p.user.phone}</span>
                      </p>
                      <p>Amount due: <strong>{formatMoney(p.amountMinor, p.currency)}</strong></p>
                      {t ? (
                        <dl className="grid gap-3 sm:grid-cols-2">
                          <div><dt className="text-xs text-muted">Method</dt><dd>{humanize(t.method ?? t.provider)}</dd></div>
                          <div><dt className="text-xs text-muted">Reference</dt><dd className="font-mono">{t.providerReference ?? "—"}</dd></div>
                          <div>
                            <dt className="text-xs text-muted">Amount submitted</dt>
                            <dd className={t.amountMinor !== p.amountMinor ? "font-semibold text-danger" : ""}>{formatMoney(t.amountMinor, t.currency)}</dd>
                          </div>
                          <div><dt className="text-xs text-muted">Submitted</dt><dd>{formatDateTime(t.createdAt)} ({timeAgo(t.createdAt, now)})</dd></div>
                          <div><dt className="text-xs text-muted">Proof</dt><dd><FileLink href={fileUrl(t.proofFileId)}>Open proof file</FileLink></dd></div>
                        </dl>
                      ) : (
                        <p className="text-danger">No submitted transaction found for this payment.</p>
                      )}
                    </div>
                    <div className="border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                      {p.userId === viewer.id ? (
                        <p className="text-sm text-muted">You cannot review your own payment.</p>
                      ) : t ? (
                        <DecisionForm
                          action={reviewPaymentAction}
                          id={p.id}
                          noteLabel="Note to the payer"
                          noteHint="Required when rejecting — explain what to correct."
                          decisions={[
                            { value: "verify", label: "Verify payment", variant: "primary" },
                            { value: "reject", label: "Reject", variant: "danger" },
                          ]}
                        />
                      ) : null}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <SectionTitle title="Transaction history" description={`${historyTotal} transaction(s).`} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3" aria-label="Filter transactions">
        <FilterField label="Status">
          <select name="status" defaultValue={status ?? ""} className={adminInput}>
            <option value="">All statuses</option>
            {TXN_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </FilterField>
        <button className={buttonClass("outline", "md")}>Filter</button>
      </form>
      {history.length === 0 ? (
        <p className="text-sm text-muted">No transactions.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Submitted</th>
              <th>Payer</th>
              <th>Purpose</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Proof</th>
              <th>Reviewed by</th>
              <th>Reviewed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {history.map((t) => (
              <tr key={t.id}>
                <td className="whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
                <td><Link href={`/admin/users/${t.user.id}`} className="text-brand hover:underline">{t.user.fullName}</Link></td>
                <td>{humanize(t.purpose)}</td>
                <td>{humanize(t.method ?? t.provider)}</td>
                <td className="font-mono text-xs">{t.providerReference ?? "—"}</td>
                <td className="whitespace-nowrap">{formatMoney(t.amountMinor, t.currency)}</td>
                <td>
                  <StatusBadge status={t.status} />
                  {t.failureReason && <p className="mt-1 max-w-[14rem] text-xs text-muted">{t.failureReason}</p>}
                </td>
                <td><FileLink href={fileUrl(t.proofFileId)}>Proof</FileLink></td>
                <td>{t.verifiedById ? (reviewerName.get(t.verifiedById) ?? "Staff") : "—"}</td>
                <td className="whitespace-nowrap">{formatDateTime(t.verifiedAt ?? (t.verifiedById ? t.updatedAt : null))}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pages={pages} hrefFor={(p) => `/admin/payments${buildQuery(sp, { page: p })}`} />
    </div>
  );
}
