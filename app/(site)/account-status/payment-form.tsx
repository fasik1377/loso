"use client";

import { submitPaymentAction } from "@/lib/actions/account";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/ui/form";

const METHODS = [
  { value: "bank_transfer", label: "Bank transfer / deposit" },
  { value: "telebirr_transfer", label: "Telebirr transfer" },
  { value: "cash_office", label: "Cash at Loso office" },
];

export function PaymentForm() {
  return (
    <ActionForm action={submitPaymentAction} className="rounded-lg border border-line p-4">
      <p className="font-medium text-ink">I have paid — submit my payment details</p>
      <Field label="Payment method" name="method" required>
        <Select name="method" options={METHODS} placeholder="Choose how you paid" required />
      </Field>
      <Field label="Transaction / receipt reference" name="reference" required hint="Exactly as shown on your bank slip, SMS or receipt.">
        <Input name="reference" required maxLength={64} autoComplete="off" />
      </Field>
      <Field label="Proof of payment (optional)" name="proof" hint="Photo or PDF of the receipt, max 5 MB. Visible only to you and payment reviewers.">
        <Input name="proof" type="file" accept="image/jpeg,image/png,application/pdf" />
      </Field>
      <SubmitButton pendingText="Submitting…">Submit payment details</SubmitButton>
    </ActionForm>
  );
}
