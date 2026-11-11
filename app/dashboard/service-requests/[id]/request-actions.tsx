"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { reviewAction, serviceRequestTransitionAction } from "@/lib/actions/member";
import type { ServiceRequestAction } from "@/lib/domain/service-request";
import { ActionForm, Field, SubmitButton, Textarea } from "@/components/ui/form";

const LABELS: Record<ServiceRequestAction, { label: string; variant: "primary" | "gold" | "outline" | "danger"; needsReason?: boolean; help?: string }> = {
  accept: { label: "Accept request", variant: "primary" },
  decline: { label: "Decline", variant: "outline", needsReason: true },
  start: { label: "Start work", variant: "primary" },
  markFinished: { label: "Report work finished", variant: "gold", help: "The customer will be asked to confirm." },
  confirmComplete: { label: "Confirm work is complete", variant: "gold", help: "Only confirm after the work was actually done." },
  cancel: { label: "Cancel request", variant: "danger", needsReason: true },
};

export function RequestActions({ id, actions }: { id: string; actions: ServiceRequestAction[] }) {
  const simple = actions.filter((a) => !LABELS[a].needsReason);
  const withReason = actions.filter((a) => LABELS[a].needsReason);
  return (
    <div className="space-y-4">
      {simple.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {simple.map((a) => (
            <ActionForm key={a} action={serviceRequestTransitionAction} className="space-y-1">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="action" value={a} />
              <SubmitButton variant={LABELS[a].variant} pendingText="Updating…">{LABELS[a].label}</SubmitButton>
              {LABELS[a].help && <p className="text-xs text-muted">{LABELS[a].help}</p>}
            </ActionForm>
          ))}
        </div>
      )}
      {withReason.map((a) => (
        <details key={a} className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-sm font-medium text-ink">{LABELS[a].label}…</summary>
          <ActionForm action={serviceRequestTransitionAction} className="mt-3">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value={a} />
            <Field label="Reason" name="reason" required>
              <Textarea name="reason" rows={2} maxLength={500} required />
            </Field>
            <SubmitButton variant={LABELS[a].variant} size="sm" pendingText="Updating…">{LABELS[a].label}</SubmitButton>
          </ActionForm>
        </details>
      ))}
    </div>
  );
}

export function ReviewForm({ serviceRequestId }: { serviceRequestId: string }) {
  const [rating, setRating] = useState(0);
  return (
    <ActionForm action={reviewAction}>
      <input type="hidden" name="serviceRequestId" value={serviceRequestId} />
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink">Rating <span className="text-danger">*</span></legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} className="peer sr-only" checked={rating === n} onChange={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} />
              <Star className={`h-8 w-8 rounded peer-focus-visible:ring-2 peer-focus-visible:ring-gold-600 ${n <= rating ? "fill-gold text-gold" : "text-muted/40"}`} aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Comment (optional)" name="comment">
        <Textarea name="comment" rows={3} maxLength={1000} placeholder="What went well? What could be better?" />
      </Field>
      <SubmitButton variant="gold" pendingText="Submitting…" disabled={rating === 0}>Submit review</SubmitButton>
    </ActionForm>
  );
}
