import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // "server-only" throws outside the React server bundler; it is a no-op in tests.
      "server-only": path.resolve(__dirname, "tests/support/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests share one database; run files sequentially.
    fileParallelism: false,
    // Integration tests make many round trips to a remote database (e.g. MongoDB Atlas).
    testTimeout: 240_000,
    hookTimeout: 120_000,
  },
});
