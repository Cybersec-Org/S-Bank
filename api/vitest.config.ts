import { defineConfig } from 'vitest/config';

/** Unit tests: pure functions and services with fakes — no database, no network. */
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
  },
});
