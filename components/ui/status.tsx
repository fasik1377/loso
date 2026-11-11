import { BadgeCheck, Star } from "lucide-react";
import { humanize } from "@/lib/format";
import { Badge } from "./primitives";

type Tone = Parameters<typeof Badge>[0]["tone"];

const TONES: Record<string, Tone> = {
  // generic
  ACTIVE: "success",
  APPROVED: "success",
  VERIFIED: "success",
  PUBLISHED: "success",
  COMPLETED: "success",
  HIRED: "success",
  SUCCEEDED: "success",
  RESOLVED: "success",
  WAIVED: "success",
  VISIBLE: "success",
  PENDING: "warning",
  PENDING_REVIEW: "warning",
  SUBMITTED: "warning",
  UNDER_REVIEW: "warning",
  AWAITING_PAYMENT: "warning",
  REQUESTED: "warning",
  OPEN: "warning",
  SCHEDULED: "brand",
  CHANGES_REQUESTED: "warning",
  ACCEPTED: "brand",
  IN_PROGRESS: "brand",
  SHORTLISTED: "brand",
  INTERVIEW: "brand",
  OFFERED: "gold",
  IN_REVIEW: "brand",
  DRAFT: "neutral",
  PAUSED: "neutral",
  CLOSED: "neutral",
  EXPIRED: "neutral",
  WITHDRAWN: "neutral",
  DISMISSED: "neutral",
  CANCELLED: "neutral",
  HIDDEN: "neutral",
  REJECTED: "danger",
  DECLINED: "danger",
  SUSPENDED: "danger",
  REMOVED: "danger",
  FAILED: "danger",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={TONES[status] ?? "neutral"}>{label ?? humanize(status)}</Badge>;
}

export function VerifiedBadge({ label = "Verified" }: { label?: string }) {
  return (
    <Badge tone="teal">
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function SponsoredLabel() {
  return <Badge tone="gold">Sponsored</Badge>;
}

export function Rating({ average, count }: { average: number | null; count: number }) {
  if (!count || average == null) return <span className="text-xs text-muted">No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`Rated ${average.toFixed(1)} out of 5 from ${count} reviews`}>
      <Star className="h-4 w-4 fill-gold text-gold" aria-hidden="true" />
      <span className="font-semibold text-ink">{average.toFixed(1)}</span>
      <span className="text-muted">({count})</span>
    </span>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= value ? "fill-gold text-gold" : "text-muted/40"}`} aria-hidden="true" />
      ))}
    </span>
  );
}
