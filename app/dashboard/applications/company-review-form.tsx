"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { companyReviewAction } from "@/lib/actions/member";
import { ActionForm, Field, SubmitButton, Textarea } from "@/components/ui/form";

/** Hired candidates rate their employer once per hire (shown publicly on the company page). */
export function CompanyReviewForm({ applicationId }: { applicationId: string }) {
  const [rating, setRating] = useState(0);
  return (
    <ActionForm action={companyReviewAction}>
      <input type="hidden" name="applicationId" value={applicationId} />
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink">How was this employer? <span className="text-danger">*</span></legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} className="peer sr-only" checked={rating === n} onChange={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} />
              <Star className={`h-7 w-7 rounded peer-focus-visible:ring-2 peer-focus-visible:ring-gold-600 ${n <= rating ? "fill-gold text-gold" : "text-muted/40"}`} aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Comment (optional, public)" name="comment">
        <Textarea name="comment" rows={3} maxLength={1000} placeholder="Hiring process, respect, payment on time…" />
      </Field>
      <SubmitButton variant="gold" size="sm" pendingText="Submitting…" disabled={rating === 0}>Submit employer review</SubmitButton>
    </ActionForm>
  );
}
