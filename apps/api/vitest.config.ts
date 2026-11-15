import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Controller tests build a fresh PGlite database and Nest app for every test. With one worker per core they
  // starve each other and setup hooks pass 30 s, so at most four files run at once.
  // ponytail: per-test app boot is the real cost; share one app per file (beforeAll + data reset) if the suite grows.
  test: { include: ['src/**/*.test.ts'], testTimeout: 30000, hookTimeout: 30000, maxWorkers: 4 },
});
