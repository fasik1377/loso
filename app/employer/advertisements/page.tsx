import type { Metadata } from "next";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { adStats } from "@/lib/services/ads";
import { adDisplayStatus } from "@/lib/domain/ads";
import { fileUrl } from "@/lib/services/files";
import { str } from "@/lib/search-params";
import { formatDate, humanize } from "@/lib/format";
import { Alert, Card, CardBody, EmptyState, PageHeader, Table } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { toggleAdPauseAction } from "@/lib/actions/employer";
import { AdForm } from "./ad-form";

export const metadata: Metadata = { title: "Advertising" };

export default async function AdvertisementsPage({ searchParams }: PageProps<"/employer/advertisements">) {
  const user = await requireRolePage("EMPLOYER");
  const sp = await searchParams;
  const ads = await db.advertisement.findMany({ where: { ownerId: user.id }, include: { placements: true }, orderBy: { createdAt: "desc" } });
  const stats = await adStats(ads.map((a) => a.id));

  return (
    <div className="space-y-6">
      <PageHeader title="Advertising" description="Promote your business on Loso. Every ad is reviewed before it goes live and is clearly labelled “Sponsored”." />
      {str(sp, "created") && <Alert tone="success">Advertisement submitted. You&apos;ll be notified when it is reviewed.</Alert>}
      <Alert title="Payment for advertising">
        Advertising is billed separately from worker registration fees. Online ad payments are not enabled yet — Loso staff will contact you with pricing and payment instructions after review.
      </Alert>

      {ads.length === 0 ? (
        <EmptyState title="No advertisements yet" description="Create your first ad below." />
      ) : (
        <Table>
          <thead>
            <tr><th>Ad</th><th>Status</th><th>Placements</th><th>Dates</th><th>Impressions</th><th>Clicks</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ads.map((ad) => {
              const display = adDisplayStatus(ad);
              const s = stats[ad.id]!;
              return (
                <tr key={ad.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- authorized file route */}
                      {ad.imageFileId && <img src={fileUrl(ad.imageFileId)!} alt="" className="h-10 w-14 rounded object-cover" />}
                      <div>
                        <p className="font-medium text-ink">{ad.title}</p>
                        <p className="text-xs text-muted">{ad.businessName}</p>
                        {ad.moderationNote && <p className="text-xs text-danger">Reviewer: {ad.moderationNote}</p>}
                      </div>
                    </div>
                  </td>
                  <td><StatusBadge status={display} /></td>
                  <td className="text-xs">{ad.placements.map((p) => humanize(p.slot)).join(", ")}</td>
                  <td className="whitespace-nowrap text-xs">{formatDate(ad.startsAt)} – {formatDate(ad.endsAt)}</td>
                  <td>{s.impressions}</td>
                  <td>{s.clicks}{s.impressions ? <span className="text-xs text-muted"> ({((s.clicks / s.impressions) * 100).toFixed(1)}%)</span> : null}</td>
                  <td>
                    {(ad.status === "APPROVED" || ad.status === "PAUSED") && (
                      <ActionForm action={toggleAdPauseAction} showSuccess={false} className="space-y-0">
                        <input type="hidden" name="id" value={ad.id} />
                        <input type="hidden" name="pause" value={ad.status === "APPROVED" ? "1" : "0"} />
                        <SubmitButton size="sm" variant="outline">{ad.status === "APPROVED" ? "Pause" : "Resume"}</SubmitButton>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Card>
        <CardBody>
          <h2 className="mb-4 font-semibold text-ink">Create an advertisement</h2>
          <AdForm />
        </CardBody>
      </Card>
    </div>
  );
}
