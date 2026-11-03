/**
 * Bootstrap (or promote) a Super Admin. There is intentionally no public route for this.
 *
 *   SUPER_ADMIN_NAME="..." SUPER_ADMIN_PHONE="09..." SUPER_ADMIN_PASSWORD="..." npm run admin:create
 *
 * If the phone already belongs to a user, that user is granted SUPER_ADMIN and activated
 * (the password is left unchanged).
 */
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma";
import { hashPassword } from "../lib/auth/password";
import { normalizePhone } from "../lib/phone";

const db = new PrismaClient();

async function main() {
  const name = process.env.SUPER_ADMIN_NAME?.trim();
  const phone = normalizePhone(process.env.SUPER_ADMIN_PHONE ?? "");
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "";
  if (!name || !phone) throw new Error("Set SUPER_ADMIN_NAME and a valid SUPER_ADMIN_PHONE.");

  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) {
    await db.userRole.upsert({ where: { userId_role: { userId: existing.id, role: "SUPER_ADMIN" } }, create: { userId: existing.id, role: "SUPER_ADMIN" }, update: {} });
    await db.user.update({ where: { id: existing.id }, data: { status: "ACTIVE", activatedAt: existing.activatedAt ?? new Date() } });
    await db.auditLog.create({ data: { action: "role.grant", entityType: "User", entityId: existing.id, metadata: { role: "SUPER_ADMIN", via: "cli" } } });
    console.log(`✓ Granted SUPER_ADMIN to existing user ${phone}`);
    return;
  }
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 12 characters with letters and numbers.");
  }
  const user = await db.user.create({
    data: {
      fullName: name,
      phone,
      passwordHash: await hashPassword(password),
      status: "ACTIVE",
      activatedAt: new Date(),
      roles: { create: [{ role: "SUPER_ADMIN" }] },
      profile: { create: { phoneVisibility: "HIDDEN" } },
    },
  });
  await db.auditLog.create({ data: { action: "user.create_super_admin", entityType: "User", entityId: user.id, metadata: { via: "cli" } } });
  console.log(`✓ Created super admin ${phone}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
