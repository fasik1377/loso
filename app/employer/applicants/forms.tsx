"use client";

import { useState } from "react";
import { applicationStatusAction, saveEmployerNoteAction } from "@/lib/actions/employer";
import { ActionForm, Field, Input, SubmitButton, Textarea, inputClass } from "@/components/ui/form";

const LABEL: Record<string, string> = {
  UNDER_REVIEW: "Under review",
  SHORTLISTED: "Shortlist",
  INTERVIEW: "Schedule interview",
  OFFERED: "Make offer",
  HIRED: "Mark hired",
  REJECTED: "Reject",
};

export function ApplicationStatusForm({ id, options }: { id: string; options: string[] }) {
  const [status, setStatus] = useState(options[0]!);
  return (
    <ActionForm action={applicationStatusAction} className="rounded-lg bg-canvas p-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Move to</span>
          <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            {options.map((o) => <option key={o} value={o}>{LABEL[o] ?? o}</option>)}
          </select>
        </label>
        <Field label="Message to applicant (optional)" name="note">
          <Input name="note" maxLength={500} />
        </Field>
        <SubmitButton variant={status === "REJECTED" ? "danger" : "primary"} pendingText="Saving…">Update</SubmitButton>
      </div>
      {status === "INTERVIEW" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Interview date & time" name="interviewAt" required>
            <Input name="interviewAt" type="datetime-local" required />
          </Field>
          <Field label="Location / details" name="interviewDetails">
            <Input name="interviewDetails" maxLength={500} placeholder="e.g. Head office, Piazza — bring your ID" />
          </Field>
        </div>
      )}
    </ActionForm>
  );
}

export function EmployerNoteForm({ id, note }: { id: string; note: string }) {
  return (
    <details>
      <summary className="cursor-pointer text-sm text-muted hover:text-ink">Private notes {note ? "(1)" : ""}</summary>
      <ActionForm action={saveEmployerNoteAction} className="mt-2">
        <input type="hidden" name="id" value={id} />
        <Textarea name="employerNote" defaultValue={note} rows={3} maxLength={2000} aria-label="Private note (not visible to the applicant)" />
        <SubmitButton variant="outline" size="sm" pendingText="Saving…">Save note</SubmitButton>
      </ActionForm>
    </details>
  );
}
