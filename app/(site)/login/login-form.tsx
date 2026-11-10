"use client";

import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { ArrowRight, AlertTriangle, Eye, EyeOff, KeyRound, UserRound } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import { ActionForm, Field, Input, SubmitButton } from "@/components/ui/form";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

export function LoginForm({ next, t }: { next?: string; t: Dictionary["auth"] }) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const checkCaps = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.("CapsLock") ?? false);

  return (
    <ActionForm action={loginAction}>
      {next && <input type="hidden" name="next" value={next} />}
      <Field label={t.phoneOrEmail} name="phoneOrEmail" hint={t.identifierHint} required>
        <div className="relative">
          <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input name="phoneOrEmail" autoComplete="username" autoCapitalize="none" spellCheck={false} required className="h-11 pl-9" />
        </div>
      </Field>
      <Field label={t.password} name="password" required>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-11 pl-9 pr-11"
            onKeyUp={checkCaps}
            onKeyDown={checkCaps}
            onBlur={() => setCaps(false)}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink"
            aria-label={show ? t.hidePassword : t.showPassword}
            aria-pressed={show}
          >
            {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        {caps && (
          <p role="status" className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-gold-600">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {t.capsLock}
          </p>
        )}
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-brand hover:underline">{t.forgot}</Link>
      </div>
      <SubmitButton className="group w-full" size="lg" pendingText={t.signingIn}>
        {t.signIn} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </SubmitButton>
    </ActionForm>
  );
}
