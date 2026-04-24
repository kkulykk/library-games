type QueryResult<T> = { data: T | null; error: { message: string } | null }

type Filter = { column: string; value: unknown }

type RealtimeStatus = 'SUBSCRIBED'

type PostgresChangesConfig = {
  event?: string
  table?: string
  filter?: string
}

type BroadcastConfig = {
  event?: string
}

type PresenceConfig = {
  event?: string
}

type PostgresPayload = {
  new: Record<string, unknown>
  old: Record<string, unknown>
}

type BroadcastPayload = {
  event: string
  payload: unknown
}

type PresencePayload = Record<string, unknown[]>

type Handler =
  | {
      type: 'postgres_changes'
      config: PostgresChangesConfig
      callback: (payload: PostgresPayload) => void
    }
  | { type: 'broadcast'; config: BroadcastConfig; callback: (payload: BroadcastPayload) => void }
  | { type: 'presence'; config: PresenceConfig; callback: () => void }

type FakeEvent =
  | {
      id: number
      type: 'postgres_changes'
      table: string
      new: Record<string, unknown>
      old: Record<string, unknown>
    }
  | { id: number; type: 'broadcast'; channel: string; event: string; payload: unknown }
  | { id: number; type: 'presence'; channel: string; state: PresencePayload }

const fakeSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const pollMs = 100

function clientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${fakeSupabaseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) throw new Error(`Fake Supabase ${path} failed: ${response.status}`)
  return (await response.json()) as T
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${fakeSupabaseUrl}${path}`)
  if (!response.ok) throw new Error(`Fake Supabase ${path} failed: ${response.status}`)
  return (await response.json()) as T
}

function parseEqFilter(filter?: string): Filter | null {
  if (!filter) return null
  const match = filter.match(/^([^=]+)=eq\.(.+)$/)
  if (!match) return null
  return { column: match[1], value: match[2] }
}

class FakeQueryBuilder {
  private readonly filters: Filter[] = []
  private op: 'insert' | 'select' | 'update' | null = null
  private values: unknown = null
  private selectedColumns = '*'

  constructor(private readonly table: string) {}

  insert(values: unknown): this {
    this.op = 'insert'
    this.values = values
    return this
  }

  update(values: unknown): this {
    this.op = 'update'
    this.values = values
    return this
  }

  select(columns = '*'): Promise<QueryResult<Record<string, unknown>[]>> & this {
    this.selectedColumns = columns
    if (!this.op) this.op = 'select'
    return this as Promise<QueryResult<Record<string, unknown>[]>> & this
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value })
    return this
  }

  async single(): Promise<QueryResult<Record<string, unknown>>> {
    if (!this.op) this.op = 'select'
    return this.execute<Record<string, unknown>>(true)
  }

  then<TResult1 = QueryResult<Record<string, unknown>[]>, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult<Record<string, unknown>[]>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute<Record<string, unknown>[]>(false).then(onfulfilled, onrejected)
  }

  private async execute<T>(single: boolean): Promise<QueryResult<T>> {
    return post<QueryResult<T>>('/query', {
      op: this.op,
      table: this.table,
      values: this.values,
      filters: this.filters,
      columns: this.selectedColumns,
      single,
    })
  }
}

class FakeRealtimeChannel {
  private readonly handlers: Handler[] = []
  private readonly id = clientId()
  private lastEventId = 0
  private intervalId: ReturnType<typeof setInterval> | null = null
  private currentPresenceState: PresencePayload = {}

  constructor(private readonly name: string) {}

  on(
    type: Handler['type'],
    config: PostgresChangesConfig | BroadcastConfig | PresenceConfig,
    callback: ((payload: PostgresPayload | BroadcastPayload) => void) | (() => void)
  ): this {
    this.handlers.push({ type, config, callback } as Handler)
    return this
  }

  subscribe(callback?: (status: RealtimeStatus) => void | Promise<void>): this {
    this.intervalId ??= setInterval(() => {
      void this.poll()
    }, pollMs)

    void Promise.resolve(callback?.('SUBSCRIBED'))
    return this
  }

  async send(message: { type: 'broadcast'; event: string; payload: unknown }): Promise<'ok'> {
    await post('/broadcast', { channel: this.name, event: message.event, payload: message.payload })
    return 'ok'
  }

  async track(payload: Record<string, unknown>): Promise<'ok'> {
    const response = await post<{ state: PresencePayload }>('/presence/track', {
      channel: this.name,
      clientId: this.id,
      payload,
    })
    this.currentPresenceState = response.state
    this.emitPresenceSync()
    return 'ok'
  }

  presenceState(): PresencePayload {
    return this.currentPresenceState
  }

  async unsubscribe(): Promise<'ok'> {
    if (this.intervalId) clearInterval(this.intervalId)
    this.intervalId = null
    await post('/presence/untrack', { channel: this.name, clientId: this.id })
    return 'ok'
  }

  private async poll(): Promise<void> {
    const { events } = await get<{ events: FakeEvent[] }>(`/events?since=${this.lastEventId}`)
    for (const event of events) {
      this.lastEventId = Math.max(this.lastEventId, event.id)
      this.dispatch(event)
    }
  }

  private dispatch(event: FakeEvent): void {
    for (const handler of this.handlers) {
      if (event.type === 'postgres_changes' && handler.type === 'postgres_changes') {
        if (handler.config.table && handler.config.table !== event.table) continue
        const filter = parseEqFilter(handler.config.filter)
        if (filter && event.new[filter.column] !== filter.value) continue
        handler.callback({ new: event.new, old: event.old })
      }

      if (event.type === 'broadcast' && handler.type === 'broadcast') {
        if (event.channel !== this.name) continue
        if (handler.config.event && handler.config.event !== event.event) continue
        handler.callback({ event: event.event, payload: event.payload })
      }

      if (event.type === 'presence' && handler.type === 'presence') {
        if (event.channel !== this.name) continue
        this.currentPresenceState = event.state
        this.emitPresenceSync()
      }
    }
  }

  private emitPresenceSync(): void {
    for (const handler of this.handlers) {
      if (
        handler.type === 'presence' &&
        (!handler.config.event || handler.config.event === 'sync')
      ) {
        handler.callback()
      }
    }
  }
}

export function createFakeSupabaseClient() {
  return {
    from(table: string) {
      return new FakeQueryBuilder(table)
    },
    channel(name: string) {
      return new FakeRealtimeChannel(name)
    },
  }
}
