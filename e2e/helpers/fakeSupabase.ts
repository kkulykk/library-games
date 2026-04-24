import { expect, test as base } from '@playwright/test'

const fakeSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'

export async function resetFakeSupabase(): Promise<void> {
  const response = await fetch(`${fakeSupabaseUrl}/reset`, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Failed to reset fake Supabase: ${response.status} ${response.statusText}`)
  }
}

export const test = base.extend({
  page: async ({ page }, runTest) => {
    await resetFakeSupabase()
    await runTest(page)
  },
})

export { expect }
