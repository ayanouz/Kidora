import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
    testTimeout: 15000,
    // Valeurs factices : évite le fail-fast de src/config/env.ts si un
    // module importé par les tests tire la config par transitivité.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/kidora_test",
      JWT_SECRET: "test-secret-test-secret-test-secret-test-secret",
      SESSION_SECRET: "test-session-test-session-test-session-test-session",
    },
  },
});
