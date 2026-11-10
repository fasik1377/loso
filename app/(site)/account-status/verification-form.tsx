"use client";

import { submitVerificationAction } from "@/lib/actions/account";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";

const KINDS = [
  { value: "NATIONAL_ID", label: "National ID (Fayda)" },
  { value: "KEBELE_ID", label: "Kebele ID" },
  { value: "PASSPORT", label: "Passport" },
  { value: "DRIVING_LICENSE", label: "Driving license" },
];

export function VerificationForm() {
  return (
    <ActionForm action={submitVerificationAction} className="rounded-lg border border-line p-4">
      <p className="font-medium text-ink">Upload your documents</p>
      <p className="text-xs text-muted">Documents are stored privately and seen only by Looso verification staff.</p>
      <Field label="Identity document type" name="idKind" required>
        <Select name="idKind" options={KINDS} placeholder="Choose a document" required />
      </Field>
      <Field label="Identity document" name="idDocument" required hint="Clear photo or PDF, max 5 MB.">
        <Input name="idDocument" type="file" accept="image/jpeg,image/png,application/pdf" required />
      </Field>
      <Field label="Certificate or training document (optional)" name="certificate">
        <Input name="certificate" type="file" accept="image/jpeg,image/png,application/pdf" />
      </Field>
      <Field label="Note for the reviewer (optional)" name="note">
        <Textarea name="note" rows={2} maxLength={1000} />
      </Field>
      <SubmitButton pendingText="Uploading…">Submit for verification</SubmitButton>
    </ActionForm>
  );
}
