"use client";

import { createStaffAdAction } from "@/lib/actions/admin";
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton } from "@/components/ui/form";

const SLOTS = [
  { value: "HOME", label: "Homepage" },
  { value: "JOBS", label: "Job listings" },
  { value: "SERVICES", label: "Service listings" },
  { value: "WORKER_PROFILE", label: "Worker profiles" },
];

export function StaffAdForm({ jobs }: { jobs: { value: string; label: string }[] }) {
  return (
    <ActionForm action={createStaffAdAction}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Sponsored job (optional)" name="jobId" hint="Promotes a published job; clicks open the job page.">
          <Select name="jobId" options={jobs} placeholder="— General business ad —" />
        </Field>
        <Field label="Advertiser / business name" name="businessName" hint="Defaults to the job's company.">
          <Input name="businessName" maxLength={120} />
        </Field>
        <Field label="Headline" name="title" required>
          <Input name="title" maxLength={80} required placeholder="e.g. Hiring 5 sales agents — apply today" />
        </Field>
        <Field label="Short text" name="body">
          <Input name="body" maxLength={200} />
        </Field>
        <Field label="External link (optional)" name="destinationUrl" hint="Only for general ads. https:// links only.">
          <Input name="destinationUrl" type="url" maxLength={300} placeholder="https://" />
        </Field>
        <Field label="Banner image (optional)" name="image" hint="JPG, PNG or WebP, max 2 MB">
          <Input name="image" type="file" accept="image/jpeg,image/png,image/webp" />
        </Field>
        <Field label="Start date" name="startsAt" required>
          <Input name="startsAt" type="date" required />
        </Field>
        <Field label="End date" name="endsAt" required>
          <Input name="endsAt" type="date" required />
        </Field>
        <Field label="Fee charged (ETB)" name="charge" required hint="Enter 0 for a free/promotional placement.">
          <Input name="charge" type="number" min={0} step="0.01" defaultValue={0} required />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Paid via" name="paymentMethod">
            <Select
              name="paymentMethod"
              options={[
                { value: "bank_transfer", label: "Bank transfer" },
                { value: "telebirr_transfer", label: "Telebirr" },
                { value: "cash_office", label: "Cash (receipt)" },
              ]}
            />
          </Field>
          <Field label="Payment reference" name="paymentReference" hint="Required when a fee is charged.">
            <Input name="paymentReference" maxLength={64} autoComplete="off" />
          </Field>
        </div>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Placements <span className="text-danger">*</span></legend>
        <div className="flex flex-wrap gap-4">
          {SLOTS.map((s) => <Checkbox key={s.value} name="slots" value={s.value} label={s.label} defaultChecked={s.value !== "SERVICES"} />)}
        </div>
      </fieldset>
      <SubmitButton variant="gold" pendingText="Publishing…">Publish advertisement</SubmitButton>
    </ActionForm>
  );
}
