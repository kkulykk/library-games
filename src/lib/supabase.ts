import { createClient } from '@supabase/supabase-js'
import { createFakeSupabaseClient } from '@/lib/e2e/fake-supabase'

type QueryResult<T> = Promise<{
  data: T | null
  error: { message: string; code?: string; details?: string; hint?: string } | null
}>

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

// The single typed view of a room row returned by the SECURITY DEFINER RPCs
// (create/join/restore/get/dispatch_<game>). `state` STAYS `unknown` (D-09): it is untrusted
// network data and MUST continue through the game's Zod `stateSchema.safeParse` downstream —
// narrowing it here would silently bypass that runtime validation. Typing this seam once removes
// the ad-hoc per-field `as number` / `as string` / `as Record` casts at every call site.
export interface RoomRpcRow {
  state: unknown
  version: number
  room_token?: string
}

// SECURITY DEFINER RPCs (plan 02-01) use `returns table(...)`, so `data` is an array the
// caller reads `[0]` from, and `error` carries a stable Postgres `code` (22023/42501/40001/23505).
type RpcResult = {
  data: RoomRpcRow[] | null
  error: { message: string; code?: string } | null
}

type SupabaseBoundary = {
  from(table: string): QueryBuilderBoundary
  channel(name: string): ChannelBoundary
  rpc(fn: string, args?: Record<string, unknown>): Promise<RpcResult>
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const useFakeSupabase = process.env.NEXT_PUBLIC_E2E_FAKE_SUPABASE === '1'

export const supabase: SupabaseBoundary | null = useFakeSupabase
  ? // Deliberate untyped fake↔real boundary cast (D-10): the in-memory fake client and the
    // real @supabase/supabase-js client are two different concrete types unified onto the
    // minimal SupabaseBoundary contract; structurally typing that seam would require widening
    // SupabaseBoundary. No `any` and no suppression directive (D-11) — the narrow boundary type is kept.
    (createFakeSupabaseClient() as unknown as SupabaseBoundary)
  : url && key
    ? // Deliberate untyped fake↔real boundary cast (D-10): the real SupabaseClient is far wider
      // than the SupabaseBoundary contract we consume; this cast pins it to that minimal surface.
      (createClient(url, key) as unknown as SupabaseBoundary)
    : null
export const isSupabaseConfigured = useFakeSupabase || Boolean(url && key)
