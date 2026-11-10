"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Building2, Loader2, User } from "lucide-react";
import { registerAction } from "@/lib/actions/auth";
import { registerSchema, type RegisterInput } from "@/lib/validation/schemas";
import { Alert, Button, cx } from "@/components/ui/primitives";
import { Field, inputClass } from "@/components/ui/form";

type AccountType = RegisterInput["accountType"];

const TYPES: { value: AccountType; title: string; text: string; icon: typeof User }[] = [
  { value: "WORKER", title: "Worker / Job seeker", text: "Find jobs or offer your services. Registration fee + admin verification required.", icon: Briefcase },
  { value: "CUSTOMER", title: "Customer", text: "Find and hire skilled workers. Free.", icon: User },
  { value: "EMPLOYER", title: "Employer / Company", text: "Post vacancies and recruit. Admin verification of your business required.", icon: Building2 },
];

export function RegisterForm({ initialType }: { initialType: AccountType }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { accountType: initialType, seeksJobs: true, offersServices: false, employerType: "COMPANY" },
  });
  const type = watch("accountType");

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const res = await registerAction(values);
      // On success the action redirects; we only get here on failure.
      if (res && !res.ok) {
        setServerError(res.error);
        for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) {
          if (msgs?.[0]) setError(field as keyof RegisterInput, { message: msgs[0] });
        }
      }
    });
  });

  const err = (k: keyof RegisterInput) => errors[k]?.message as string | undefined;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {serverError && <Alert tone="danger">{serverError}</Alert>}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">I want to join as</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <label
              key={t.value}
              className={cx(
                "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold-600",
                type === t.value ? "border-brand bg-brand-50" : "border-line hover:border-brand/50",
              )}
            >
              <input type="radio" value={t.value} className="sr-only" {...register("accountType")} onChange={() => setValue("accountType", t.value)} checked={type === t.value} />
              <t.icon className="h-5 w-5 text-brand" aria-hidden="true" />
              <span className="font-semibold text-ink">{t.title}</span>
              <span className="text-xs text-muted">{t.text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="fullName" required error={err("fullName")}>
          <input id="fullName" autoComplete="name" className={inputClass} aria-invalid={!!errors.fullName} {...register("fullName")} />
        </Field>
        <Field label="Phone number" name="phone" required error={err("phone")} hint="Ethiopian number, e.g. 0911 234 567">
          <input id="phone" type="tel" autoComplete="tel" inputMode="tel" className={inputClass} aria-invalid={!!errors.phone} {...register("phone")} />
        </Field>
        <Field label="Email (optional)" name="email" error={err("email")}>
          <input id="email" type="email" autoComplete="email" className={inputClass} aria-invalid={!!errors.email} {...register("email")} />
        </Field>
        <div className="hidden sm:block" />
        <Field label="Password" name="password" required error={err("password")} hint="At least 8 characters with letters and numbers">
          <input id="password" type="password" autoComplete="new-password" className={inputClass} aria-invalid={!!errors.password} {...register("password")} />
        </Field>
        <Field label="Confirm password" name="confirmPassword" required error={err("confirmPassword")}>
          <input id="confirmPassword" type="password" autoComplete="new-password" className={inputClass} aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
        </Field>
      </div>

      {type === "WORKER" && (
        <fieldset className="rounded-lg border border-line p-4">
          <legend className="px-1 text-sm font-medium text-ink">What are you looking for?</legend>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#182B43]" {...register("seeksJobs")} /> Find a job (apply to vacancies)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#182B43]" {...register("offersServices")} /> Offer my services to customers</label>
          </div>
          {err("offersServices") && <p className="mt-1 text-xs text-danger">{err("offersServices")}</p>}
          <p className="mt-3 text-xs text-muted">
            After registering you will see the registration fee and payment instructions. Your account becomes active after staff verify your payment and identity document.
          </p>
        </fieldset>
      )}

      {type === "EMPLOYER" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employer type" name="employerType">
            <select id="employerType" className={inputClass} {...register("employerType")}>
              <option value="COMPANY">Company / organization</option>
              <option value="INDIVIDUAL">Individual employer</option>
            </select>
          </Field>
          <Field label="Company or business name" name="companyName" required error={err("companyName")}>
            <input id="companyName" className={inputClass} aria-invalid={!!errors.companyName} {...register("companyName")} />
          </Field>
        </div>
      )}

      {type === "EMPLOYER" && (
        <p className="rounded-lg bg-gold-50 px-4 py-3 text-xs text-ink">
          After registering, upload your business license. Your employer account becomes usable once a Looso administrator verifies it.
        </p>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#182B43]" {...register("acceptTerms")} />
        <span>
          I agree to the <Link href="/terms" target="_blank" className="text-brand underline">terms of use</Link> and{" "}
          <Link href="/privacy" target="_blank" className="text-brand underline">privacy policy</Link>.
        </span>
      </label>
      {err("acceptTerms") && <p className="-mt-3 text-xs text-danger">{err("acceptTerms")}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
