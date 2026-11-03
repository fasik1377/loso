"use client";

import { jobStatusAction } from "@/lib/actions/employer";
import { ActionForm, SubmitButton, inputClass } from "@/components/ui/form";

const LABEL = { PUBLISHED: "Publish", PAUSED: "Pause", CLOSED: "Close" } as const;

export function JobStatusControls({ id, options, needsDeadline }: { id: string; options: ("PUBLISHED" | "PAUSED" | "CLOSED")[]; needsDeadline: boolean }) {
  return (
    <>
      {options.map((s) =>
        s === "PUBLISHED" && needsDeadline ? (
          <ActionForm key={s} action={jobStatusAction} className="flex items-end gap-1 space-y-0">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="PUBLISHED" />
            <label className="text-xs text-muted">
              New deadline
              <input type="date" name="deadline" required className={`${inputClass} h-8 py-0`} />
            </label>
            <SubmitButton size="sm" pendingText="…">Renew</SubmitButton>
          </ActionForm>
        ) : (
          <ActionForm key={s} action={jobStatusAction} className="space-y-0">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={s} />
            <SubmitButton size="sm" variant={s === "PUBLISHED" ? "primary" : "outline"} pendingText="…">{LABEL[s]}</SubmitButton>
          </ActionForm>
        ),
      )}
    </>
  );
}
