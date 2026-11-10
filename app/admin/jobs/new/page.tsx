import type { Metadata } from "next";
import { requirePermissionPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { adminSaveJobAction } from "@/lib/actions/admin";
import { areaLocations, jobCategories, skills } from "@/lib/services/taxonomy";
import { Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { JobForm } from "@/app/employer/jobs/job-form";

export const metadata: Metadata = { title: "Post a job" };

/** Staff publish vacancies for verified employers (or for a new employer profile they manage). */
export default async function AdminNewJobPage() {
  await requirePermissionPage("jobs.post");
  const [companies, categories, locations, allSkills] = await Promise.all([
    db.company.findMany({ where: { status: "APPROVED" }, select: { id: true, name: true, isDemo: true }, orderBy: { name: "asc" } }),
    jobCategories(),
    areaLocations(),
    skills(),
  ]);
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Post a job"
        description="Publish a vacancy on behalf of a verified employer. It appears on the jobs page immediately, and applications go to that employer's dashboard."
      />
      <Card>
        <CardBody>
          <JobForm
            canPublish
            saveAction={adminSaveJobAction}
            redirectTo="/admin/jobs"
            companyOptions={companies.map((c) => ({ value: c.id, label: c.isDemo ? `${c.name} (demo)` : c.name }))}
            categories={categories.map((c) => ({ value: c.id, label: c.name }))}
            locations={locations.map((l) => ({ value: l.id, label: l.label }))}
            skills={allSkills.map((s) => ({ value: s.id, label: s.name }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}
