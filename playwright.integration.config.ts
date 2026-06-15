import { defineConfig, devices } from '@playwright/test'

// Opt-in real-Supabase integration canary config (D-13).
//
// This config runs ONLY `e2e/integration/**` and is invoked on demand via
// `pnpm test:supabase`. It is deliberately separate from `playwright.config.ts`
// so that:
//   - the default `pnpm e2e` / `e2e:ci` run never picks up the canary
//     (that config sets `testIgnore: ['**/integration/**']`), and
//   - the canary does NOT spin up the fake-Supabase server or the Next dev
//     server — it talks directly to a real Supabase project over the network.
//
// The spec self-skips when `SUPABASE_TEST_URL` is unset (including in CI), so
// this command is safe to run anywhere; it simply reports skipped without the
// required env. Required env vars: SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY.
export default defineConfig({
  testDir: './e2e/integration',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
