"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/errors";
import { Alert, Button, cx } from "./primitives";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

const FieldErrorsCtx = createContext<Record<string, string[] | undefined>>({});

/**
 * Progressive-enhancement form bound to a server action. Shows the action's safe error/success
 * message and passes field errors down to <Field>. Works without JavaScript too.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  showSuccess = true,
  ...rest
}: { action: Action; children: ReactNode; className?: string; resetOnSuccess?: boolean; showSuccess?: boolean } & Omit<ComponentProps<"form">, "action">) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <FieldErrorsCtx.Provider value={state && !state.ok ? (state.fieldErrors ?? {}) : {}}>
      <form ref={ref} action={formAction} className={cx("space-y-4", className)} noValidate {...rest}>
        {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
        {state?.ok && showSuccess && state.message && <Alert tone="success">{state.message}</Alert>}
        {children}
      </form>
    </FieldErrorsCtx.Provider>
  );
}

export function SubmitButton({ children, pendingText, ...props }: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {pending ? (pendingText ?? children) : children}
    </Button>
  );
}

export const inputClass =
  "block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-canvas aria-[invalid=true]:border-danger";

export function Field({
  label,
  name,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const ctxErrors = useContext(FieldErrorsCtx);
  const message = error ?? ctxErrors[name]?.[0];
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {hint && !message && <p id={`${name}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {message && (
        <p id={`${name}-error`} className="mt-1 text-xs text-danger">
          {message}
        </p>
      )}
    </div>
  );
}

export function Input({ name, className, ...props }: ComponentProps<"input"> & { name: string }) {
  const ctxErrors = useContext(FieldErrorsCtx);
  const invalid = !!ctxErrors[name]?.length || props["aria-invalid"] === true;
  return <input id={props.id ?? name} name={name} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${name}-error` : undefined} className={cx(inputClass, className)} {...props} />;
}

export function Textarea({ name, className, ...props }: ComponentProps<"textarea"> & { name: string }) {
  const ctxErrors = useContext(FieldErrorsCtx);
  const invalid = !!ctxErrors[name]?.length;
  return <textarea id={props.id ?? name} name={name} rows={4} aria-invalid={invalid || undefined} className={cx(inputClass, className)} {...props} />;
}

export function Select({ name, className, options, placeholder, ...props }: ComponentProps<"select"> & { name: string; options: { value: string; label: string }[]; placeholder?: string }) {
  const ctxErrors = useContext(FieldErrorsCtx);
  const invalid = !!ctxErrors[name]?.length;
  return (
    <select id={props.id ?? name} name={name} aria-invalid={invalid || undefined} className={cx(inputClass, className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ name, label, value, defaultChecked, description }: { name: string; label: ReactNode; value?: string; defaultChecked?: boolean; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 rounded border-line accent-[#182B43]" />
      <span>
        <span className="text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
}
