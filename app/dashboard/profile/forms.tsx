"use client";

import { addPortfolioAction, updateProfileAction, updateWorkerProfileAction, upsertServiceAction } from "@/lib/actions/member";
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { Avatar } from "@/components/ui/primitives";

type Option = { value: string; label: string };

const PRICING = [
  { value: "NEGOTIABLE", label: "Negotiable" },
  { value: "HOURLY", label: "Per hour" },
  { value: "DAILY", label: "Per day" },
  { value: "PER_JOB", label: "Per job" },
];

export function BasicProfileForm({
  locations,
  defaults,
}: {
  locations: Option[];
  defaults: { fullName: string; email: string; bio: string; locationId: string; languages: string; phoneVisibility: string; avatarUrl: string | null };
}) {
  return (
    <ActionForm action={updateProfileAction}>
      <div className="flex items-center gap-4">
        <Avatar name={defaults.fullName} src={defaults.avatarUrl} size={64} />
        <Field label="Profile photo" name="avatar" hint="JPG, PNG or WebP, max 2 MB. Public.">
          <Input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="fullName" required>
          <Input name="fullName" defaultValue={defaults.fullName} required maxLength={100} />
        </Field>
        <Field label="Email" name="email">
          <Input name="email" type="email" defaultValue={defaults.email} maxLength={120} />
        </Field>
        <Field label="Area" name="locationId">
          <Select name="locationId" options={locations} placeholder="Not set" defaultValue={defaults.locationId} />
        </Field>
        <Field label="Languages" name="languages" hint="Comma separated, e.g. Sidamu Afo, Amharic, English">
          <Input name="languages" defaultValue={defaults.languages} maxLength={200} />
        </Field>
      </div>
      <Field label="About me" name="bio">
        <Textarea name="bio" defaultValue={defaults.bio} maxLength={1000} />
      </Field>
      <Field label="Who can see my phone number?" name="phoneVisibility" hint="Your number is never shown to the public.">
        <Select
          name="phoneVisibility"
          defaultValue={defaults.phoneVisibility}
          options={[
            { value: "HIDDEN", label: "Nobody — messages only" },
            { value: "CONNECTIONS", label: "Only people I'm working with (accepted requests, shortlisted applications)" },
            { value: "REGISTERED_USERS", label: "Any signed-in Loso user" },
          ]}
        />
      </Field>
      <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
    </ActionForm>
  );
}

export function WorkProfileForm({
  skills,
  areas,
  defaults,
}: {
  skills: Option[];
  areas: Option[];
  defaults: {
    headline: string;
    seeksJobs: boolean;
    offersServices: boolean;
    yearsExperience: string;
    experienceSummary: string;
    qualifications: string;
    availability: string;
    availabilityNote: string;
    pricingMethod: string;
    priceMin: string;
    priceMax: string;
    skillIds: string[];
    areaIds: string[];
  };
}) {
  return (
    <ActionForm action={updateWorkerProfileAction}>
      <Field label="Headline" name="headline" hint="e.g. Licensed electrician — home wiring & repairs">
        <Input name="headline" defaultValue={defaults.headline} maxLength={120} />
      </Field>
      <div className="flex flex-wrap gap-6">
        <Checkbox name="seeksJobs" label="I'm looking for a job" defaultChecked={defaults.seeksJobs} />
        <Checkbox name="offersServices" label="I offer services to customers" defaultChecked={defaults.offersServices} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Years of experience" name="yearsExperience">
          <Input name="yearsExperience" type="number" min={0} max={60} defaultValue={defaults.yearsExperience} />
        </Field>
        <Field label="Availability" name="availability">
          <Select
            name="availability"
            defaultValue={defaults.availability}
            options={[
              { value: "AVAILABLE", label: "Available" },
              { value: "BUSY", label: "Busy" },
              { value: "UNAVAILABLE", label: "Unavailable" },
            ]}
          />
        </Field>
        <Field label="Availability note" name="availabilityNote">
          <Input name="availabilityNote" defaultValue={defaults.availabilityNote} maxLength={200} placeholder="e.g. Weekdays after 2pm" />
        </Field>
        <Field label="Pricing" name="pricingMethod">
          <Select name="pricingMethod" defaultValue={defaults.pricingMethod} options={PRICING} />
        </Field>
        <Field label="Price from (ETB)" name="priceMin">
          <Input name="priceMin" type="number" min={0} step={10} defaultValue={defaults.priceMin} />
        </Field>
        <Field label="Price to (ETB)" name="priceMax">
          <Input name="priceMax" type="number" min={0} step={10} defaultValue={defaults.priceMax} />
        </Field>
      </div>
      <Field label="Experience" name="experienceSummary">
        <Textarea name="experienceSummary" defaultValue={defaults.experienceSummary} maxLength={2000} />
      </Field>
      <Field label="Qualifications & training" name="qualifications">
        <Textarea name="qualifications" defaultValue={defaults.qualifications} maxLength={2000} />
      </Field>
      <CheckboxGroup legend="Skills" name="skillIds" options={skills} selected={defaults.skillIds} />
      <CheckboxGroup legend="Areas I work in" name="areaIds" options={areas} selected={defaults.areaIds} />
      <SubmitButton pendingText="Saving…">Save work profile</SubmitButton>
    </ActionForm>
  );
}

function CheckboxGroup({ legend, name, options, selected }: { legend: string; name: string; options: Option[]; selected: string[] }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">{legend}</legend>
      {options.length === 0 ? (
        <p className="text-sm text-muted">No options configured yet.</p>
      ) : (
        <div className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-line p-3 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((o) => (
            <Checkbox key={o.value} name={name} value={o.value} label={o.label} defaultChecked={selected.includes(o.value)} />
          ))}
        </div>
      )}
    </fieldset>
  );
}

export function ServiceForm({ categories }: { categories: Option[] }) {
  return (
    <ActionForm action={upsertServiceAction} resetOnSuccess className="rounded-lg border border-dashed border-line p-4">
      <p className="text-sm font-medium text-ink">Add or update a service</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" name="categoryId" required>
          <Select name="categoryId" options={categories} placeholder="Choose a category" required />
        </Field>
        <Field label="Service title" name="title" required>
          <Input name="title" maxLength={100} required placeholder="e.g. House wiring & socket repair" />
        </Field>
        <Field label="Pricing" name="pricingMethod">
          <Select name="pricingMethod" options={PRICING} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="From (ETB)" name="priceMin">
            <Input name="priceMin" type="number" min={0} step={10} />
          </Field>
          <Field label="To (ETB)" name="priceMax">
            <Input name="priceMax" type="number" min={0} step={10} />
          </Field>
        </div>
      </div>
      <Field label="Description" name="description">
        <Textarea name="description" rows={3} maxLength={1000} />
      </Field>
      <SubmitButton variant="outline" pendingText="Saving…">Save service</SubmitButton>
    </ActionForm>
  );
}

export function PortfolioForm() {
  return (
    <ActionForm action={addPortfolioAction} resetOnSuccess className="rounded-lg border border-dashed border-line p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" name="title" required>
          <Input name="title" maxLength={100} required />
        </Field>
        <Field label="Image" name="image" required hint="JPG, PNG or WebP, max 4 MB">
          <Input name="image" type="file" accept="image/jpeg,image/png,image/webp" required />
        </Field>
      </div>
      <Field label="Description" name="description">
        <Input name="description" maxLength={300} />
      </Field>
      <SubmitButton variant="outline" pendingText="Uploading…">Add to portfolio</SubmitButton>
    </ActionForm>
  );
}
