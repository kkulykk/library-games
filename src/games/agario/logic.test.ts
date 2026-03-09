import {
  clampToMap,
  distanceBetween,
  angleTo,
  normalizeAngle,
  turnToward,
  moveSnake,
  checkSnakeHeadVsBody,
  checkSnakeVsBorder,
  checkFoodCollisions,
  snakeToFood,
  generateFood,
  createSnakeState,
  createLobbyState,
  addPlayer,
  removePlayer,
  applyAction,
  getViewport,
  lerpViewport,
  assignColor,
  spawnPosition,
  compressSegments,
  MAP_WIDTH,
  MAP_HEIGHT,
  HEAD_RADIUS,
  START_LENGTH,
  MAX_PLAYERS,
  SEGMENT_SPACING,
  type SnakeState,
  type Food,
  type GameState,
  type LobbyPlayer,
  type Position,
} from './logic'

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeSnake(overrides: Partial<SnakeState> = {}): SnakeState {
  const segments: Position[] = []
  for (let i = 0; i < 30; i++) {
    segments.push({ x: 500 - i * SEGMENT_SPACING, y: 500 })
  }
  return {
    id: 'p1',
    name: 'Test',
    color: '#FF0000',
    segments,
    angle: 0,
    targetLength: 30,
    score: 0,
    alive: true,
    boosting: false,
    deathTime: null,
    foodEaten: 0,
    ...overrides,
  }
}

// ─── clampToMap ───────────────────────────────────────────────────────────────

describe('clampToMap', () => {
  it('clamps to min bounds', () => {
    const p = clampToMap(-10, -10)
    expect(p.x).toBe(HEAD_RADIUS)
    expect(p.y).toBe(HEAD_RADIUS)
  })

  it('clamps to max bounds', () => {
    const p = clampToMap(MAP_WIDTH + 100, MAP_HEIGHT + 100)
    expect(p.x).toBe(MAP_WIDTH - HEAD_RADIUS)
    expect(p.y).toBe(MAP_HEIGHT - HEAD_RADIUS)
  })

  it('does not change valid positions', () => {
    expect(clampToMap(500, 500)).toEqual({ x: 500, y: 500 })
  })
})

// ─── distanceBetween ──────────────────────────────────────────────────────────

