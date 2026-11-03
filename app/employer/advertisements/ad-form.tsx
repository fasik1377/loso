"use client";

import { createAdAction } from "@/lib/actions/employer";
import { ActionForm, Checkbox, Field, Input, SubmitButton } from "@/components/ui/form";

const SLOTS = [
  { value: "HOME", label: "Homepage" },
  { value: "JOBS", label: "Job listings" },
  { value: "SERVICES", label: "Service listings" },
  { value: "WORKER_PROFILE", label: "Worker profiles" },
];

export function AdForm() {
  return (
    <ActionForm action={createAdAction}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" name="businessName" required>
          <Input name="businessName" required maxLength={120} />
        </Field>
        <Field label="Headline" name="title" required hint="Max 80 characters">
          <Input name="title" required maxLength={80} />
        </Field>
        <Field label="Short text" name="body" hint="Max 200 characters, plain text only">
          <Input name="body" maxLength={200} />
        </Field>
        <Field label="Destination link (optional)" name="destinationUrl" hint="Must start with https:// or http://">
          <Input name="destinationUrl" type="url" maxLength={300} placeholder="https://" />
        </Field>
        <Field label="Contact phone" name="contactPhone">
          <Input name="contactPhone" type="tel" maxLength={30} />
        </Field>
        <Field label="Contact email" name="contactEmail">
          <Input name="contactEmail" type="email" maxLength={120} />
        </Field>
        <Field label="Start date" name="startsAt" required>
          <Input name="startsAt" type="date" required />
        </Field>
        <Field label="End date" name="endsAt" required>
          <Input name="endsAt" type="date" required />
        </Field>
      </div>
      <Field label="Banner image (optional)" name="image" hint="JPG, PNG or WebP, max 2 MB. Recommended 600×400. No SVG/HTML.">
        <Input name="image" type="file" accept="image/jpeg,image/png,image/webp" />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Placements <span className="text-danger">*</span></legend>
        <div className="flex flex-wrap gap-4">
          {SLOTS.map((s) => <Checkbox key={s.value} name="slots" value={s.value} label={s.label} />)}
        </div>
      </fieldset>
      <SubmitButton variant="gold" pendingText="Submitting…">Submit for review</SubmitButton>
    </ActionForm>
  );
}
