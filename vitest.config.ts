import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
    mockReset: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
