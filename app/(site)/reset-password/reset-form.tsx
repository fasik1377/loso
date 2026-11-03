"use client";

import { resetPasswordAction } from "@/lib/actions/auth";
import { ActionForm, Field, Input, SubmitButton } from "@/components/ui/form";

export function ResetForm({ token }: { token: string }) {
  return (
    <ActionForm action={resetPasswordAction}>
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" required hint="At least 8 characters with letters and numbers">
        <Input name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm new password" name="confirmPassword" required>
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton className="w-full" pendingText="Saving…">Save new password</SubmitButton>
    </ActionForm>
  );
}
