import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { formatMoney, formatRange, toMinorUnits } from "@/lib/money";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { jobSchema, registerSchema } from "@/lib/validation/schemas";

describe("Ethiopian phone normalization", () => {
  it.each([
    ["0911234567", "+251911234567"],
    ["0911 23 45 67", "+251911234567"],
    ["911234567", "+251911234567"],
    ["251911234567", "+251911234567"],
    ["+251-911-234-567", "+251911234567"],
    ["00251711234567", "+251711234567"],
    ["0462201234", "+251462201234"],
  ])("%s → %s", (input: string, expected: string) => expect(normalizePhone(input)).toBe(expected));

  it.each(["", "12345", "0811234567", "+2519112345678", "abc0911234567"])("rejects %s", (input: string) => expect(normalizePhone(input)).toBeNull());

  it("formats for display", () => expect(formatPhone("+251911234567")).toBe("+251 91 123 4567"));
});

describe("money (integer minor units)", () => {
  it("converts and formats ETB", () => {
    expect(toMinorUnits("150.50")).toBe(15050);
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
    expect(formatMoney(15000)).toBe("ETB 150");
    expect(formatMoney(15050)).toBe("ETB 150.50");
    expect(formatRange(30000, 150000)).toBe("ETB 300 – 1,500");
    expect(formatRange(null, null)).toBeNull();
  });
  it("rejects invalid amounts", () => {
    expect(() => toMinorUnits(-1)).toThrow();
    expect(() => toMinorUnits("abc")).toThrow();
  });
});

describe("password hashing", () => {
  it("verifies correct passwords and rejects wrong ones", async () => {
    const hash = await hashPassword("Secret123");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("Secret123");
    expect(await verifyPassword("Secret123", hash)).toBe(true);
    expect(await verifyPassword("secret123", hash)).toBe(false);
    expect(await verifyPassword("Secret123", "garbage")).toBe(false);
  });
  it("salts every hash", async () => {
    expect(await hashPassword("Same12345")).not.toBe(await hashPassword("Same12345"));
  });
  it("tokens are random and stored hashed", () => {
    const t = generateToken();
    expect(t).not.toBe(generateToken());
    expect(hashToken(t)).toHaveLength(64);
    expect(hashToken(t)).not.toContain(t);
  });
});

describe("validation", () => {
  const base = {
    accountType: "WORKER",
    fullName: "Abebe Kebede",
    phone: "0911234567",
    password: "Password1",
    confirmPassword: "Password1",
    seeksJobs: true,
    offersServices: false,
    acceptTerms: true,
  } as const;
  it("normalizes the phone during registration", () => {
    const r = registerSchema.safeParse(base);
    expect(r.success && r.data.phone).toBe("+251911234567");
  });
  it("a worker must choose at least one activity", () => {
    expect(registerSchema.safeParse({ ...base, seeksJobs: false, offersServices: false }).success).toBe(false);
  });
  it("cannot register as a staff role", () => {
    expect(registerSchema.safeParse({ ...base, accountType: "SUPER_ADMIN" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, accountType: "ADMIN" }).success).toBe(false);
  });
  it("employers must give a company name", () => {
    expect(registerSchema.safeParse({ ...base, accountType: "EMPLOYER" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, accountType: "EMPLOYER", companyName: "Acme" }).success).toBe(true);
  });
  it("job salary range must be ordered and converted to minor units", () => {
    const job = {
      title: "Cashier",
      description: "A reasonably long description of the job duties here.",
      employmentType: "FULL_TIME",
      experienceLevel: "ENTRY",
      workplaceType: "ON_SITE",
      salaryVisible: true,
      vacancies: 1,
      applicationMethod: "IN_APP",
      salaryMin: "5000",
      salaryMax: "4000",
    };
    expect(jobSchema.safeParse(job).success).toBe(false);
    const ok = jobSchema.safeParse({ ...job, salaryMax: "8000", questions: [{ text: "Why us?" }, { text: "" }] });
    expect(ok.success && ok.data.salaryMin).toBe(500000);
    expect(ok.success && ok.data.questions).toEqual(["Why us?"]);
  });
});
