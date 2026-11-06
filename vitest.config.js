import { defineConfig } from 'vitest/config';

// Unit tests only; the Playwright specs in tests/*.spec.js run with `npm run test:e2e`.
export default defineConfig({
  define: { __TEST_HOOKS__: 'false' },
  test: { include: ['tests/unit/**/*.test.js'], environment: 'node' },
});
