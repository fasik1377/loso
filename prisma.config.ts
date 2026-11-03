import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 6 + MongoDB: the connection URL is read from DATABASE_URL in prisma/schema.prisma.
// MongoDB has no migrations; apply schema indexes with `npm run db:push`.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
