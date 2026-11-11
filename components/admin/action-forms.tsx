import type { ReactNode } from "react";
import type { ActionResult } from "@/lib/errors";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { buttonClass, cx } from "@/components/ui/primitives";

/*
 * Server-renderable building blocks for admin decision forms. No client state of their own:
 * they compose the client <ActionForm>/<SubmitButton> with hidden inputs, so pages can stay
 * server components. Every action re-checks permissions server-side.
 */

export type AdminAction = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;
type Variant = "primary" | "gold" | "outline" | "ghost" | "danger";

/** Same look as the kit's inputClass (kept here so server components don't import values from a client module). */
export const adminInput =
  "block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

const domId = (parts: string[]) => parts.join("-").replace(/[^A-Za-z0-9_-]/g, "");

export function HiddenFields({ fields }: { fields: Record<string, string> }) {
  return (
    <>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

/** One-click action that needs no reason (approve, restore, mark in review…). */
export function ActionButton({
  action,
  fields,
  label,
  variant = "outline",
  pendingText = "Saving…",
}: {
  action: AdminAction;
  fields: Record<string, string>;
  label: ReactNode;
  variant?: Variant;
  pendingText?: string;
}) {
  return (
    <ActionForm action={action} className="inline-block max-w-full space-y-2">
      <HiddenFields fields={fields} />
      <SubmitButton variant={variant} size="sm" pendingText={pendingText}>
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

/**
 * Action that asks for a written reason first (reject, suspend, remove, hide…). Collapsed in a
 * <details> disclosure so lists stay compact; the server enforces the reason as well.
 */
export function ReasonForm({
  action,
  fields,
  label,
  variant = "danger",
  noteLabel = "Reason (shown to the person affected)",
  required = true,
  placeholder,
}: {
  action: AdminAction;
  fields: Record<string, string>;
  label: string;
  variant?: Variant;
  noteLabel?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const noteId = domId(["note", ...Object.values(fields), label]);
  return (
    <details className="inline-block max-w-full align-top">
      <summary className={cx(buttonClass(variant === "danger" ? "outline" : variant, "sm"), "cursor-pointer list-none [&::-webkit-details-marker]:hidden", variant === "danger" && "text-danger")}>
        {label}…
      </summary>
      <ActionForm action={action} className="mt-2 w-72 max-w-full space-y-2 rounded-lg border border-line bg-canvas p-3">
        <HiddenFields fields={fields} />
        <label htmlFor={noteId} className="block text-xs font-medium text-ink">
          {noteLabel}
          {required && <span className="text-danger"> *</span>}
        </label>
        <textarea id={noteId} name="note" rows={3} maxLength={1000} required={required} placeholder={placeholder} className={adminInput} />
        <SubmitButton variant={variant} size="sm" pendingText="Saving…">
          Confirm: {label.toLowerCase()}
        </SubmitButton>
      </ActionForm>
    </details>
  );
}

/**
 * A decision with several outcomes sharing one note field. Each outcome is its own submit button
 * carrying `name=value`, so there is never an "unselected" decision to submit by mistake.
 */
export function DecisionForm({
  action,
  id,
  name = "decision",
  decisions,
  noteLabel = "Note to the applicant",
  noteHint,
}: {
  action: AdminAction;
  id: string;
  name?: string;
  decisions: { value: string; label: string; variant?: Variant }[];
  noteLabel?: string;
  noteHint?: string;
}) {
  const noteId = domId(["decision-note", id]);
  return (
    <ActionForm action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={noteId} className="block text-sm font-medium text-ink">
        {noteLabel}
      </label>
      <textarea id={noteId} name="note" rows={3} maxLength={1000} className={adminInput} aria-describedby={noteHint ? `${noteId}-hint` : undefined} />
      {noteHint && (
        <p id={`${noteId}-hint`} className="text-xs text-muted">
          {noteHint}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {decisions.map((d) => (
          <SubmitButton key={d.value} name={name} value={d.value} variant={d.variant ?? "outline"} size="sm" pendingText="Saving…">
            {d.label}
          </SubmitButton>
        ))}
      </div>
    </ActionForm>
  );
}

/** Small labelled control for GET filter forms. */
export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block min-w-[10rem]", className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Section heading used within admin pages. */
export function SectionTitle({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-3 mt-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between first:mt-0">
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Link to a private file through the authorized file route; always opens in a new tab. */
export function FileLink({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return <span className="text-muted">—</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline-offset-2 hover:underline">
      {children}
    </a>
  );
}
