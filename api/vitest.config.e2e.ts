import { defineConfig } from 'vitest/config';

/** End-to-end tests: the real Nest pipeline over HTTP (supertest) against DATABASE_URL. */
export default defineConfig({
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['test/helpers/test-env.ts'],
    // All files share one database, so they run one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
