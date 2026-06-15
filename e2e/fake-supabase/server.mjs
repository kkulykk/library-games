import http from 'node:http'

const host = process.env.E2E_FAKE_SUPABASE_HOST ?? '127.0.0.1'
const port = Number(process.env.E2E_FAKE_SUPABASE_PORT ?? '54321')

let state = createState()

function createState() {
  return {
    tables: new Map(),
    events: [],
    nextEventId: 1,
    presence: new Map(),
  }
}

function reset() {
  state = createState()
}

function tableRows(table) {
  let rows = state.tables.get(table)
  if (!rows) {
    rows = []
    state.tables.set(table, rows)
  }
  return rows
}

function emit(event) {
  state.events.push({ id: state.nextEventId++, ...event })
  if (state.events.length > 1000) state.events.splice(0, state.events.length - 1000)
}

function selectedRow(row, columns) {
  if (!columns || columns === '*') return { ...row }
  const names = columns
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean)

  return Object.fromEntries(names.map((name) => [name, row[name]]))
}

function matches(row, filters) {
  return filters.every(({ column, value }) => row[column] === value)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      if (!data) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(data))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'content-type': 'application/json',
  })
  res.end(JSON.stringify(body))
}

function presenceState(channel) {
  const members = state.presence.get(channel) ?? new Map()
  const grouped = {}

  for (const [clientId, payload] of members.entries()) {
    grouped[clientId] = [{ ...payload }]
  }

  return grouped
}

async function handleQuery(req, res) {
  const body = await readBody(req)
  const { op, table, values, filters = [], columns } = body
  const rows = tableRows(table)

  if (op === 'insert') {
    const inputRows = Array.isArray(values) ? values : [values]
    for (const value of inputRows) {
      if (value.code != null && rows.some((r) => r.code === value.code)) {
        sendJson(res, 200, {
          data: null,
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint',
            details: `Key (code)=(${value.code}) already exists.`,
            hint: null,
          },
        })
        return
      }
    }
    const inserted = inputRows.map((value) => ({ version: 1, ...value }))
    rows.push(...inserted)
    sendJson(res, 200, { data: inserted.map((row) => selectedRow(row, columns)), error: null })
    return
  }

  if (op === 'select') {
    const found = rows
      .filter((row) => matches(row, filters))
      .map((row) => selectedRow(row, columns))
    if (body.single) {
      sendJson(res, 200, {
        data: found[0] ?? null,
        error: found[0] ? null : { message: 'No rows found' },
      })
      return
    }

    sendJson(res, 200, { data: found, error: null })
    return
  }

  if (op === 'update') {
    const updated = []
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]
      if (!matches(row, filters)) continue

      const next = { ...row, ...values }
      rows[index] = next
      updated.push(next)
      emit({ type: 'postgres_changes', table, old: row, new: next })
      // Mirror the real `after update` trigger (plan 02-01): EVERY row UPDATE on a
      // room table fires broadcast_room_state(), which sends {state,version} on
      // room:CODE / event=state. The hook is now broadcast-only for state sync, so a
      // direct table UPDATE (e.g. an E2E state seed) must broadcast too — otherwise
      // already-subscribed peers never observe the change. Gate on a room-shaped row.
      if (next.code != null && next.state !== undefined && next.version !== undefined) {
        emit({
          type: 'broadcast',
          channel: 'room:' + next.code,
          event: 'state',
          payload: { state: next.state, version: next.version },
        })
      }
    }

    sendJson(res, 200, { data: updated.map((row) => selectedRow(row, columns)), error: null })
    return
  }

  sendJson(res, 400, { data: null, error: { message: `Unsupported op: ${op}` } })
}

// Crockford 6-char room-code regex, mirroring ROOM_CODE_REGEX_SQL in
// src/lib/room-code.ts (this file lives outside src/, no @ import).
const ROOM_CODE_RE = /^[0-9A-HJKMNP-TV-Z]{6}$/

