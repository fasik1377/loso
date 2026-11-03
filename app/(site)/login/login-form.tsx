"use client";

import Link from "next/link";
import { loginAction } from "@/lib/actions/auth";
import { ActionForm, Field, Input, SubmitButton } from "@/components/ui/form";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

export function LoginForm({ next, t }: { next?: string; t: Dictionary["auth"] }) {
  return (
    <ActionForm action={loginAction}>
      {next && <input type="hidden" name="next" value={next} />}
      <Field label={t.phoneOrEmail} name="phoneOrEmail" required>
        <Input name="phoneOrEmail" autoComplete="username" required />
      </Field>
      <Field label={t.password} name="password" required>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-brand hover:underline">{t.forgot}</Link>
      </div>
      <SubmitButton className="w-full" size="lg" pendingText={t.signingIn}>{t.signIn}</SubmitButton>
    </ActionForm>
  );
}