describe('distanceBetween', () => {
  it('returns 0 for same point', () => {
    expect(distanceBetween({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0)
  })

  it('returns correct distance', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

// ─── angleTo ──────────────────────────────────────────────────────────────────

describe('angleTo', () => {
  it('returns 0 for east', () => {
    expect(angleTo({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0)
  })

  it('returns PI/2 for south', () => {
    expect(angleTo({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(Math.PI / 2)
  })
})

// ─── normalizeAngle ───────────────────────────────────────────────────────────

describe('normalizeAngle', () => {
  it('keeps angles in [-PI, PI]', () => {
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI)
    expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI)
  })

  it('does not change valid angles', () => {
    expect(normalizeAngle(1)).toBe(1)
  })
})

// ─── turnToward ───────────────────────────────────────────────────────────────

describe('turnToward', () => {
  it('turns toward target within maxTurn', () => {
    const result = turnToward(0, 0.5, 1)
    expect(result).toBeCloseTo(0.5)
  })

  it('limits turn to maxTurn', () => {
    const result = turnToward(0, Math.PI, 0.1)
    expect(result).toBeCloseTo(0.1)
  })

  it('handles wrapping around PI', () => {
    const result = turnToward(Math.PI - 0.1, -Math.PI + 0.1, 0.5)
    // Should turn the short way around
    expect(Math.abs(result)).toBeGreaterThan(Math.PI - 0.5)
  })
})

// ─── moveSnake ────────────────────────────────────────────────────────────────

describe('moveSnake', () => {
  it('moves head forward', () => {
    const snake = makeSnake({ angle: 0 })
    const moved = moveSnake(snake, 0, 0.016)
    expect(moved.segments[0].x).toBeGreaterThan(snake.segments[0].x)
  })

  it('does not move dead snakes', () => {
    const snake = makeSnake({ alive: false })
    const moved = moveSnake(snake, 0, 0.016)
    expect(moved).toBe(snake)
  })

  it('body follows head', () => {
    const snake = makeSnake()
    const moved = moveSnake(snake, 0, 0.016)
    for (let i = 1; i < moved.segments.length; i++) {
      const dist = distanceBetween(moved.segments[i - 1], moved.segments[i])
      expect(dist).toBeLessThanOrEqual(SEGMENT_SPACING + 1)
    }
  })

  it('grows when targetLength > segments', () => {
    const snake = makeSnake({ targetLength: 40 })
    const moved = moveSnake(snake, 0, 0.016)
    expect(moved.segments.length).toBe(40)
  })

  it('shrinks when targetLength < segments', () => {
    const snake = makeSnake({ targetLength: 20 })
    const moved = moveSnake(snake, 0, 0.016)
    expect(moved.segments.length).toBe(20)
  })

  it('drains length when boosting', () => {
    const snake = makeSnake({ boosting: true, targetLength: 50 })
    const moved = moveSnake(snake, 0, 0.5)
    expect(moved.targetLength).toBeLessThan(50)
  })
})

// ─── checkSnakeHeadVsBody ─────────────────────────────────────────────────────

describe('checkSnakeHeadVsBody', () => {
  it('detects collision when head overlaps body segment', () => {
    const other = makeSnake()
    // Place a head right on one of the other snake's body segments
    const target = other.segments[10]
    const head = { x: target.x, y: target.y }
    expect(checkSnakeHeadVsBody(head, other)).toBe(true)
  })

  it('no collision when far away', () => {
    const other = makeSnake()
    const head = { x: 2000, y: 2000 }
    expect(checkSnakeHeadVsBody(head, other)).toBe(false)
  })

  it('skips first N segments', () => {
    // Build a snake with well-separated segments so skip range matters
    const segments: Position[] = []
    for (let i = 0; i < 30; i++) {
      segments.push({ x: 100 + i * 50, y: 500 }) // 50px apart
    }
    const other = makeSnake({ segments })
    // Head at segment 2 (within skip range of 5), far from segments 5+
    const head = { x: segments[2].x, y: segments[2].y }
    expect(checkSnakeHeadVsBody(head, other, 5)).toBe(false)
  })

  it('no collision with dead snake', () => {
    const other = makeSnake({ alive: false })
    const head = { x: other.segments[10].x, y: other.segments[10].y }
    expect(checkSnakeHeadVsBody(head, other)).toBe(false)
  })
})

// ─── checkSnakeVsBorder ───────────────────────────────────────────────────────

describe('checkSnakeVsBorder', () => {
  it('detects collision at left edge', () => {
    expect(checkSnakeVsBorder({ x: HEAD_RADIUS, y: 500 })).toBe(true)
  })

  it('detects collision at bottom edge', () => {
    expect(checkSnakeVsBorder({ x: 500, y: MAP_HEIGHT - HEAD_RADIUS })).toBe(true)
  })

  it('no collision in the middle', () => {
    expect(checkSnakeVsBorder({ x: 500, y: 500 })).toBe(false)
  })
})

// ─── checkFoodCollisions ──────────────────────────────────────────────────────

describe('checkFoodCollisions', () => {
  const food: Food[] = [
    { id: 0, x: 500, y: 500, color: '#F00', size: 5 },
    { id: 1, x: 2000, y: 2000, color: '#0F0', size: 5 },
    { id: 2, x: 502, y: 500, color: '#00F', size: 5 },
  ]

  it('returns IDs of food near head', () => {
    const snake = makeSnake()
    const eaten = checkFoodCollisions(snake, food)
    expect(eaten).toContain(0)
    expect(eaten).toContain(2)
    expect(eaten).not.toContain(1)
  })

  it('returns empty if dead', () => {
    const snake = makeSnake({ alive: false })
    expect(checkFoodCollisions(snake, food)).toEqual([])
  })
})

// ─── snakeToFood ──────────────────────────────────────────────────────────────

describe('snakeToFood', () => {
  it('creates food from snake body', () => {
    const snake = makeSnake()
    const food = snakeToFood(snake, 1000)
    expect(food.length).toBeGreaterThan(0)
    expect(food.length).toBe(Math.ceil(snake.segments.length / 2))
  })

  it('uses snake color', () => {
    const snake = makeSnake({ color: '#FF0000' })
    const food = snakeToFood(snake, 0)
    expect(food[0].color).toBe('#FF0000')
  })

  it('assigns sequential IDs', () => {
    const snake = makeSnake()
    const food = snakeToFood(snake, 100)
    for (let i = 0; i < food.length; i++) {
      expect(food[i].id).toBe(100 + i)
    }
  })
})

// ─── generateFood ─────────────────────────────────────────────────────────────

describe('generateFood', () => {
  it('generates the requested count', () => {
    expect(generateFood(50, 0)).toHaveLength(50)
  })

  it('assigns sequential IDs', () => {
    const food = generateFood(5, 100)
    expect(food.map((f) => f.id)).toEqual([100, 101, 102, 103, 104])
  })

  it('places food within map bounds', () => {
    const food = generateFood(100, 0)
    for (const f of food) {
      expect(f.x).toBeGreaterThanOrEqual(0)
      expect(f.x).toBeLessThanOrEqual(MAP_WIDTH)
      expect(f.y).toBeGreaterThanOrEqual(0)
      expect(f.y).toBeLessThanOrEqual(MAP_HEIGHT)
    }
  })
})

// ─── createSnakeState ─────────────────────────────────────────────────────────

describe('createSnakeState', () => {
  it('creates a snake with starting length', () => {
    const s = createSnakeState('id1', 'Alice', '#FF0000')
    expect(s.id).toBe('id1')
    expect(s.segments.length).toBe(START_LENGTH)
    expect(s.alive).toBe(true)
    expect(s.targetLength).toBe(START_LENGTH)
  })

  it('segments are properly spaced', () => {
    const s = createSnakeState('id1', 'Test', '#000')
    for (let i = 1; i < s.segments.length; i++) {
      const dist = distanceBetween(s.segments[i - 1], s.segments[i])
      expect(dist).toBeCloseTo(SEGMENT_SPACING, 0)
    }
  })
})

// ─── spawnPosition ────────────────────────────────────────────────────────────

describe('spawnPosition', () => {
  it('returns position within inner portion of map', () => {
    for (let i = 0; i < 50; i++) {
      const pos = spawnPosition()
      expect(pos.x).toBeGreaterThanOrEqual(MAP_WIDTH * 0.15)
      expect(pos.x).toBeLessThanOrEqual(MAP_WIDTH * 0.85)
    }
  })
})

// ─── assignColor ──────────────────────────────────────────────────────────────

describe('assignColor', () => {
  it('returns a hex color', () => {
    expect(assignColor(0)).toMatch(/^#/)
  })

  it('wraps around', () => {
    expect(assignColor(0)).toBe(assignColor(10))
  })
})

// ─── compressSegments ─────────────────────────────────────────────────────────

describe('compressSegments', () => {
  it('returns original if under maxPoints', () => {
    const segs = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]
    expect(compressSegments(segs, 80)).toBe(segs)
  })

  it('downsamples long segment arrays', () => {
    const segs: Position[] = Array.from({ length: 200 }, (_, i) => ({ x: i, y: 0 }))
    const compressed = compressSegments(segs, 50)
    expect(compressed.length).toBe(50)
    expect(compressed[0]).toEqual(segs[0]) // head preserved
    expect(compressed[49]).toEqual(segs[199]) // tail preserved
  })
})

// ─── Lobby state ──────────────────────────────────────────────────────────────

describe('createLobbyState', () => {
  it('creates a lobby with host', () => {
    const host: LobbyPlayer = { id: 'h1', name: 'Host', isHost: true, color: '#FF0000' }
    const state = createLobbyState(host)
    expect(state.phase).toBe('lobby')
    expect(state.players).toHaveLength(1)
    expect(state.hostId).toBe('h1')
  })
})

describe('addPlayer', () => {
  const host: LobbyPlayer = { id: 'h1', name: 'Host', isHost: true, color: '#FF0000' }
  const baseState = createLobbyState(host)

  it('adds a new player', () => {
    const p: LobbyPlayer = { id: 'p2', name: 'P2', isHost: false, color: '#00FF00' }
    expect(addPlayer(baseState, p).players).toHaveLength(2)
  })

  it('does not add duplicate', () => {
    expect(addPlayer(baseState, host).players).toHaveLength(1)
  })

  it('blocks during playing phase', () => {
    const playing: GameState = { ...baseState, phase: 'playing' }
    const p: LobbyPlayer = { id: 'p2', name: 'P2', isHost: false, color: '#00FF00' }
    expect(addPlayer(playing, p)).toBe(playing)
  })

  it('does not exceed MAX_PLAYERS', () => {
    let state = baseState
    for (let i = 1; i < MAX_PLAYERS; i++) {
      state = addPlayer(state, { id: `p${i}`, name: `P${i}`, isHost: false, color: '#000' })
    }
    expect(state.players).toHaveLength(MAX_PLAYERS)
    expect(addPlayer(state, { id: 'extra', name: 'X', isHost: false, color: '#000' })).toBe(state)
  })
})

describe('removePlayer', () => {
  const host: LobbyPlayer = { id: 'h1', name: 'Host', isHost: true, color: '#FF0000' }
  const p2: LobbyPlayer = { id: 'p2', name: 'P2', isHost: false, color: '#00FF00' }

  it('removes a player', () => {
    const state = addPlayer(createLobbyState(host), p2)
    expect(removePlayer(state, 'p2').players).toHaveLength(1)
  })

  it('assigns new host if host leaves', () => {
    const state = addPlayer(createLobbyState(host), p2)
    const next = removePlayer(state, 'h1')
    expect(next.hostId).toBe('p2')
    expect(next.players[0].isHost).toBe(true)
  })

  it('returns same state if player not found', () => {
    const state = createLobbyState(host)
    expect(removePlayer(state, 'nope')).toBe(state)
  })
})

// ─── applyAction ──────────────────────────────────────────────────────────────

describe('applyAction', () => {
  const host: LobbyPlayer = { id: 'h1', name: 'Host', isHost: true, color: '#FF0000' }
  const p2: LobbyPlayer = { id: 'p2', name: 'P2', isHost: false, color: '#00FF00' }

  it('START_GAME works for host with 2+ players', () => {
    const state = addPlayer(createLobbyState(host), p2)
    expect(applyAction(state, { type: 'START_GAME', playerId: 'h1' }).phase).toBe('playing')
  })

  it('START_GAME blocked for non-host', () => {
    const state = addPlayer(createLobbyState(host), p2)
    expect(applyAction(state, { type: 'START_GAME', playerId: 'p2' })).toBe(state)
  })

  it('START_GAME needs 2+ players', () => {
    const state = createLobbyState(host)
    expect(applyAction(state, { type: 'START_GAME', playerId: 'h1' })).toBe(state)
  })

  it('PLAY_AGAIN works for host in finished', () => {
    const state: GameState = { ...addPlayer(createLobbyState(host), p2), phase: 'finished' }
    expect(applyAction(state, { type: 'PLAY_AGAIN', playerId: 'h1' }).phase).toBe('lobby')
  })

  it('PLAY_AGAIN blocked for non-host', () => {
    const state: GameState = { ...addPlayer(createLobbyState(host), p2), phase: 'finished' }
    expect(applyAction(state, { type: 'PLAY_AGAIN', playerId: 'p2' })).toBe(state)
  })
})

// ─── getViewport ──────────────────────────────────────────────────────────────

describe('getViewport', () => {
  it('centers on the snake head', () => {
    const vp = getViewport(2500, 2500, START_LENGTH, 800, 600)
    expect(vp.scale).toBeGreaterThan(0)
    expect(vp.x).toBeLessThan(2500)
    expect(vp.y).toBeLessThan(2500)
  })

  it('zooms out for longer snakes', () => {
    const small = getViewport(2500, 2500, 30, 800, 600)
    const big = getViewport(2500, 2500, 300, 800, 600)
    expect(big.scale).toBeLessThan(small.scale)
  })

  it('has a minimum scale', () => {
    const vp = getViewport(2500, 2500, 100000, 800, 600)
    expect(vp.scale).toBeGreaterThanOrEqual(0.4)
  })
})

// ─── lerpViewport ─────────────────────────────────────────────────────────────

describe('lerpViewport', () => {
  it('interpolates between viewports', () => {
    const a = { x: 0, y: 0, scale: 1 }
    const b = { x: 100, y: 100, scale: 0.5 }
    const mid = lerpViewport(a, b, 0.5)
    expect(mid.x).toBeCloseTo(50)
    expect(mid.y).toBeCloseTo(50)
    expect(mid.scale).toBeCloseTo(0.75)
  })

  it('returns start at t=0', () => {
    const a = { x: 10, y: 20, scale: 1 }
    const b = { x: 100, y: 200, scale: 0.5 }
    const result = lerpViewport(a, b, 0)
    expect(result.x).toBe(10)
    expect(result.y).toBe(20)
  })
})
