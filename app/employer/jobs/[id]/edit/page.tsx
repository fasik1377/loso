import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getEmployerCompany } from "@/lib/services/jobs";
import { areaLocations, jobCategories, skills } from "@/lib/services/taxonomy";
import { getSettings } from "@/lib/settings";
import { Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { JobForm } from "../../job-form";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: PageProps<"/employer/jobs/[id]/edit">) {
  const user = await requireRolePage("EMPLOYER");
  const { id } = await params;
  const company = await getEmployerCompany(user.id);
  // Ownership check: only jobs of the employer's own company.
  const job = company
    ? await db.job.findFirst({
        where: { id, companyId: company.id, status: { not: "REMOVED" } },
        include: { skills: true, questions: { orderBy: { sortOrder: "asc" } }, _count: { select: { applications: true } } },
      })
    : null;
  if (!job || !company) notFound();
  const [categories, locations, allSkills, settings] = await Promise.all([jobCategories(), areaLocations(), skills(), getSettings()]);
  const canPublish = company.status === "APPROVED" || (!settings.requireCompanyApprovalToPublish && company.status === "PENDING_REVIEW");

  return (
    <div className="max-w-4xl">
      <PageHeader title="Edit job" description={job.title} actions={<StatusBadge status={job.status} />} />
      <Card>
        <CardBody>
          <JobForm
            jobId={job.id}
            questionsLocked={job._count.applications > 0}
            canPublish={canPublish && job.status === "DRAFT"}
            categories={categories.map((c) => ({ value: c.id, label: c.name }))}
            locations={locations.map((l) => ({ value: l.id, label: l.label }))}
            skills={allSkills.map((s) => ({ value: s.id, label: s.name }))}
            defaults={{
              title: job.title,
              categoryId: job.categoryId ?? "",
              description: job.description,
              responsibilities: job.responsibilities ?? "",
              qualifications: job.qualifications ?? "",
              employmentType: job.employmentType,
              experienceLevel: job.experienceLevel,
              workplaceType: job.workplaceType,
              locationId: job.locationId ?? "",
              salaryMin: job.salaryMinMinor != null ? String(job.salaryMinMinor / 100) : "",
              salaryMax: job.salaryMaxMinor != null ? String(job.salaryMaxMinor / 100) : "",
              salaryVisible: job.salaryVisible,
              vacancies: job.vacancies,
              deadline: job.deadline ? job.deadline.toISOString().slice(0, 10) : "",
              applicationMethod: job.applicationMethod,
              applicationEmail: job.applicationEmail ?? "",
              applicationUrl: job.applicationUrl ?? "",
              skillIds: job.skills.map((s) => s.skillId),
              questions: job.questions.map((q) => ({ text: q.prompt })),
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
