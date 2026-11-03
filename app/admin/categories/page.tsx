import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requirePermissionPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { saveTaxonomyAction, toggleTaxonomyAction } from "@/lib/actions/admin";
import { humanize } from "@/lib/format";
import { Badge, Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { ActionButton, HiddenFields, SectionTitle, adminInput } from "@/components/admin/action-forms";

export const metadata: Metadata = { title: "Categories & locations" };

type Kind = "service" | "job" | "skill" | "location";
const ICONS = ["zap", "wrench", "footprints", "hard-hat", "hammer", "paintbrush", "sparkles", "car", "tv", "laptop", "scissors", "truck", "sprout", "briefcase"];

interface Row {
  id: string;
  name: string;
  active: boolean;
  sortOrder?: number;
  description?: string | null;
  icon?: string | null;
}

export default async function AdminCategoriesPage() {
  await requirePermissionPage("taxonomy.manage");
  const [serviceCats, jobCats, skills, locations] = await Promise.all([
    db.serviceCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.jobCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.skill.findMany({ orderBy: { name: "asc" } }),
    db.location.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  const roots = locations.filter((l) => l.parentId === null);
  const childrenOf = (id: string) => locations.filter((l) => l.parentId === id);
  const cities = locations.filter((l) => l.type === "CITY");

  return (
    <div>
      <PageHeader
        title="Categories & locations"
        description="Deactivating hides an item from new listings and filters without deleting existing records. Lists are ordered by the sort order number (lowest first)."
      />

      <SectionTitle title="Service categories" />
      <Card>
        <CardBody className="space-y-3">
          <CreateForm kind="service" withSortOrder withDescription withIcon />
          <ul className="divide-y divide-line">
            {serviceCats.map((c) => (
              <EditRow key={c.id} kind="service" row={c} withSortOrder withDescription withIcon leading={<CategoryIcon name={c.icon} className="h-5 w-5 text-brand" />} />
            ))}
          </ul>
        </CardBody>
      </Card>

      <SectionTitle title="Job categories" />
      <Card>
        <CardBody className="space-y-3">
          <CreateForm kind="job" withSortOrder />
          <ul className="divide-y divide-line">
            {jobCats.map((c) => <EditRow key={c.id} kind="job" row={c} withSortOrder />)}
          </ul>
        </CardBody>
      </Card>

      <SectionTitle title="Skills" />
      <Card>
        <CardBody className="space-y-3">
          <CreateForm kind="skill" />
          <ul className="divide-y divide-line">
            {skills.map((s) => <EditRow key={s.id} kind="skill" row={s} />)}
          </ul>
        </CardBody>
      </Card>

      <SectionTitle title="Locations" description="Cities and their neighborhoods. Leave “Parent city” empty to add a new city." />
      <Card>
        <CardBody className="space-y-3">
          <CreateForm kind="location" withSortOrder parents={cities.map((c) => ({ id: c.id, name: c.name }))} />
          <ul className="divide-y divide-line">
            {roots.map((city) => (
              <li key={city.id} className="py-2">
                <EditRow kind="location" row={city} withSortOrder asDiv leading={<Badge tone="brand">{humanize(city.type)}</Badge>} />
                <ul className="ml-4 border-l border-line pl-4 sm:ml-8">
                  {childrenOf(city.id).map((n) => (
                    <li key={n.id}>
                      <EditRow kind="location" row={n} withSortOrder asDiv leading={<Badge>{humanize(n.type)}</Badge>} />
                      {childrenOf(n.id).length > 0 && (
                        <ul className="ml-4 border-l border-line pl-4">
                          {childrenOf(n.id).map((g) => (
                            <li key={g.id}><EditRow kind="location" row={g} withSortOrder asDiv leading={<Badge>{humanize(g.type)}</Badge>} /></li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function CreateForm({
  kind,
  withSortOrder,
  withDescription,
  withIcon,
  parents,
}: {
  kind: Kind;
  withSortOrder?: boolean;
  withDescription?: boolean;
  withIcon?: boolean;
  parents?: { id: string; name: string }[];
}) {
  const p = `new-${kind}`;
  return (
    <ActionForm action={saveTaxonomyAction} resetOnSuccess className="rounded-lg border border-dashed border-line bg-canvas p-3">
      <HiddenFields fields={{ kind }} />
      <div className="flex flex-wrap items-end gap-2">
        <Labelled label="Name" htmlFor={`${p}-name`} className="min-w-[12rem] flex-1">
          <input id={`${p}-name`} name="name" required maxLength={80} className={adminInput} />
        </Labelled>
        {parents && (
          <Labelled label="Parent city" htmlFor={`${p}-parent`}>
            <select id={`${p}-parent`} name="parentId" defaultValue="" className={adminInput}>
              <option value="">— None (new city) —</option>
              {parents.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Labelled>
        )}
        {withIcon && <IconSelect id={`${p}-icon`} />}
        {withSortOrder && (
          <Labelled label="Sort order" htmlFor={`${p}-sort`} className="w-24">
            <input id={`${p}-sort`} name="sortOrder" type="number" min={0} max={10000} defaultValue={0} className={adminInput} />
          </Labelled>
        )}
        {withDescription && (
          <Labelled label="Description" htmlFor={`${p}-desc`} className="min-w-[14rem] flex-[2]">
            <input id={`${p}-desc`} name="description" maxLength={300} className={adminInput} />
          </Labelled>
        )}
        <SubmitButton size="md" pendingText="Adding…">Add</SubmitButton>
      </div>
    </ActionForm>
  );
}

function EditRow({
  kind,
  row,
  withSortOrder,
  withDescription,
  withIcon,
  leading,
  asDiv,
}: {
  kind: Kind;
  row: Row;
  withSortOrder?: boolean;
  withDescription?: boolean;
  withIcon?: boolean;
  leading?: ReactNode;
  asDiv?: boolean;
}) {
  const p = `edit-${row.id}`;
  const content = (
    <div className="flex flex-col gap-2 py-2 lg:flex-row lg:items-end">
      <ActionForm action={saveTaxonomyAction} showSuccess className="flex-1">
        <HiddenFields fields={{ kind, id: row.id }} />
        <div className="flex flex-wrap items-end gap-2">
          {leading && <span className="mb-2 shrink-0">{leading}</span>}
          <Labelled label="Name" htmlFor={`${p}-name`} className="min-w-[10rem] flex-1">
            <input id={`${p}-name`} name="name" required maxLength={80} defaultValue={row.name} className={adminInput} />
          </Labelled>
          {withIcon && <IconSelect id={`${p}-icon`} defaultValue={row.icon ?? ""} />}
          {withSortOrder && (
            <Labelled label="Sort" htmlFor={`${p}-sort`} className="w-20">
              <input id={`${p}-sort`} name="sortOrder" type="number" min={0} max={10000} defaultValue={row.sortOrder ?? 0} className={adminInput} />
            </Labelled>
          )}
          {withDescription && (
            <Labelled label="Description" htmlFor={`${p}-desc`} className="min-w-[12rem] flex-[2]">
              <input id={`${p}-desc`} name="description" maxLength={300} defaultValue={row.description ?? ""} className={adminInput} />
            </Labelled>
          )}
          <SubmitButton variant="outline" size="md" pendingText="Saving…">Save</SubmitButton>
        </div>
      </ActionForm>
      <div className="flex items-center gap-2 lg:pb-0.5">
        {!row.active && <Badge>Inactive</Badge>}
        <ActionButton
          action={toggleTaxonomyAction}
          fields={{ kind, id: row.id, active: row.active ? "0" : "1" }}
          label={row.active ? "Deactivate" : "Activate"}
          variant={row.active ? "ghost" : "primary"}
        />
      </div>
    </div>
  );
  return asDiv ? content : <li>{content}</li>;
}

function IconSelect({ id, defaultValue = "" }: { id: string; defaultValue?: string }) {
  return (
    <Labelled label="Icon" htmlFor={id} className="w-36">
      <select id={id} name="icon" defaultValue={defaultValue} className={adminInput}>
        <option value="">Default</option>
        {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
      </select>
    </Labelled>
  );
}

function Labelled({ label, htmlFor, className, children }: { label: string; htmlFor: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
