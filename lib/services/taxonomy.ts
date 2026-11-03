import "server-only";
import { db } from "@/lib/db";

export async function serviceCategories() {
  return db.serviceCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function jobCategories() {
  return db.jobCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function skills() {
  return db.skill.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

/** Neighborhoods / sub-cities (children of cities), labelled with their parent. */
export async function areaLocations() {
  const rows = await db.location.findMany({
    where: { active: true, parentId: { not: null } },
    include: { parent: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  // Group by parent order (MongoDB can't sort by a related document's field).
  rows.sort((a, b) => (a.parent?.sortOrder ?? 0) - (b.parent?.sortOrder ?? 0));
  return rows.map((l) => ({ id: l.id, slug: l.slug, name: l.name, label: l.parent ? `${l.name}, ${l.parent.name}` : l.name }));
}

export const toOptions = <T extends { name: string }>(rows: T[], key: (r: T) => string) =>
  rows.map((r) => ({ value: key(r), label: r.name }));
