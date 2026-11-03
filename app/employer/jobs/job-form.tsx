"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { saveJobAction } from "@/lib/actions/employer";
import { jobSchema, type JobInput } from "@/lib/validation/schemas";
import { Alert, Button } from "@/components/ui/primitives";
import { Field, inputClass } from "@/components/ui/form";

type Option = { value: string; label: string };
type FormValues = JobInput;

const EMPLOYMENT = ["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP", "VOLUNTEER", "DAILY_LABOR"];
const LEVELS = ["ENTRY", "JUNIOR", "MID", "SENIOR", "MANAGER"];
const label = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ");

export function JobForm({
  jobId,
  defaults,
  categories,
  locations,
  skills,
  canPublish,
  questionsLocked,
}: {
  jobId?: string;
  defaults?: Partial<FormValues>;
  categories: Option[];
  locations: Option[];
  skills: Option[];
  canPublish: boolean;
  questionsLocked?: boolean;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    control,
    setError,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      employmentType: "FULL_TIME",
      experienceLevel: "ENTRY",
      workplaceType: "ON_SITE",
      applicationMethod: "IN_APP",
      salaryVisible: true,
      vacancies: 1,
      skillIds: [],
      questions: [],
      ...defaults,
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "questions" });
  const method = watch("applicationMethod");

  const submit = (publish: boolean) =>
    handleSubmit(() => {
      setServerError(null);
      // Send the raw form input; the server re-validates and applies the same transforms.
      const raw = getValues();
      startTransition(async () => {
        const res = await saveJobAction({ ...raw, jobId, publish });
        if (!res.ok) {
          setServerError(res.error);
          for (const [f, m] of Object.entries(res.fieldErrors ?? {})) if (m?.[0]) setError(f as keyof FormValues, { message: m[0] });
          return;
        }
        router.push("/employer/jobs");
        router.refresh();
      });
    });

  const err = (k: keyof FormValues) => errors[k]?.message as string | undefined;

  return (
    <form className="space-y-6" noValidate onSubmit={submit(false)}>
      {serverError && <Alert tone="danger">{serverError}</Alert>}
      {!canPublish && <Alert tone="warning">Your company is not verified yet, so you can only save drafts. Publish after verification.</Alert>}

      <section className="space-y-4">
        <h2 className="font-semibold text-ink">Basics</h2>
        <Field label="Job title" name="title" required error={err("title")}>
          <input id="title" className={inputClass} {...register("title")} maxLength={120} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category" name="categoryId">
            <select id="categoryId" className={inputClass} {...register("categoryId")}>
              <option value="">Choose…</option>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Employment type" name="employmentType" required>
            <select id="employmentType" className={inputClass} {...register("employmentType")}>
              {EMPLOYMENT.map((e) => <option key={e} value={e}>{label(e)}</option>)}
            </select>
          </Field>
          <Field label="Experience level" name="experienceLevel">
            <select id="experienceLevel" className={inputClass} {...register("experienceLevel")}>
              {LEVELS.map((e) => <option key={e} value={e}>{label(e)}</option>)}
            </select>
          </Field>
          <Field label="Workplace" name="workplaceType">
            <select id="workplaceType" className={inputClass} {...register("workplaceType")}>
              <option value="ON_SITE">On site</option>
              <option value="HYBRID">Hybrid</option>
              <option value="REMOTE">Remote</option>
            </select>
          </Field>
          <Field label="Location" name="locationId">
            <select id="locationId" className={inputClass} {...register("locationId")}>
              <option value="">Hawassa (any)</option>
              {locations.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Vacancies" name="vacancies" error={err("vacancies")}>
            <input id="vacancies" type="number" min={1} className={inputClass} {...register("vacancies")} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-ink">Description</h2>
        <Field label="About the job" name="description" required error={err("description")}>
          <textarea id="description" rows={6} className={inputClass} {...register("description")} maxLength={8000} />
        </Field>
        <Field label="Responsibilities" name="responsibilities">
          <textarea id="responsibilities" rows={4} className={inputClass} {...register("responsibilities")} maxLength={5000} />
        </Field>
        <Field label="Qualifications" name="qualifications">
          <textarea id="qualifications" rows={4} className={inputClass} {...register("qualifications")} maxLength={5000} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Required skills</legend>
          <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-line p-3 sm:grid-cols-3">
            {skills.map((s) => (
              <label key={s.value} className="flex items-center gap-2 text-sm">
                <input type="checkbox" value={s.value} className="h-4 w-4 accent-[#123B32]" {...register("skillIds")} /> {s.label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-ink">Salary (ETB per month) & deadline</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Minimum" name="salaryMin" error={err("salaryMin")}>
            <input id="salaryMin" type="number" min={0} step={100} className={inputClass} {...register("salaryMin")} />
          </Field>
          <Field label="Maximum" name="salaryMax" error={err("salaryMax")}>
            <input id="salaryMax" type="number" min={0} step={100} className={inputClass} {...register("salaryMax")} />
          </Field>
          <Field label="Application deadline" name="deadline" error={err("deadline")}>
            <input id="deadline" type="date" className={inputClass} {...register("deadline")} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#123B32]" {...register("salaryVisible")} /> Show salary to applicants</label>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-ink">How to apply</h2>
        <Field label="Application method" name="applicationMethod">
          <select id="applicationMethod" className={inputClass} {...register("applicationMethod")}>
            <option value="IN_APP">Through Loso (recommended — track applicants here)</option>
            <option value="EMAIL">By email</option>
            <option value="EXTERNAL_URL">On our website</option>
          </select>
        </Field>
        {method === "EMAIL" && (
          <Field label="Application email" name="applicationEmail" required error={err("applicationEmail")}>
            <input id="applicationEmail" type="email" className={inputClass} {...register("applicationEmail")} />
          </Field>
        )}
        {method === "EXTERNAL_URL" && (
          <Field label="Application link" name="applicationUrl" required error={err("applicationUrl")}>
            <input id="applicationUrl" type="url" placeholder="https://" className={inputClass} {...register("applicationUrl")} />
          </Field>
        )}
        {method === "IN_APP" && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">Additional questions (optional, up to 5)</legend>
            {questionsLocked && <p className="text-xs text-muted">Questions can&apos;t be changed after people have applied.</p>}
            {fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <input aria-label={`Question ${i + 1}`} className={inputClass} {...register(`questions.${i}.text` as const)} maxLength={300} disabled={questionsLocked} />
                {!questionsLocked && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} aria-label={`Remove question ${i + 1}`}><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
            ))}
            {!questionsLocked && fields.length < 5 && (
              <Button type="button" variant="outline" size="sm" onClick={() => append({ text: "" })}><Plus className="h-4 w-4" /> Add question</Button>
            )}
          </fieldset>
        )}
      </section>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button type="submit" variant="outline" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save as draft</Button>
        {canPublish && (
          <Button type="button" variant="gold" disabled={pending} onClick={submit(true)}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {jobId ? "Save & publish" : "Publish job"}
          </Button>
        )}
      </div>
    </form>
  );
}
