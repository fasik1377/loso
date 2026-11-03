"use client";

import { Flag } from "lucide-react";
import { reportAction } from "@/lib/actions/member";
import { ActionForm, Field, Select, SubmitButton, Textarea } from "@/components/ui/form";

const REASONS = [
  ["FRAUD", "Fraud or scam"],
  ["FAKE_PROFILE", "Fake profile or listing"],
  ["HARASSMENT", "Harassment"],
  ["ABUSE", "Abusive behaviour"],
  ["UNSAFE", "Unsafe request or behaviour"],
  ["INAPPROPRIATE", "Inappropriate content"],
  ["SPAM", "Spam"],
  ["DISPUTE", "Dispute about a job or service"],
  ["OTHER", "Other"],
] as const;

/** Disclosure-based report form (no modal library needed; keyboard accessible by default). */
export function ReportButton({ targetType, targetId, label = "Report" }: { targetType: string; targetId: string; label?: string }) {
  return (
    <details className="group text-sm">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-muted hover:text-danger">
        <Flag className="h-4 w-4" aria-hidden="true" /> {label}
      </summary>
      <div className="mt-3 rounded-lg border border-line bg-card p-4">
        <ActionForm action={reportAction} resetOnSuccess>
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <Field label="Reason" name="reason" required>
            <Select name="reason" options={REASONS.map(([value, label]) => ({ value, label }))} placeholder="Choose a reason" required />
          </Field>
          <Field label="Details (optional)" name="details">
            <Textarea name="details" rows={3} maxLength={1000} />
          </Field>
          <SubmitButton variant="danger" size="sm" pendingText="Sending…">Send report</SubmitButton>
        </ActionForm>
      </div>
    </details>
  );
}