// Server-side name predicate mirroring the DB is_valid_player_name(text):
// trim → require 1..20 code points → reject control / zero-width / bidi.
function isValidPlayerName(name) {
  if (typeof name !== 'string') return false
  const trimmed = name.trim()
  const len = [...trimmed].length
  if (len < 1 || len > 20) return false
  for (const ch of trimmed) {
    const cp = ch.codePointAt(0)
    // Cc control chars
    if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)) return false
    // Cf / Zl / Zp / zero-width / bidi / BOM
    if (
      cp === 0x200b ||
      cp === 0x200c ||
      cp === 0x200d ||
      cp === 0x200e ||
      cp === 0x200f ||
      cp === 0x2028 ||
      cp === 0x2029 ||
      (cp >= 0x202a && cp <= 0x202e) ||
      (cp >= 0x2066 && cp <= 0x2069) ||
      cp === 0xfeff
    ) {
      return false
    }
  }
  return true
}

function rpcError(res, code, message) {
  sendJson(res, 200, { data: null, error: { code, message } })
}

// Derive the room table from the RPC name suffix: `<op>_<game>` → `<game>_rooms`.
function tableForFn(fn) {
  const match = /^(create|join|restore|dispatch)_(.+)$/.exec(fn)
  if (!match) return null
  return { op: match[1], table: `${match[2]}_rooms` }
}

function statePlayerNames(stateValue) {
  const players = stateValue?.players
  if (!Array.isArray(players)) return []
  return players.map((p) => p?.name)
}

// Mirrors the DB SECURITY DEFINER RPCs from plan 02-01: create/join/restore/dispatch.
// Return shapes match `returns table(...)` (array `data`) and stable errcodes
// 22023 (bad code/name), 42501 (token/membership), 40001 (CAS conflict).
async function handleRpc(req, res) {
  const body = await readBody(req)
  const { fn, args = {} } = body
  const parsed = tableForFn(fn)
  if (!parsed) {
    rpcError(res, '42883', `unknown rpc: ${fn}`)
    return
  }
  const { op, table } = parsed
  const rows = tableRows(table)

  if (op === 'create') {
    const code = args.p_code
    if (typeof code !== 'string' || !ROOM_CODE_RE.test(code)) {
      rpcError(res, '22023', 'invalid code')
      return
    }
    for (const name of statePlayerNames(args.p_state)) {
      if (!isValidPlayerName(name)) {
        rpcError(res, '22023', 'invalid name')
        return
      }
    }
    if (rows.some((r) => r.code === code)) {
      sendJson(res, 200, {
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint',
          details: `Key (code)=(${code}) already exists.`,
          hint: null,
        },
      })
      return
    }
    const room_token = crypto.randomUUID()
    const row = { code, state: args.p_state, version: 1, room_token }
    rows.push(row)
    sendJson(res, 200, {
      data: [{ state: row.state, version: 1, room_token }],
      error: null,
    })
    return
  }

  if (op === 'join') {
    const code = args.p_code
    if (typeof code !== 'string' || !ROOM_CODE_RE.test(code)) {
      rpcError(res, '22023', 'invalid code')
      return
    }
    for (const name of statePlayerNames(args.p_new_state)) {
      if (!isValidPlayerName(name)) {
        rpcError(res, '22023', 'invalid name')
        return
      }
    }
    const row = rows.find((r) => r.code === code)
    if (!row) {
      rpcError(res, '42501', 'unauthorized')
      return
    }
    // Version (CAS) conflict is checked BEFORE the invariant so a concurrent join that
    // lost the race reports 40001 (retryable conflict), not a spurious 42501.
    if (row.version !== args.p_expected_version) {
      rpcError(res, '40001', 'conflict')
      return
    }
    // CR-02: mirror the DB join invariant — join is only valid in lobby and must add
    // exactly one player without dropping an existing member. Without this, join is a
    // token-less full-state overwrite primitive.
    const oldPlayers = Array.isArray(row.state?.players) ? row.state.players : []
    const newPlayers = Array.isArray(args.p_new_state?.players) ? args.p_new_state.players : []
    const oldIds = new Set(oldPlayers.map((p) => p?.id))
    const preservesRoster = [...oldIds].every((id) => newPlayers.some((p) => p?.id === id))
    if (
      row.state?.phase !== 'lobby' ||
      newPlayers.length !== oldPlayers.length + 1 ||
      !preservesRoster
    ) {
      rpcError(res, '42501', 'unauthorized')
      return
    }
    row.state = args.p_new_state
    row.version = row.version + 1
    // Mirror the real `after update` broadcast trigger (plan 02-01): a join is a
    // row UPDATE, so it must broadcast the new state on room:CODE the same way
    // dispatch does — otherwise already-subscribed peers never see the new player.
    emit({
      type: 'broadcast',
      channel: 'room:' + code,
      event: 'state',
      payload: { state: row.state, version: row.version },
    })
    sendJson(res, 200, {
      data: [{ state: row.state, version: row.version, room_token: row.room_token }],
      error: null,
    })
    return
  }

  if (op === 'restore') {
    const code = args.p_code
    if (typeof code !== 'string' || !ROOM_CODE_RE.test(code)) {
      rpcError(res, '22023', 'invalid code')
      return
    }
    const row = rows.find((r) => r.code === code)
    if (!row) {
      rpcError(res, '42501', 'unauthorized')
      return
    }
    const ids = Array.isArray(row.state?.players) ? row.state.players.map((p) => p?.id) : []
    if (!ids.includes(args.p_player_id)) {
      rpcError(res, '42501', 'unauthorized')
      return
    }
    sendJson(res, 200, {
      data: [{ state: row.state, version: row.version, room_token: row.room_token }],
      error: null,
    })
    return
  }

  if (op === 'dispatch') {
    const code = args.p_code
    if (typeof code !== 'string' || !ROOM_CODE_RE.test(code)) {
      rpcError(res, '22023', 'invalid code')
      return
    }
    const row = rows.find((r) => r.code === code)
    if (!row || row.room_token !== args.p_room_token) {
      rpcError(res, '42501', 'unauthorized')
      return
    }
    if (row.version !== args.p_expected_version) {
      rpcError(res, '40001', 'conflict')
      return
    }
    // CR-04: mirror the DB dispatch_<game> server-side name validation — INPUT-01
    // is enforced on the steady-state write path too, not only create/join.
    for (const name of statePlayerNames(args.p_new_state)) {
      if (!isValidPlayerName(name)) {
        rpcError(res, '22023', 'invalid name')
        return
      }
    }
    row.state = args.p_new_state
    row.version = row.version + 1
    emit({
      type: 'broadcast',
      channel: 'room:' + code,
      event: 'state',
      payload: { state: row.state, version: row.version },
    })
    sendJson(res, 200, {
      data: [{ state: row.state, version: row.version }],
      error: null,
    })
    return
  }

  rpcError(res, '42883', `unsupported op: ${op}`)
}

