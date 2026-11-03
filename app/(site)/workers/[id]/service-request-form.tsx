"use client";

import { createServiceRequestAction } from "@/lib/actions/member";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";

type Option = { value: string; label: string };

export function ServiceRequestForm({ workerId, services, locations }: { workerId: string; services: Option[]; locations: Option[] }) {
  return (
    <ActionForm action={createServiceRequestAction}>
      <input type="hidden" name="workerId" value={workerId} />
      <Field label="Service" name="categoryId" required>
        <Select name="categoryId" options={services} placeholder="Choose a service" required defaultValue={services.length === 1 ? services[0]!.value : undefined} />
      </Field>
      <Field label="Short title" name="title" required>
        <Input name="title" maxLength={120} required placeholder="e.g. Fix leaking kitchen pipe" />
      </Field>
      <Field label="Describe the task" name="description" required>
        <Textarea name="description" maxLength={3000} required />
      </Field>
      <Field label="Preferred date & time" name="preferredAt">
        <Input name="preferredAt" type="datetime-local" />
      </Field>
      <Field label="Area" name="locationId">
        <Select name="locationId" options={locations} placeholder="Choose an area" />
      </Field>
      <Field label="Address details" name="addressDetail" hint="Shared only with this worker.">
        <Input name="addressDetail" maxLength={200} placeholder="Landmark, house no." />
      </Field>
      <Field label="Budget (ETB, optional)" name="budget">
        <Input name="budget" type="number" min={0} step={50} />
      </Field>
      <Field label="Photos (optional, up to 4)" name="photos" hint="JPG, PNG or WebP, max 4 MB each.">
        <Input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple />
      </Field>
      <SubmitButton className="w-full" variant="gold" pendingText="Sending…">Send request</SubmitButton>
    </ActionForm>
  );
}
