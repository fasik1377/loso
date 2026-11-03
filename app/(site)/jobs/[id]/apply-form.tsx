"use client";

import Link from "next/link";
import { applyAction } from "@/lib/actions/member";
import { ActionForm, Field, Select, SubmitButton, Textarea } from "@/components/ui/form";

export function ApplyForm({
  jobId,
  questions,
  resumes,
}: {
  jobId: string;
  questions: { id: string; prompt: string; required: boolean }[];
  resumes: { id: string; title: string; isDefault: boolean }[];
}) {
  return (
    <ActionForm action={applyAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <Field label="CV" name="resumeId" hint={resumes.length ? undefined : "No CV uploaded yet — you can still apply."}>
        {resumes.length ? (
          <Select name="resumeId" defaultValue={resumes.find((r) => r.isDefault)?.id} options={resumes.map((r) => ({ value: r.id, label: r.title }))} placeholder="Apply without a CV" />
        ) : (
          <Link href="/dashboard/applications#cv" className="text-sm text-brand underline">Upload a CV (PDF)</Link>
        )}
      </Field>
      <Field label="Cover letter" name="coverLetter">
        <Textarea name="coverLetter" rows={5} maxLength={4000} placeholder="Why are you a good fit for this role?" />
      </Field>
      {questions.map((q) => (
        <Field key={q.id} label={q.prompt} name={`answer:${q.id}`} required={q.required}>
          <Textarea name={`answer:${q.id}`} rows={2} maxLength={2000} required={q.required} />
        </Field>
      ))}
      <SubmitButton className="w-full" pendingText="Submitting…">Submit application</SubmitButton>
    </ActionForm>
  );
}
