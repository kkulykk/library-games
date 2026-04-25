import { createClient } from '@supabase/supabase-js'
import { createFakeSupabaseClient } from '@/lib/e2e/fake-supabase'

type QueryResult<T> = Promise<{ data: T | null; error: { message: string } | null }>

type QueryBuilderBoundary = {
  insert(values: unknown): QueryBuilderBoundary
  update(values: unknown): QueryBuilderBoundary
  select(columns?: string): QueryResult<Record<string, unknown>[]> & QueryBuilderBoundary
  eq(column: string, value: unknown): QueryBuilderBoundary
  single(): QueryResult<Record<string, unknown>>
}

type ChannelBoundary = {
  on<TPayload = unknown>(
    type: string,
    config: unknown,
    callback: (payload: TPayload) => void
  ): ChannelBoundary
  subscribe(callback?: (status: string) => void | Promise<void>): ChannelBoundary
  send(message: unknown): Promise<unknown>
  track(payload: Record<string, unknown>): Promise<unknown>
  presenceState(): Record<string, unknown[]>
  unsubscribe(): Promise<unknown>
}

type SupabaseBoundary = {
  from(table: string): QueryBuilderBoundary
  channel(name: string): ChannelBoundary
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const useFakeSupabase = process.env.NEXT_PUBLIC_E2E_FAKE_SUPABASE === '1'

export const supabase: SupabaseBoundary | null = useFakeSupabase
  ? (createFakeSupabaseClient() as unknown as SupabaseBoundary)
  : url && key
    ? (createClient(url, key) as unknown as SupabaseBoundary)
    : null
export const isSupabaseConfigured = useFakeSupabase || Boolean(url && key)
