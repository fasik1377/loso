import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { SitePageSkeleton } from "@/components/layout/site-page-skeleton";
import Link from "next/link";
import { CheckCircle2, Circle, CircleDot, XCircle } from "lucide-react";
import { requireUserPage } from "@/lib/auth/guards";
import { getAccountSnapshot } from "@/lib/services/accounts";
import { getSettings } from "@/lib/settings";
import { STAGE_INFO, requiresRegistrationFee, requiresVerification } from "@/lib/domain/account";
import { formatMoney } from "@/lib/money";
import { formatDateTime, humanize } from "@/lib/format";
import { logoutAction } from "@/lib/actions/auth";
import { Alert, Badge, ButtonLink, Card, CardBody } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { PaymentForm } from "./payment-form";
import { VerificationForm } from "./verification-form";
import { CompanyVerificationForm } from "@/app/employer/company/forms";

export const metadata: Metadata = { title: "Account status" };

async function AccountStatusPageContent() {
  await connection(); // live data: render per request
  const user = await requireUserPage();
  const [{ payment, verification, snapshot, stage, user: full }, settings] = await Promise.all([getAccountSnapshot(user.id), getSettings()]);
  const info = STAGE_INFO[stage];
  const needsFee = requiresRegistrationFee(snapshot.roles);
  const needsDocs = requiresVerification(snapshot.roles);
  const isEmployer = snapshot.roles.includes("EMPLOYER");
  const paymentDone = payment?.status === "VERIFIED" || payment?.status === "WAIVED";
  const latestTxn = payment?.transactions[0];
  const toneMap = { neutral: "neutral", warning: "warning", success: "success", danger: "danger" } as const;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Account status</h1>
        <Badge tone={toneMap[info.tone]}>{info.label}</Badge>
      </div>
      <p className="mt-2 text-muted">{info.help}</p>
      {stage !== "ACTIVE" && !["REJECTED", "SUSPENDED"].includes(stage) && (
        <div className="mt-4">
          <Alert tone="warning" title="Admin verification required">
            Every new Looso account is reviewed by an administrator. You can only use Looso after your account is approved — we&apos;ll notify you here.
          </Alert>
        </div>
      )}
      {full.statusReason && ["REJECTED", "SUSPENDED"].includes(stage) && (
        <div className="mt-4"><Alert tone="danger" title="Reason">{full.statusReason}</Alert></div>
      )}

      {stage === "ACTIVE" ? (
        <div className="mt-6">
          <ButtonLink href="/dashboard">Go to your dashboard</ButtonLink>
        </div>
      ) : (
        <ol className="mt-8 space-y-4">
          <Step n={1} title="Create your account" state="done" />

          {needsFee && (
            <Step
              n={2}
              title="Pay the registration fee"
              state={paymentDone ? "done" : payment?.status === "UNDER_REVIEW" ? "waiting" : payment?.status === "REJECTED" ? "failed" : "current"}
            >
              {payment && (
                <div className="space-y-3 text-sm">
                  <p>
                    Amount due: <strong>{formatMoney(payment.amountMinor, payment.currency)}</strong> · Status: <StatusBadge status={payment.status} />
                  </p>
                  {payment.status === "VERIFIED" && payment.receiptNumber && (
                    <p className="text-muted">Receipt no. <span className="font-mono">{payment.receiptNumber}</span> · confirmed {formatDateTime(payment.reviewedAt)}</p>
                  )}
                  {payment.status === "WAIVED" && <p className="text-muted">The registration fee is currently waived by Looso.</p>}
                  {payment.status === "REJECTED" && payment.reviewNote && <Alert tone="danger" title="Why the payment was not confirmed">{payment.reviewNote}</Alert>}
                  {latestTxn && (
                    <p className="text-muted">
                      Last submission: {humanize(latestTxn.method ?? "manual")} · ref <span className="font-mono">{latestTxn.providerReference}</span> · {formatDateTime(latestTxn.createdAt)} · <StatusBadge status={latestTxn.status} />
                    </p>
                  )}
                  {(payment.status === "AWAITING_PAYMENT" || payment.status === "REJECTED") && (
                    <>
                      <Alert title="How to pay">
                        <p className="whitespace-pre-line">{settings.manualPaymentInstructions}</p>
                        <p className="mt-2 text-xs">
                          Payments are confirmed manually by Looso staff against the official account statement. Online payment (e.g. Chapa / Telebirr checkout) is not enabled yet.
                        </p>
                      </Alert>
                      <PaymentForm />
                    </>
                  )}
                </div>
              )}
            </Step>
          )}

          {needsDocs && (
            <Step
              n={needsFee ? 3 : 2}
              title={isEmployer ? "Verify your company" : "Verify your identity"}
              state={
                verification?.status === "APPROVED"
                  ? "done"
                  : verification?.status === "SUBMITTED"
                    ? "waiting"
                    : verification?.status === "REJECTED"
                      ? "failed"
                      : "current"
              }
            >
              <div className="space-y-3 text-sm">
                {verification && (
                  <p>
                    Submitted {formatDateTime(verification.createdAt)} · <StatusBadge status={verification.status} />
                  </p>
                )}
                {verification?.reviewerNote && verification.status !== "APPROVED" && (
                  <Alert tone={verification.status === "REJECTED" ? "danger" : "warning"} title="Reviewer note">{verification.reviewerNote}</Alert>
                )}
                {(!verification || verification.status === "CHANGES_REQUESTED") &&
                  (isEmployer ? (
                    <>
                      <p className="text-muted">Upload your business license or registration certificate. An administrator must verify it before you can sign in to your employer dashboard and post jobs.</p>
                      <CompanyVerificationForm />
                    </>
                  ) : (
                    <VerificationForm />
                  ))}
              </div>
            </Step>
          )}

          <Step n={2 + (needsFee ? 1 : 0) + (needsDocs ? 1 : 0)} title="Admin approval" state={stage === "AWAITING_ACTIVATION" ? "waiting" : "todo"}>
            <p className="text-sm text-muted">{needsFee || needsDocs ? "After the checks above pass, an" : "An"} administrator reviews and approves your account. You&apos;ll get a notification as soon as it is active.</p>
          </Step>
        </ol>
      )}

      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link href="/help" className="text-brand hover:underline">Help center</Link>
        <Link href="/contact" className="text-brand hover:underline">Contact support</Link>
        <form action={logoutAction}><button className="text-muted hover:text-ink">Sign out</button></form>
      </div>
    </div>
  );
}

