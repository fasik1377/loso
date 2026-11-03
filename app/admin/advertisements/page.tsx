import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { requirePermissionPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import type { AdStatus } from "@/lib/generated/prisma";
import { adDisplayStatus } from "@/lib/domain/ads";
import { adStats } from "@/lib/services/ads";
import { fileUrl } from "@/lib/services/files";
import { buildQuery, int, str } from "@/lib/search-params";
import { formatDate, humanize } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { publicJobWhere } from "@/lib/services/jobs";
import { StaffAdForm } from "./staff-ad-form";
import { moderateAdAction } from "@/lib/actions/admin";
import { Alert, Badge, Card, CardBody, EmptyState, PageHeader, Pagination, Table, buttonClass } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { ActionButton, FilterField, ReasonForm, adminInput } from "@/components/admin/action-forms";

export const metadata: Metadata = { title: "Advertisements" };

const PAGE_SIZE = 25;
const STATUSES: readonly AdStatus[] = ["PENDING", "APPROVED", "PAUSED", "REJECTED"];

export default async function AdminAdvertisementsPage({ searchParams }: PageProps<"/admin/advertisements">) {
  const viewer = await requirePermissionPage("ads.manage");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === str(sp, "status"));
  const page = int(sp, "page") ?? 1;
  const now = new Date();

  const where: Prisma.AdvertisementWhereInput = status ? { status } : {};
  const [total, ads, jobs, revenue] = await Promise.all([
    db.advertisement.count({ where }),
    db.advertisement.findMany({
      where,
      include: { owner: { select: { id: true, fullName: true } }, placements: true, job: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.job.findMany({ where: publicJobWhere(now), select: { id: true, title: true, company: { select: { name: true } } }, orderBy: { publishedAt: "desc" }, take: 200 }),
    db.paymentTransaction.aggregate({ where: { purpose: "ADVERTISEMENT", status: "SUCCEEDED" }, _sum: { amountMinor: true } }),
  ]);
  const stats: Record<string, { impressions: number; clicks: number } | undefined> = ads.length ? await adStats(ads.map((a) => a.id)) : {};
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Advertisements"
        description="Post paid ads and sponsored jobs, and moderate ads submitted by businesses. Scheduled, active and expired are derived from the dates."
        actions={<Badge tone="success">Ad revenue recorded: {formatMoney(revenue._sum.amountMinor ?? 0)}</Badge>}
      />
      {str(sp, "created") && <div className="mb-4"><Alert tone="success">Advertisement published.</Alert></div>}

      <Card className="mb-8">
        <CardBody>
          <h2 className="font-semibold text-ink">Post a paid advertisement</h2>
          <p className="mb-4 text-sm text-muted">
            Use this after the advertiser has paid. Choose a job to run it as a <strong>sponsored job</strong>, or leave it empty for a general business ad. The fee is recorded as advertising revenue, separate from registration fees.
          </p>
          <StaffAdForm jobs={jobs.map((j) => ({ value: j.id, label: `${j.title} — ${j.company.name}` }))} />
        </CardBody>
      </Card>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3" aria-label="Filter advertisements">
        <FilterField label="Moderation status">
          <select name="status" defaultValue={status ?? ""} className={adminInput}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </FilterField>
        <button className={buttonClass("outline", "md")}>Filter</button>
      </form>

      {ads.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-8 w-8" />} title="No advertisements" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Banner</th>
              <th>Advertisement</th>
              <th>Owner</th>
              <th>Placements</th>
              <th>Runs</th>
              <th>Status</th>
              <th>Impr. / clicks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ads.map((ad) => {
              const display = adDisplayStatus(ad, now);
              const s = stats[ad.id] ?? { impressions: 0, clicks: 0 };
              const banner = fileUrl(ad.imageFileId);
              const own = ad.ownerId === viewer.id;
              return (
                <tr key={ad.id}>
                  <td>
                    {banner ? (
                      <a href={banner} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- served by the authorized file route */}
                        <img src={banner} alt={`Banner for ${ad.title}`} className="h-14 w-24 rounded border border-line object-cover" loading="lazy" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted">No image</span>
                    )}
                  </td>
                  <td className="min-w-[14rem] max-w-sm">
                    <p className="font-medium text-ink">{ad.title}</p>
                    <p className="text-xs text-muted">{ad.businessName}</p>
                    {ad.job && <p className="mt-1 text-xs">Sponsored job: <Link href={`/jobs/${ad.job.id}`} className="text-brand hover:underline">{ad.job.title}</Link></p>}
                    {ad.postedByStaff && <Badge tone="brand">Posted by admin</Badge>}
                    {ad.body && <p className="mt-1 text-xs text-ink">{ad.body}</p>}
                    {ad.destinationUrl && <p className="mt-1 break-all font-mono text-xs text-muted">{ad.destinationUrl}</p>}
                    {ad.moderationNote && <p className="mt-1 text-xs text-muted">Note: {ad.moderationNote}</p>}
                  </td>
                  <td>
                    <Link href={`/admin/users/${ad.owner.id}`} className="hover:underline">{ad.owner.fullName}</Link>
                    {(ad.contactPhone || ad.contactEmail) && (
                      <p className="text-xs text-muted">{[ad.contactPhone, ad.contactEmail].filter(Boolean).join(" · ")}</p>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">{ad.placements.map((p) => <Badge key={p.slot}>{humanize(p.slot)}</Badge>)}</div>
                  </td>
                  <td className="whitespace-nowrap text-xs">{formatDate(ad.startsAt)} – {formatDate(ad.endsAt)}</td>
                  <td>
                    <StatusBadge status={display} />
                    {ad.chargeMinor ? <p className="mt-1 text-xs text-success">Paid {formatMoney(ad.chargeMinor, ad.currency)}</p> : !ad.isPaid && <p className="mt-1 text-xs text-muted">Unpaid</p>}
                  </td>
                  <td className="whitespace-nowrap">{s.impressions} / {s.clicks}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {(ad.status === "PENDING" || ad.status === "REJECTED") && !own && (
                        <ActionButton action={moderateAdAction} fields={{ id: ad.id, action: "approve" }} label="Approve" variant="primary" />
                      )}
                      {ad.status === "PENDING" && <ReasonForm action={moderateAdAction} fields={{ id: ad.id, action: "reject" }} label="Reject" />}
                      {ad.status === "APPROVED" && <ActionButton action={moderateAdAction} fields={{ id: ad.id, action: "pause" }} label="Pause" />}
                      {ad.status === "PAUSED" && <ActionButton action={moderateAdAction} fields={{ id: ad.id, action: "resume" }} label="Resume" variant="primary" />}
                      {own && ad.status === "PENDING" && <p className="text-xs text-muted">Your own ad — another admin must approve it.</p>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pages={pages} hrefFor={(p) => `/admin/advertisements${buildQuery(sp, { page: p })}`} />
    </div>
  );
}
