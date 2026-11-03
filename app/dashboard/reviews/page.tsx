import type { Metadata } from "next";
import Link from "next/link";
import { requireActivePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { Card, CardBody, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
import { Stars } from "@/components/ui/status";
import { ReportButton } from "@/components/marketplace/report-button";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const user = await requireActivePage();
  const isWorker = user.roles.includes("WORKER");
  const [received, written, wp, awaiting] = await Promise.all([
    isWorker ? db.review.findMany({ where: { subjectId: user.id }, include: { author: { select: { fullName: true } }, serviceRequest: { select: { title: true } } }, orderBy: { createdAt: "desc" } }) : [],
    db.review.findMany({ where: { authorId: user.id }, include: { subject: { select: { id: true, fullName: true } }, serviceRequest: { select: { title: true } } }, orderBy: { createdAt: "desc" } }),
    isWorker ? db.workerProfile.findUnique({ where: { userId: user.id }, select: { ratingAverage: true, ratingCount: true, completedCount: true } }) : null,
    db.serviceRequest.findMany({ where: { customerId: user.id, status: "COMPLETED", review: null }, select: { id: true, title: true, worker: { select: { fullName: true } } } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Reviews" description="Ratings come only from completed service requests — one review per request." />
      {isWorker && wp && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Average rating" value={wp.ratingAverage ? Number(wp.ratingAverage).toFixed(2) : "—"} />
          <Stat label="Visible reviews" value={wp.ratingCount} />
          <Stat label="Completed services" value={wp.completedCount} />
        </div>
      )}
      {awaiting.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="font-semibold text-ink">Waiting for your review</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {awaiting.map((r) => (
                <li key={r.id}>
                  <Link href={`/dashboard/service-requests/${r.id}`} className="text-brand hover:underline">{r.title}</Link> <span className="text-muted">— {r.worker.fullName}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
      {isWorker && (
        <section>
          <h2 className="mb-3 font-semibold text-ink">Reviews about me</h2>
          {received.length === 0 ? (
            <EmptyState title="No reviews yet" description="Complete service requests to start building your reputation." />
          ) : (
            <div className="space-y-3">
              {received.map((r) => (
                <Card key={r.id}>
                  <CardBody>
                    <div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-muted">{formatDate(r.createdAt)}</span></div>
                    {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                    <p className="mt-1 text-xs text-muted">{r.author.fullName} · {r.serviceRequest.title}{r.status === "HIDDEN" ? " · hidden by moderator" : ""}</p>
                    <div className="mt-2"><ReportButton targetType="REVIEW" targetId={r.id} label="Report or dispute this review" /></div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
      <section>
        <h2 className="mb-3 font-semibold text-ink">Reviews I wrote</h2>
        {written.length === 0 ? (
          <EmptyState title="You haven't written any reviews" />
        ) : (
          <div className="space-y-3">
            {written.map((r) => (
              <Card key={r.id}>
                <CardBody>
                  <div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-muted">{formatDate(r.createdAt)}</span></div>
                  {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                  <p className="mt-1 text-xs text-muted">For <Link href={`/workers/${r.subject.id}`} className="underline">{r.subject.fullName}</Link> · {r.serviceRequest.title}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
