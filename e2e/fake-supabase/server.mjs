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
    }

    sendJson(res, 200, { data: updated.map((row) => selectedRow(row, columns)), error: null })
    return
  }

  sendJson(res, 400, { data: null, error: { message: `Unsupported op: ${op}` } })
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
