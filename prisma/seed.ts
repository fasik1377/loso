/**
 * Development seed.
 *
 * Always (idempotent): reference data — service categories, job categories, skills, Hawassa
 * locations. These are an initial list that administrators can edit in /admin/categories.
 *
 * Only with SEED_DEMO_DATA=true (never in production): clearly labelled DEMO accounts, a demo
 * company and demo jobs. Demo records have isDemo=true and are shown with a "Demo" badge; they are
 * never marked as verified and no reviews/ratings are fabricated.
 */
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma";
import { hashPassword } from "../lib/auth/password";

const db = new PrismaClient();

const SERVICE_CATEGORIES: [string, string, string, string][] = [
  ["electrical", "Electrical installation & repair", "zap", "Wiring, sockets, lighting and electrical faults."],
  ["plumbing", "Plumbing & pipeline repair", "wrench", "Leaks, pipes, water tanks and bathroom fittings."],
  ["shoe-shining", "Shoe shining & shoe repair", "footprints", "Polishing, stitching and sole repair."],
  ["construction", "Construction & masonry", "hard-hat", "Building, plastering, tiling and block work."],
  ["carpentry", "Carpentry & furniture repair", "hammer", "Doors, cabinets and furniture repair."],
  ["painting", "Painting", "paintbrush", "Interior and exterior painting."],
  ["cleaning", "Cleaning & domestic services", "sparkles", "Home and office cleaning, laundry."],
  ["vehicle-mechanics", "Vehicle mechanics", "car", "Car, Bajaj and motorbike repair."],
  ["appliance-repair", "Appliance & electronics repair", "tv", "TV, fridge, phone and appliance repair."],
  ["it-support", "Computer & IT support", "laptop", "Computer repair, networking and software help."],
  ["beauty", "Beauty & personal care", "scissors", "Hair, braiding, makeup and personal care."],
  ["moving-delivery", "Moving & delivery", "truck", "Moving help and local delivery."],
  ["gardening", "Gardening & household tasks", "sprout", "Gardening, compound work and odd jobs."],
  ["professional", "Professional, business & technical services", "briefcase", "Accounting, design, tutoring and consulting."],
];

const JOB_CATEGORIES = [
  "Administration & office",
  "Sales & marketing",
  "Hospitality & tourism",
  "Construction & trades",
  "Manufacturing & industrial park",
  "Health",
  "Education & training",
  "IT & technology",
  "Finance & accounting",
  "Driving & logistics",
  "Agriculture",
  "NGO & development",
  "Security",
  "Other",
];

const SKILLS = [
  "Electrical wiring", "Plumbing", "Masonry", "Tiling", "Carpentry", "Painting", "Welding", "Driving (Code 3)",
  "Customer service", "Sales", "Cashier", "Bookkeeping", "Microsoft Excel", "Computer maintenance", "Networking",
  "Web development", "Graphic design", "Cooking", "Housekeeping", "Hair styling", "Tailoring", "Auto mechanics",
  "Amharic", "Sidamu Afo", "English", "Afaan Oromo",
];

/** Hawassa sub-cities (initial list; admins can add neighborhoods/kebeles). */
const HAWASSA_SUB_CITIES = ["Addis Ketema", "Hayk Dar", "Bahil Adarash", "Menaharia", "Mehal Ketema", "Misrak", "Tabor", "Tula"];

const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function seedReferenceData() {
  for (const [i, [s, name, icon, description]] of SERVICE_CATEGORIES.entries()) {
    await db.serviceCategory.upsert({ where: { slug: s }, create: { slug: s, name, icon, description, sortOrder: i * 10 }, update: {} });
  }
  for (const [i, name] of JOB_CATEGORIES.entries()) {
    await db.jobCategory.upsert({ where: { slug: slug(name) }, create: { slug: slug(name), name, sortOrder: i * 10 }, update: {} });
  }
  for (const name of SKILLS) {
    await db.skill.upsert({ where: { slug: slug(name) }, create: { slug: slug(name), name }, update: {} });
  }
  const city = await db.location.upsert({ where: { slug: "hawassa" }, create: { slug: "hawassa", name: "Hawassa", type: "CITY" }, update: {} });
  for (const [i, name] of HAWASSA_SUB_CITIES.entries()) {
    const s = `hawassa-${slug(name)}`;
    await db.location.upsert({ where: { slug: s }, create: { slug: s, name, type: "SUB_CITY", parentId: city.id, sortOrder: i * 10 }, update: {} });
  }
  console.log("✓ reference data (categories, skills, locations)");
}

