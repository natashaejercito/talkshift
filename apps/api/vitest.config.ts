import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-env.ts', './test/mock-auth.ts'],
    fileParallelism: false, // test files share one database, so run them one at a time
  },
})