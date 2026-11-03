"use client";

import { submitCompanyVerificationAction } from "@/lib/actions/account";
import { updateCompanyAction } from "@/lib/actions/employer";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { Avatar } from "@/components/ui/primitives";

export function CompanyForm({
  locations,
  defaults,
}: {
  locations: { value: string; label: string }[];
  defaults: { name: string; description: string; industry: string; address: string; locationId: string; phone: string; email: string; website: string; logoUrl: string | null };
}) {
  return (
    <ActionForm action={updateCompanyAction}>
      <div className="flex items-center gap-4">
        <Avatar name={defaults.name} src={defaults.logoUrl} size={64} />
        <Field label="Logo" name="logo" hint="JPG, PNG or WebP, max 2 MB">
          <Input name="logo" type="file" accept="image/jpeg,image/png,image/webp" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" name="name" required>
          <Input name="name" defaultValue={defaults.name} required maxLength={120} />
        </Field>
        <Field label="Industry" name="industry">
          <Input name="industry" defaultValue={defaults.industry} maxLength={80} />
        </Field>
        <Field label="Area" name="locationId">
          <Select name="locationId" options={locations} placeholder="Not set" defaultValue={defaults.locationId} />
        </Field>
        <Field label="Address" name="address">
          <Input name="address" defaultValue={defaults.address} maxLength={200} />
        </Field>
        <Field label="Phone" name="phone">
          <Input name="phone" type="tel" defaultValue={defaults.phone} />
        </Field>
        <Field label="Email" name="email">
          <Input name="email" type="email" defaultValue={defaults.email} />
        </Field>
        <Field label="Website" name="website">
          <Input name="website" type="url" defaultValue={defaults.website} placeholder="https://" />
        </Field>
      </div>
      <Field label="About the company" name="description">
        <Textarea name="description" rows={5} defaultValue={defaults.description} maxLength={3000} />
      </Field>
      <SubmitButton pendingText="Saving…">Save company</SubmitButton>
    </ActionForm>
  );
}

export function CompanyVerificationForm() {
  return (
    <ActionForm action={submitCompanyVerificationAction}>
      <Field label="Business license / registration document" name="license" required hint="PDF or image, max 5 MB">
        <Input name="license" type="file" accept="application/pdf,image/jpeg,image/png" required />
      </Field>
      <Field label="Note for the reviewer (optional)" name="note">
        <Textarea name="note" rows={2} maxLength={1000} />
      </Field>
      <SubmitButton pendingText="Uploading…">Submit for verification</SubmitButton>
    </ActionForm>
  );
}
