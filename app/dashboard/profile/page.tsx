import type { Metadata } from "next";
import Link from "next/link";
import { requireActivePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { areaLocations, serviceCategories, skills } from "@/lib/services/taxonomy";
import { fileUrl } from "@/lib/services/files";
import { formatRange } from "@/lib/money";
import { humanize } from "@/lib/format";
import { Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { removePortfolioAction, removeServiceAction } from "@/lib/actions/member";
import { BasicProfileForm, PortfolioForm, ServiceForm, WorkProfileForm } from "./forms";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const user = await requireActivePage();
  const isWorker = user.roles.includes("WORKER");
  const [full, locations, allSkills, categories] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        profile: true,
        workerProfile: {
          include: {
            skills: true,
            areas: true,
            services: { include: { category: true }, orderBy: { createdAt: "asc" } },
            portfolio: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    }),
    areaLocations(),
    isWorker ? skills() : [],
    isWorker ? serviceCategories() : [],
  ]);
  const wp = full.workerProfile;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        description={isWorker ? "This is what customers and employers see." : "Your account details."}
        actions={isWorker ? <Link href={`/workers/${user.id}`} className="text-sm font-semibold text-brand hover:underline">View public profile</Link> : undefined}
      />

      <Card>
        <CardBody>
          <h2 className="mb-4 font-semibold text-ink">Basic information</h2>
          <BasicProfileForm
            locations={locations.map((l) => ({ value: l.id, label: l.label }))}
            defaults={{
              fullName: full.fullName,
              email: full.email ?? "",
              bio: full.profile?.bio ?? "",
              locationId: full.profile?.locationId ?? "",
              languages: full.profile?.languages.join(", ") ?? "",
              phoneVisibility: full.profile?.phoneVisibility ?? "CONNECTIONS",
              avatarUrl: fileUrl(full.profile?.avatarFileId),
            }}
          />
        </CardBody>
      </Card>

      {isWorker && wp && (
        <>
          <Card>
            <CardBody>
              <h2 className="mb-4 font-semibold text-ink">Work profile</h2>
              <WorkProfileForm
                skills={allSkills.map((s) => ({ value: s.id, label: s.name }))}
                areas={locations.map((l) => ({ value: l.id, label: l.label }))}
                defaults={{
                  headline: wp.headline ?? "",
                  seeksJobs: wp.seeksJobs,
                  offersServices: wp.offersServices,
                  yearsExperience: wp.yearsExperience?.toString() ?? "",
                  experienceSummary: wp.experienceSummary ?? "",
                  qualifications: wp.qualifications ?? "",
                  availability: wp.availability,
                  availabilityNote: wp.availabilityNote ?? "",
                  pricingMethod: wp.pricingMethod,
                  priceMin: wp.priceMinMinor != null ? String(wp.priceMinMinor / 100) : "",
                  priceMax: wp.priceMaxMinor != null ? String(wp.priceMaxMinor / 100) : "",
                  skillIds: wp.skills.map((s) => s.skillId),
                  areaIds: wp.areas.map((a) => a.locationId),
                }}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="font-semibold text-ink">Services I offer</h2>
              <p className="mb-4 text-sm text-muted">One entry per category. Customers can request any active service.</p>
              {wp.services.length > 0 && (
                <ul className="mb-6 divide-y divide-line rounded-lg border border-line">
                  {wp.services.map((s) => (
                    <li key={s.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-ink">{s.title}</p>
                        <p className="text-xs text-muted">
                          {s.category.name} · {formatRange(s.priceMinMinor, s.priceMaxMinor, s.currency) ?? "Price on request"} · {humanize(s.pricingMethod)}
                        </p>
                      </div>
                      <ActionForm action={removeServiceAction} showSuccess={false} className="space-y-0">
                        <input type="hidden" name="id" value={s.id} />
                        <SubmitButton variant="outline" size="sm">Remove</SubmitButton>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              )}
              <ServiceForm categories={categories.map((c) => ({ value: c.id, label: c.name }))} />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="font-semibold text-ink">Work portfolio</h2>
              <p className="mb-4 text-sm text-muted">Photos of your previous work (public). Up to 12 items.</p>
              {wp.portfolio.length > 0 && (
                <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {wp.portfolio.map((p) => (
                    <figure key={p.id} className="space-y-1">
                      {/* eslint-disable-next-line @next/next/no-img-element -- authorized file route */}
                      <img src={fileUrl(p.fileId)!} alt={p.title} className="aspect-square w-full rounded-lg border border-line object-cover" loading="lazy" />
                      <figcaption className="flex items-center justify-between gap-1 text-xs text-muted">
                        <span className="truncate">{p.title}</span>
                        <ActionForm action={removePortfolioAction} showSuccess={false} className="space-y-0">
                          <input type="hidden" name="id" value={p.id} />
                          <SubmitButton variant="ghost" size="sm" aria-label={`Remove ${p.title}`}>Remove</SubmitButton>
                        </ActionForm>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
              <PortfolioForm />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
