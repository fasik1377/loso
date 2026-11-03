import Link from "next/link";
import { Briefcase, Building2, Clock, MapPin } from "lucide-react";
import { Avatar, Badge, Card } from "@/components/ui/primitives";
import { Rating, VerifiedBadge } from "@/components/ui/status";
import { formatRange } from "@/lib/money";
import { formatDate, humanize, timeAgo } from "@/lib/format";
import { fileUrl } from "@/lib/services/files";

export interface JobCardData {
  id: string;
  title: string;
  employmentType: string;
  salaryMinMinor: number | null;
  salaryMaxMinor: number | null;
  salaryVisible: boolean;
  currency: string;
  deadline: Date | null;
  publishedAt: Date | null;
  isFeatured: boolean;
  company: { id: string; name: string; status: string; logoFileId: string | null; isDemo: boolean };
  location: { name: string } | null;
}

export function JobCard({ job }: { job: JobCardData }) {
  const salary = job.salaryVisible ? formatRange(job.salaryMinMinor, job.salaryMaxMinor, job.currency) : null;
  return (
    <Card className="relative flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg">
      <div className="flex items-start gap-3">
        <Avatar name={job.company.name} src={fileUrl(job.company.logoFileId)} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink">
            <Link href={`/jobs/${job.id}`} className="after:absolute after:inset-0 hover:text-brand">
              {job.title}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> {job.company.name}
          </p>
        </div>
        {job.isFeatured && <Badge tone="gold">Featured</Badge>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Badge tone="brand">
          <Briefcase className="h-3 w-3" aria-hidden="true" /> {humanize(job.employmentType)}
        </Badge>
        {job.location && (
          <Badge>
            <MapPin className="h-3 w-3" aria-hidden="true" /> {job.location.name}
          </Badge>
        )}
        {job.company.isDemo ? <Badge tone="warning">Demo listing</Badge> : job.company.status === "APPROVED" && <VerifiedBadge label="Verified employer" />}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="font-semibold text-brand">{salary ?? "Salary not disclosed"}</span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {job.deadline ? `Apply by ${formatDate(job.deadline)}` : job.publishedAt ? timeAgo(job.publishedAt) : ""}
        </span>
      </div>
    </Card>
  );
}

export interface WorkerCardData {
  userId: string;
  headline: string | null;
  availability: string;
  ratingAverage: number | null;
  ratingCount: number;
  completedCount: number;
  priceMinMinor: number | null;
  priceMaxMinor: number | null;
  currency: string;
  pricingMethod: string;
  user: { id: string; fullName: string; isDemo: boolean; profile: { avatarFileId: string | null } | null; verifications: { id: string }[] };
  services: { id: string; title: string; category: { name: string } }[];
  areas: { location: { name: string } }[];
}

export function WorkerCard({ worker }: { worker: WorkerCardData }) {
  const avg = worker.ratingAverage;
  const price = formatRange(worker.priceMinMinor, worker.priceMaxMinor, worker.currency);
  return (
    <Card className="relative flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg">
      <div className="flex items-start gap-3">
        <Avatar name={worker.user.fullName} src={fileUrl(worker.user.profile?.avatarFileId)} size={52} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink">
            <Link href={`/workers/${worker.user.id}`} className="after:absolute after:inset-0 hover:text-brand">
              {worker.user.fullName}
            </Link>
          </h3>
          <p className="truncate text-sm text-muted">{worker.headline ?? worker.services[0]?.title ?? "Service provider"}</p>
          <div className="mt-1 flex items-center gap-2">
            <Rating average={avg} count={worker.ratingCount} />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {worker.user.isDemo ? <Badge tone="warning">Demo profile</Badge> : worker.user.verifications.length > 0 ? <VerifiedBadge /> : null}
        {worker.services.map((s) => (
          <Badge key={s.id} tone="brand">{s.category.name}</Badge>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3 w-3" aria-hidden="true" />
          {worker.areas.map((a) => a.location.name).join(", ") || "Area not set"}
        </span>
        <span className="text-xs font-medium text-ink">
          {price ? `${price}${worker.pricingMethod === "HOURLY" ? "/hr" : worker.pricingMethod === "DAILY" ? "/day" : ""}` : "Price on request"}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{worker.completedCount} completed on Loso</span>
        <span className={worker.availability === "AVAILABLE" ? "font-medium text-success" : ""}>{humanize(worker.availability)}</span>
      </div>
    </Card>
  );
}
