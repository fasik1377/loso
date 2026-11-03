import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare, Phone } from "lucide-react";
import { requireActivePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getServiceRequestFor } from "@/lib/services/service-requests";
import { canSeeContact } from "@/lib/services/workers";
import { availableActions } from "@/lib/domain/service-request";
import { reviewEligibility } from "@/lib/domain/review";
import { fileUrl } from "@/lib/services/files";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { str } from "@/lib/search-params";
import { openServiceChatAction } from "@/lib/actions/member";
import { Alert, Button, Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { StatusBadge, Stars } from "@/components/ui/status";
import { ReportButton } from "@/components/marketplace/report-button";
import { RequestActions, ReviewForm } from "./request-actions";

export const metadata: Metadata = { title: "Service request" };

export default async function ServiceRequestDetailPage({ params, searchParams }: PageProps<"/dashboard/service-requests/[id]">) {
  const user = await requireActivePage();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const req = await getServiceRequestFor(user, id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const role = req.customerId === user.id ? "customer" : "worker";
  const other = role === "customer" ? req.worker : req.customer;
  const otherProfile = await db.userProfile.findUnique({ where: { userId: other.id }, select: { phoneVisibility: true } });
  const showPhone = await canSeeContact(user, other.id, otherProfile?.phoneVisibility ?? "CONNECTIONS");
  const actions = availableActions(req.status, role).filter((a) => !(a === "markFinished" && req.workerFinishedAt));
  const reviewOk = reviewEligibility({ ...req, hasReview: !!req.review }, user.id).ok;

  const timeline = [
    ["Requested", req.createdAt],
    ["Accepted", req.acceptedAt],
    ["Started", req.startedAt],
    ["Worker reported finished", req.workerFinishedAt],
    ["Completed (confirmed by customer)", req.completedAt],
    ["Declined", req.declinedAt],
    ["Cancelled", req.cancelledAt],
  ].filter(([, d]) => d) as [string, Date][];

  return (
    <div className="space-y-6">
      {str(sp, "created") && <Alert tone="success">Your request was sent. You&apos;ll be notified when the worker responds.</Alert>}
      <PageHeader title={req.title} description={`${req.category.name} · ${role === "customer" ? "Worker" : "Customer"}: ${other.fullName}`} actions={<StatusBadge status={req.status} />} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-4 text-sm">
              <p className="whitespace-pre-line text-ink">{req.description}</p>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div><dt className="text-xs text-muted">Preferred time</dt><dd>{req.preferredAt ? formatDateTime(req.preferredAt) : "Flexible"}</dd></div>
                <div><dt className="text-xs text-muted">Area</dt><dd>{req.location?.name ?? "Not specified"}</dd></div>
                <div><dt className="text-xs text-muted">Address details</dt><dd>{req.addressDetail ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted">Budget</dt><dd>{req.budgetMinor != null ? formatMoney(req.budgetMinor, req.currency) : "Not specified"}</dd></div>
              </dl>
              {req.attachments.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {req.attachments.map((a) => (
                    <a key={a.id} href={fileUrl(a.fileId)!} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element -- authorized private file route */}
                      <img src={fileUrl(a.fileId)!} alt="Attached photo" className="aspect-square w-full rounded-lg border border-line object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {req.declineReason && <Alert tone="danger" title="Decline reason">{req.declineReason}</Alert>}
              {req.cancelReason && <Alert title="Cancellation reason">{req.cancelReason}</Alert>}
              {role === "customer" && req.workerFinishedAt && req.status === "IN_PROGRESS" && (
                <Alert tone="warning" title="The worker reported this job as finished">Check the work, then confirm completion below. Only confirm if the work was actually done.</Alert>
              )}
            </CardBody>
          </Card>

          {actions.length > 0 && (
            <Card>
              <CardBody>
                <h2 className="mb-3 font-semibold text-ink">Next steps</h2>
                <RequestActions id={req.id} actions={actions} />
              </CardBody>
            </Card>
          )}

          {req.review ? (
            <Card>
              <CardBody>
                <h2 className="font-semibold text-ink">Review</h2>
                <div className="mt-2"><Stars value={req.review.rating} /></div>
                {req.review.comment && <p className="mt-1 text-sm">{req.review.comment}</p>}
                {req.review.status === "HIDDEN" && <p className="mt-1 text-xs text-muted">This review was hidden by a moderator.</p>}
              </CardBody>
            </Card>
          ) : reviewOk ? (
            <Card>
              <CardBody>
                <h2 className="font-semibold text-ink">Rate this service</h2>
                <p className="mb-3 text-sm text-muted">Your review is public and can be submitted once.</p>
                <ReviewForm serviceRequestId={req.id} />
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <h2 className="font-semibold text-ink">{other.fullName}</h2>
              {role === "customer" && <Link href={`/workers/${other.id}`} className="text-sm text-brand hover:underline">View worker profile</Link>}
              <form action={openServiceChatAction}>
                <input type="hidden" name="id" value={req.id} />
                <Button variant="outline" className="w-full"><MessageSquare className="h-4 w-4" /> Open chat</Button>
              </form>
              {showPhone ? (
                <a href={`tel:${other.phone}`} className="flex items-center justify-center gap-2 rounded-lg border border-line py-2 text-sm font-semibold text-brand hover:bg-canvas">
                  <Phone className="h-4 w-4" /> {formatPhone(other.phone)}
                </a>
              ) : (
                <p className="text-xs text-muted">Phone number not shared. Use chat.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <h2 className="mb-2 font-semibold text-ink">Timeline</h2>
              <ol className="space-y-2 text-sm">
                {timeline.map(([label, d]) => (
                  <li key={label} className="flex justify-between gap-2"><span>{label}</span><span className="text-xs text-muted">{formatDateTime(d)}</span></li>
                ))}
              </ol>
            </CardBody>
          </Card>
          <ReportButton targetType="SERVICE_REQUEST" targetId={req.id} label="Report a problem with this request" />
        </aside>
      </div>
    </div>
  );
}
