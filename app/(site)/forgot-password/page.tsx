"use client";

import Link from "next/link";
import { forgotPasswordAction } from "@/lib/actions/auth";
import { ActionForm, Field, Input, SubmitButton } from "@/components/ui/form";
import { Card, CardBody } from "@/components/ui/primitives";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">Reset your password</h1>
      <p className="mt-1 text-sm text-muted">Enter the phone number or email on your account.</p>
      <Card className="mt-6">
        <CardBody>
          <ActionForm action={forgotPasswordAction}>
            <Field label="Phone number or email" name="phoneOrEmail" required>
              <Input name="phoneOrEmail" required autoComplete="username" />
            </Field>
            <SubmitButton className="w-full" pendingText="Please wait…">Request reset link</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
      <p className="mt-4 text-center text-sm"><Link href="/login" className="text-brand hover:underline">Back to sign in</Link></p>
    </div>
  );
}
