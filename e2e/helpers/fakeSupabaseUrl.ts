/**
 * Where the in-memory fake Supabase server (`e2e/fake-supabase/server.mjs`) listens.
 *
 * This is the harness talking to its own process, so it is deliberately NOT derived from
 * `NEXT_PUBLIC_SUPABASE_URL`. That variable is the *app's* backend address: `playwright.config.ts`
 * sets it for the dev server it starts, but it is also a normal build-time variable that CI or a
 * developer's shell may have set to something real. Reading it here meant any ambient value
 * silently redirected the harness's own `/reset` and `/admin/query` calls away from the local fake
 * — which is exactly what happened when `test.yml` gained placeholder Supabase vars for the
 * static-export build: every spec failed on `ENOTFOUND ci-placeholder.supabase.co`.
 *
 * Override with `FAKE_SUPABASE_URL` if the port ever needs to move.
 */
export const FAKE_SUPABASE_URL = process.env.FAKE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
