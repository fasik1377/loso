import "dotenv/config";
import { PrismaClient } from "./lib/generated/prisma";
const db = new PrismaClient({ transactionOptions: { maxWait: 10_000, timeout: 60_000 } });
async function main() {
  const users = await db.user.findMany({ where: { fullName: { startsWith: "Test " }, isDemo: false }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: ids } }] } });
  await db.job.deleteMany({ where: { postedById: { in: ids } } });
  let n = 0;
  for (const id of ids) await db.user.delete({ where: { id } }).then(() => n++).catch((e) => console.log("ERR", id, e.code));
  console.log(`removed ${n}/${ids.length} leftover test users; remaining:`, await db.user.count({ where: { fullName: { startsWith: "Test " } } }));
}
main().finally(() => db.$disconnect());
