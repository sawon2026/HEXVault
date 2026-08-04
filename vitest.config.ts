import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/core/**/*.ts", "src/api/**/*.ts", "src/config/**/*.ts"],
      exclude: [
        "src/cli/**",
        "src/action/**",
        "src/dashboard/**",
        "**/*.d.ts",
        "**/node_modules/**",
      ],
      thresholds: {
        lines: 50,
        functions: 50,
        statements: 50,
        branches: 40,
      },
    },
  },
});
