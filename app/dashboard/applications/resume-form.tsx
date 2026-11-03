"use client";

import { uploadResumeAction } from "@/lib/actions/member";
import { ActionForm, Field, Input, SubmitButton } from "@/components/ui/form";

export function ResumeUploadForm() {
  return (
    <ActionForm action={uploadResumeAction} resetOnSuccess>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" name="title">
          <Input name="title" maxLength={80} placeholder="e.g. CV – Electrician 2026" />
        </Field>
        <Field label="PDF file" name="resume" required>
          <Input name="resume" type="file" accept="application/pdf" required />
        </Field>
      </div>
      <SubmitButton variant="outline" pendingText="Uploading…">Upload CV</SubmitButton>
    </ActionForm>
  );
}