function Step({ n, title, state, children }: { n: number; title: string; state: "done" | "current" | "waiting" | "failed" | "todo"; children?: ReactNode }) {
  const Icon = state === "done" ? CheckCircle2 : state === "failed" ? XCircle : state === "todo" ? Circle : CircleDot;
  const color = state === "done" ? "text-success" : state === "failed" ? "text-danger" : state === "todo" ? "text-slate-300" : "text-gold-600";
  const label = { done: "Complete", current: "Action needed", waiting: "In review", failed: "Needs attention", todo: "Not started" }[state];
  return (
    <li>
      <Card>
        <CardBody>
          <div className="flex items-center gap-3">
            <Icon className={`h-6 w-6 shrink-0 ${color}`} aria-hidden="true" />
            <h2 className="flex-1 font-semibold text-ink">
              Step {n}: {title}
            </h2>
            <span className="text-xs text-muted">{label}</span>
          </div>
          {children && state !== "done" && <div className="mt-4 pl-9">{children}</div>}
          {children && state === "done" && <div className="mt-2 pl-9">{children}</div>}
        </CardBody>
      </Card>
    </li>
  );
}

// Live data streams in behind Suspense so navigation shows the page shell instantly.
export default function AccountStatusPage() {
  return (
    <Suspense fallback={<SitePageSkeleton />}>
      <AccountStatusPageContent />
    </Suspense>
  );
}