async function seedDemoData() {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 8) throw new Error("Set SEED_DEMO_PASSWORD (8+ chars) to create demo accounts.");
  const passwordHash = await hashPassword(password);

  // Development fee settings — clearly not real payment details.
  await db.platformSetting.upsert({ where: { key: "registrationFeeMinor" }, create: { key: "registrationFeeMinor", value: 20000 }, update: {} });
  await db.platformSetting.upsert({
    where: { key: "manualPaymentInstructions" },
    create: {
      key: "manualPaymentInstructions",
      value: "DEVELOPMENT ENVIRONMENT — these are not real payment details. Enter any test reference (e.g. TEST-0001) to try the review flow. Do not send real money.",
    },
    update: {},
  });

  const areas = await db.location.findMany({ where: { type: "SUB_CITY" } });
  const cat = async (s: string) => (await db.serviceCategory.findUniqueOrThrow({ where: { slug: s } })).id;
  const skill = async (s: string) => (await db.skill.findUniqueOrThrow({ where: { slug: slug(s) } })).id;

  async function demoUser(phone: string, fullName: string, roles: ("SUPER_ADMIN" | "ADMIN" | "MODERATOR" | "WORKER" | "CUSTOMER" | "EMPLOYER")[]) {
    return db.user.upsert({
      where: { phone },
      create: {
        phone,
        fullName,
        passwordHash,
        status: "ACTIVE",
        activatedAt: new Date(),
        isDemo: true,
        roles: { create: roles.map((role) => ({ role })) },
        profile: { create: { bio: "Demo account created by the development seed. Not a real person.", languages: ["Amharic", "Sidamu Afo"] } },
      },
      update: {},
    });
  }

  await demoUser("+251900000001", "Demo Super Admin", ["SUPER_ADMIN"]);
  await demoUser("+251900000002", "Demo Moderator", ["MODERATOR"]);
  await demoUser("+251900000010", "Demo Customer", ["CUSTOMER"]);

  const workers: [string, string, string, string[], [string, string, number, number][]][] = [
    ["+251900000020", "Demo Worker — Electrician", "Electrician (demo profile)", ["Electrical wiring"], [["electrical", "House wiring and socket repair", 300, 1500]]],
    ["+251900000021", "Demo Worker — Plumber", "Plumber (demo profile)", ["Plumbing"], [["plumbing", "Leak and pipe repair", 250, 1200]]],
    ["+251900000022", "Demo Worker — Cleaner", "Home cleaning (demo profile)", ["Housekeeping"], [["cleaning", "Home deep cleaning", 400, 900]]],
  ];
  for (const [i, [phone, name, headline, skillNames, services]] of workers.entries()) {
    const u = await demoUser(phone, name, ["WORKER"]);
    const existing = await db.workerProfile.findUnique({ where: { userId: u.id } });
    if (existing) continue;
    const wp = await db.workerProfile.create({
      data: {
        userId: u.id,
        headline,
        seeksJobs: true,
        offersServices: true,
        yearsExperience: 3 + i,
        experienceSummary: "Sample experience text for a demo profile.",
        pricingMethod: "PER_JOB",
        priceMinMinor: services[0]![2] * 100,
        priceMaxMinor: services[0]![3] * 100,
        skills: { create: await Promise.all(skillNames.map(async (s) => ({ skillId: await skill(s) }))) },
        areas: { create: areas.slice(i, i + 3).map((a) => ({ locationId: a.id })) },
      },
    });
    for (const [s, title, min, max] of services) {
      await db.workerService.create({ data: { workerId: wp.id, categoryId: await cat(s), title, pricingMethod: "PER_JOB", priceMinMinor: min * 100, priceMaxMinor: max * 100 } });
    }
    // Registration fee record waived for demo accounts (never shown as a real payment).
    await db.registrationPayment.create({ data: { userId: u.id, amountMinor: 0, status: "WAIVED", reviewNote: "Demo account — no payment." } });
  }

  const employer = await demoUser("+251900000030", "Demo Employer", ["EMPLOYER"]);
  let company = await db.company.findFirst({ where: { ownerId: employer.id } });
  if (!company) {
    await db.employerProfile.create({ data: { userId: employer.id, employerType: "COMPANY" } });
    company = await db.company.create({
      data: {
        ownerId: employer.id,
        name: "Demo Company (sample data)",
        slug: "demo-company",
        description: "This company is sample data created by the development seed. It is not a real employer.",
        industry: "Demo",
        status: "APPROVED", // allows demo jobs to be published; UI shows "Demo company", never "Verified"
        isDemo: true,
        members: { create: { userId: employer.id, role: "OWNER" } },
      },
    });
    const jobCat = await db.jobCategory.findFirstOrThrow({ where: { slug: slug("Administration & office") } });
    const deadline = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    for (const [title, type] of [
      ["[Demo] Office assistant", "FULL_TIME"],
      ["[Demo] Part-time electrician", "PART_TIME"],
    ] as const) {
      await db.job.create({
        data: {
          companyId: company.id,
          postedById: employer.id,
          categoryId: jobCat.id,
          title,
          description: "This is a demo job created by the development seed so you can test applications. It is not a real vacancy.",
          employmentType: type,
          locationId: areas[0]?.id,
          salaryMinMinor: 600000,
          salaryMaxMinor: 900000,
          deadline,
          status: "PUBLISHED",
          publishedAt: new Date(),
          questions: { create: [{ prompt: "How many years of relevant experience do you have?", required: true }] },
        },
      });
    }
  }
  console.log("✓ demo data (all accounts use SEED_DEMO_PASSWORD; phones +2519000000xx)");
}

async function main() {
  await seedReferenceData();
  if (process.env.SEED_DEMO_DATA === "true") {
    if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production.");
    await seedDemoData();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