async function handleEvents(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const since = Number(url.searchParams.get('since') ?? '0')
  sendJson(res, 200, { events: state.events.filter((event) => event.id > since) })
}

async function handleBroadcast(req, res) {
  const body = await readBody(req)
  emit({ type: 'broadcast', channel: body.channel, event: body.event, payload: body.payload })
  sendJson(res, 200, { ok: true })
}

async function handleTrack(req, res) {
  const body = await readBody(req)
  let members = state.presence.get(body.channel)
  if (!members) {
    members = new Map()
    state.presence.set(body.channel, members)
  }
  members.set(body.clientId, body.payload ?? {})
  emit({ type: 'presence', channel: body.channel, state: presenceState(body.channel) })
  sendJson(res, 200, { ok: true, state: presenceState(body.channel) })
}

async function handleUntrack(req, res) {
  const body = await readBody(req)
  const members = state.presence.get(body.channel)
  if (members) {
    members.delete(body.clientId)
    emit({ type: 'presence', channel: body.channel, state: presenceState(body.channel) })
  }
  sendJson(res, 200, { ok: true })
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {})
      return
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'POST' && url.pathname === '/reset') {
      reset()
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'POST' && url.pathname === '/query') {
      await handleQuery(req, res)
      return
    }

    if (req.method === 'POST' && url.pathname === '/rpc') {
      await handleRpc(req, res)
      return
    }

    if (req.method === 'GET' && url.pathname === '/events') {
      await handleEvents(req, res)
      return
    }

    if (req.method === 'POST' && url.pathname === '/broadcast') {
      await handleBroadcast(req, res)
      return
    }

    if (req.method === 'POST' && url.pathname === '/presence/track') {
      await handleTrack(req, res)
      return
    }

    if (req.method === 'POST' && url.pathname === '/presence/untrack') {
      await handleUntrack(req, res)
      return
    }

    sendJson(res, 404, { error: { message: 'Not found' } })
  } catch (error) {
    console.error('Fake Supabase request failed', error)
    sendJson(res, 500, {
      error: { message: 'Internal fake Supabase server error' },
    })
  }
})

server.listen(port, host, () => {
  console.log(`Fake Supabase server listening on http://${host}:${port}`)
})

process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())
