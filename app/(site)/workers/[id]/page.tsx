import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Languages, MapPin, MessageSquare, Phone, Wrench } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canSeeContact, getPublicWorker } from "@/lib/services/workers";
import { areaLocations } from "@/lib/services/taxonomy";
import { fileUrl } from "@/lib/services/files";
import { contactUserAction } from "@/lib/actions/member";
import { formatRange } from "@/lib/money";
import { formatDate, humanize } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { AppError } from "@/lib/errors";
import { Alert, Avatar, Badge, Button, ButtonLink, Card, CardBody, EmptyState } from "@/components/ui/primitives";
import { Rating, Stars, VerifiedBadge } from "@/components/ui/status";
import { ReportButton } from "@/components/marketplace/report-button";
import { AdSlot } from "@/components/marketplace/ad-slot";
import { ServiceRequestForm } from "./service-request-form";

export const metadata: Metadata = { title: "Worker profile" };

export default async function WorkerProfilePage({ params }: PageProps<"/workers/[id]">) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const worker = await getPublicWorker(id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const wp = worker.workerProfile!;
  const [approvedCount, showPhone, locations] = await Promise.all([
    db.verificationSubmission.count({ where: { userId: worker.id, companyId: null, status: "APPROVED" } }),
    canSeeContact(viewer, worker.id, worker.profile?.phoneVisibility ?? "CONNECTIONS"),
    areaLocations(),
  ]);
  const isVerified = !worker.isDemo && approvedCount > 0;
  const avg = wp.ratingAverage ? Number(wp.ratingAverage) : null;
  const price = formatRange(wp.priceMinMinor, wp.priceMaxMinor, wp.currency);
  const isSelf = viewer?.id === worker.id;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card>
          <CardBody>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar name={worker.fullName} src={fileUrl(worker.profile?.avatarFileId)} size={88} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-ink">{worker.fullName}</h1>
                  {worker.isDemo ? <Badge tone="warning">Demo profile</Badge> : isVerified && <VerifiedBadge />}
                </div>
                {wp.headline && <p className="mt-1 text-muted">{wp.headline}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                  <Rating average={avg} count={wp.ratingCount} />
                  <span className="text-muted">{wp.completedCount} services completed on Loso</span>
                  <span className={wp.availability === "AVAILABLE" ? "font-medium text-success" : "text-muted"}>{humanize(wp.availability)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  {wp.areas.length > 0 && (
                    <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {wp.areas.map((a) => a.location.name).join(", ")}</span>
                  )}
                  {worker.profile?.languages.length ? (
                    <span className="inline-flex items-center gap-1"><Languages className="h-4 w-4" /> {worker.profile.languages.join(", ")}</span>
                  ) : null}
                  {wp.yearsExperience != null && <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {wp.yearsExperience} years experience</span>}
                </div>
              </div>
            </div>
            {worker.profile?.bio && <p className="mt-4 whitespace-pre-line text-sm text-ink/90">{worker.profile.bio}</p>}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="flex items-center gap-2 font-semibold text-ink"><Wrench className="h-5 w-5 text-brand" /> Services</h2>
            {wp.services.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No services listed yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {wp.services.map((s) => (
                  <li key={s.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-ink">{s.title}</p>
                      <p className="text-xs text-muted">{s.category.name}</p>
                      {s.description && <p className="mt-1 text-sm text-ink/80">{s.description}</p>}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-brand">
                      {formatRange(s.priceMinMinor, s.priceMaxMinor, s.currency) ?? "Price on request"} {s.pricingMethod !== "NEGOTIABLE" && <span className="font-normal text-muted">({humanize(s.pricingMethod)})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {wp.skills.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {wp.skills.map((s) => <Badge key={s.skillId} tone="brand">{s.skill.name}</Badge>)}
              </div>
            )}
          </CardBody>
        </Card>

        {(wp.experienceSummary || wp.qualifications) && (
          <Card>
            <CardBody className="space-y-4">
              {wp.experienceSummary && (
                <div>
                  <h2 className="font-semibold text-ink">Experience</h2>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink/90">{wp.experienceSummary}</p>
                </div>
              )}
              {wp.qualifications && (
                <div>
                  <h2 className="font-semibold text-ink">Qualifications</h2>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink/90">{wp.qualifications}</p>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {wp.portfolio.length > 0 && (
          <Card>
            <CardBody>
              <h2 className="font-semibold text-ink">Work portfolio</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {wp.portfolio.map((p) => (
                  <figure key={p.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- authorized file route */}
                    <img src={fileUrl(p.fileId)!} alt={p.title} loading="lazy" className="aspect-square w-full rounded-lg border border-line object-cover" />
                    <figcaption className="mt-1 text-xs text-muted">{p.title}</figcaption>
                  </figure>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody>
            <h2 className="font-semibold text-ink">Reviews ({wp.ratingCount})</h2>
            {worker.reviewsReceived.length === 0 ? (
              <EmptyState title="No reviews yet" description="Reviews can only be left by customers after a completed service request." />
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {worker.reviewsReceived.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <Stars value={r.rating} />
                      <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                    </div>
                    {r.comment && <p className="mt-1 text-sm text-ink/90">{r.comment}</p>}
                    <p className="mt-1 text-xs text-muted">
                      {r.author.fullName.split(" ")[0]} · {r.serviceRequest.category.name} · Verified completed request
                    </p>
                    {viewer && viewer.id !== r.authorId && <div className="mt-1"><ReportButton targetType="REVIEW" targetId={r.id} label="Report review" /></div>}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <AdSlot slot="WORKER_PROFILE" />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm text-muted">Starting price</p>
            <p className="text-xl font-bold text-brand">{price ?? "Price on request"}</p>
            <p className="text-xs text-muted">Pricing: {humanize(wp.pricingMethod)}{wp.availabilityNote ? ` · ${wp.availabilityNote}` : ""}</p>
            {isSelf ? (
              <ButtonLink href="/dashboard/profile" variant="outline" className="w-full">Edit my profile</ButtonLink>
            ) : !viewer ? (
              <>
                <ButtonLink href={`/login?next=/workers/${worker.id}`} className="w-full">Sign in to contact</ButtonLink>
                <p className="text-center text-xs text-muted">Customers register for free.</p>
              </>
            ) : viewer.status !== "ACTIVE" ? (
              <Alert tone="warning">Your account must be active to contact workers.</Alert>
            ) : (
              <>
                <form action={contactUserAction}>
                  <input type="hidden" name="userId" value={worker.id} />
                  <Button variant="outline" className="w-full"><MessageSquare className="h-4 w-4" /> Send a message</Button>
                </form>
                {showPhone ? (
                  <a href={`tel:${worker.phone}`} className="flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2 text-sm font-semibold text-brand hover:bg-canvas">
                    <Phone className="h-4 w-4" /> Call {formatPhone(worker.phone)}
                  </a>
                ) : (
                  <p className="text-xs text-muted">Phone number is shared only according to this worker&apos;s privacy settings — usually after they accept your request.</p>
                )}
              </>
            )}
          </CardBody>
        </Card>
        {viewer?.status === "ACTIVE" && !isSelf && wp.services.length > 0 && wp.availability !== "UNAVAILABLE" && (
          <Card>
            <CardBody>
              <h2 className="font-semibold text-ink">Request a service</h2>
              <p className="mt-1 text-xs text-muted">The worker will accept or decline. Nothing is charged through Loso.</p>
              <div className="mt-4">
                <ServiceRequestForm
                  workerId={worker.id}
                  services={wp.services.map((s) => ({ value: s.categoryId, label: s.title }))}
                  locations={locations.map((l) => ({ value: l.id, label: l.label }))}
                />
              </div>
            </CardBody>
          </Card>
        )}
        {viewer && !isSelf && <ReportButton targetType="USER" targetId={worker.id} label="Report this profile" />}
        {!viewer && <p className="text-center text-xs text-muted"><Link href="/help#safety" className="underline">Safety tips</Link> for hiring workers</p>}
      </aside>
    </div>
  );
}
