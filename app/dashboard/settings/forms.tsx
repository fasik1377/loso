"use client";

import { changePasswordAction } from "@/lib/actions/auth";
import { notificationPrefsAction, requestDeletionAction } from "@/lib/actions/member";
import { ActionForm, Checkbox, Field, Input, SubmitButton } from "@/components/ui/form";

export function NotificationPrefsForm({ types }: { types: { value: string; label: string; checked: boolean }[] }) {
  return (
    <ActionForm action={notificationPrefsAction}>
      <div className="grid gap-2 sm:grid-cols-2">
        {types.map((t) => (
          <Checkbox key={t.value} name={`inApp:${t.value}`} label={t.label} defaultChecked={t.checked} />
        ))}
      </div>
      <SubmitButton variant="outline" pendingText="Saving…">Save preferences</SubmitButton>
    </ActionForm>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction} resetOnSuccess>
      <Field label="Current password" name="current" required>
        <Input name="current" type="password" autoComplete="current-password" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" name="password" required>
          <Input name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field label="Confirm new password" name="confirmPassword" required>
          <Input name="confirmPassword" type="password" autoComplete="new-password" required />
        </Field>
      </div>
      <SubmitButton pendingText="Saving…">Update password</SubmitButton>
    </ActionForm>
  );
}

export function DeletionForm() {
  return (
    <ActionForm action={requestDeletionAction}>
      <Field label='Type "DELETE" to confirm' name="confirm" required>
        <Input name="confirm" autoComplete="off" required />
      </Field>
      <SubmitButton variant="danger" pendingText="Submitting…">Request account deletion</SubmitButton>
    </ActionForm>
  );
}
