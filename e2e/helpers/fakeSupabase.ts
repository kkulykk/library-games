import { expect, test as base } from '@playwright/test'

const fakeSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'

type FakeSupabaseQueryPayload = {
  op: 'select' | 'update' | 'insert'
  table: string
  values?: unknown
  filters?: Array<{ column: string; value: unknown }>
  columns?: string
  single?: boolean
}

type FakeSupabaseQueryResult<T = unknown> = {
  data: T | null
  error: { message: string } | null
}

export async function resetFakeSupabase(): Promise<void> {
  const response = await fetch(`${fakeSupabaseUrl}/reset`, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Failed to reset fake Supabase: ${response.status} ${response.statusText}`)
  }
}

export async function fakeSupabaseQuery<T = unknown>(
  payload: FakeSupabaseQueryPayload
): Promise<FakeSupabaseQueryResult<T>> {
  const response = await fetch(`${fakeSupabaseUrl}/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Fake Supabase /query failed: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as FakeSupabaseQueryResult<T>
}

export const test = base.extend({
  page: async ({ page }, runTest) => {
    await resetFakeSupabase()
    await runTest(page)
  },
})

export { expect }
