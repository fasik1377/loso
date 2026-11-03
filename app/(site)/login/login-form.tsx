"use client";

import Link from "next/link";
import { loginAction } from "@/lib/actions/auth";
import { ActionForm, Field, Input, SubmitButton } from "@/components/ui/form";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={loginAction}>
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Phone number or email" name="phoneOrEmail" required>
        <Input name="phoneOrEmail" autoComplete="username" required />
      </Field>
      <Field label="Password" name="password" required>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-brand hover:underline">Forgot password?</Link>
      </div>
      <SubmitButton className="w-full" size="lg" pendingText="Signing in…">Sign in</SubmitButton>
    </ActionForm>
  );
}
