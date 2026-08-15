import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/ingest/__tests__/**/*.test.ts", "lib/__tests__/**/*.test.ts"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@ingest": path.resolve(__dirname, "packages/ingest/src"),
    },
  },
});
