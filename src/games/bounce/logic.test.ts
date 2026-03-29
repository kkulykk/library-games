import {
  createInitialState,
  stepGame,
  advanceLevel,
  parseLevel,
  isSolid,
  getTile,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TILE_SIZE,
  BALL_RADIUS,
  BOUNCE_VY,
  BIG_BOUNCE_VY,
  SPRING_VY,
  MOVE_SPEED,
  RING_SCORE,
  INITIAL_LIVES,
  TOTAL_LEVELS,
  T_EMPTY,
  T_BRICK,
  T_BRICK2,
  T_SPIKE,
  T_SPRING,
  T_FINISH,
  LEVEL_BONUS,
  GameState,
  Input,
} from './logic'

describe('parseLevel', () => {
  it('parses level 0 without errors', () => {
    const parsed = parseLevel(0)
    expect(parsed.width).toBeGreaterThan(0)
    expect(parsed.height).toBeGreaterThan(0)
    expect(parsed.tiles.length).toBe(parsed.height)
    expect(parsed.tiles[0].length).toBe(parsed.width)
  })

  it('finds start and finish positions', () => {
    const parsed = parseLevel(0)
    expect(parsed.startCol).toBeGreaterThanOrEqual(0)
    expect(parsed.startRow).toBeGreaterThanOrEqual(0)
    expect(parsed.finishCol).toBeGreaterThanOrEqual(0)
    expect(parsed.finishRow).toBeGreaterThanOrEqual(0)
  })

  it('extracts rings from the level', () => {
    const parsed = parseLevel(0)
    expect(parsed.rings.length).toBeGreaterThan(0)
    for (const ring of parsed.rings) {
      expect(ring.collected).toBe(false)
      expect(ring.col).toBeGreaterThanOrEqual(0)
      expect(ring.row).toBeGreaterThanOrEqual(0)
    }
  })

  it('clamps to last level if index out of bounds', () => {
    const parsed = parseLevel(999)
    expect(parsed.width).toBeGreaterThan(0)
  })
})

describe('isSolid', () => {
  it('returns true for brick types', () => {
    expect(isSolid(T_BRICK)).toBe(true)
    expect(isSolid(T_BRICK2)).toBe(true)
    expect(isSolid(T_SPRING)).toBe(true)
  })

  it('returns false for non-solid types', () => {
    expect(isSolid(T_EMPTY)).toBe(false)
    expect(isSolid(T_SPIKE)).toBe(false)
    expect(isSolid(T_FINISH)).toBe(false)
  })
})

describe('getTile', () => {
  it('returns the tile at the given position', () => {
    const tiles = [
      [T_BRICK, T_EMPTY],
      [T_SPIKE, T_SPRING],
    ]
    expect(getTile(tiles, 0, 0, 2, 2)).toBe(T_BRICK)
    expect(getTile(tiles, 1, 0, 2, 2)).toBe(T_EMPTY)
    expect(getTile(tiles, 0, 1, 2, 2)).toBe(T_SPIKE)
    expect(getTile(tiles, 1, 1, 2, 2)).toBe(T_SPRING)
  })

  it('returns T_BRICK for out-of-bounds positions', () => {
    const tiles = [[T_EMPTY]]
    expect(getTile(tiles, -1, 0, 1, 1)).toBe(T_BRICK)
    expect(getTile(tiles, 0, -1, 1, 1)).toBe(T_BRICK)
    expect(getTile(tiles, 1, 0, 1, 1)).toBe(T_BRICK)
    expect(getTile(tiles, 0, 1, 1, 1)).toBe(T_BRICK)
  })
})

describe('createInitialState', () => {
  it('creates a valid initial state', () => {
    const state = createInitialState()
    expect(state.level).toBe(0)
    expect(state.lives).toBe(INITIAL_LIVES)
    expect(state.score).toBe(0)
    expect(state.gameOver).toBe(false)
    expect(state.levelComplete).toBe(false)
    expect(state.won).toBe(false)
    expect(state.deathTimer).toBe(0)
  })

  it('places ball at start position', () => {
    const state = createInitialState()
    expect(state.ball.x).toBe(state.startX)
    expect(state.ball.y).toBe(state.startY)
    expect(state.ball.vx).toBe(0)
    expect(state.ball.vy).toBe(0)
  })

  it('accepts custom level, score, and lives', () => {
    const state = createInitialState(2, 500, 5)
    expect(state.level).toBe(2)
    expect(state.score).toBe(500)
    expect(state.lives).toBe(5)
  })

  it('has rings in the state', () => {
    const state = createInitialState()
    expect(state.rings.length).toBeGreaterThan(0)
  })
})

describe('stepGame', () => {
  const noInput: Input = { left: false, right: false, jump: false }

  it('returns same reference when gameOver', () => {
    const state = { ...createInitialState(), gameOver: true }
    expect(stepGame(state, noInput)).toBe(state)
  })

  it('returns same reference when levelComplete', () => {
    const state = { ...createInitialState(), levelComplete: true }
    expect(stepGame(state, noInput)).toBe(state)
  })

  it('returns same reference when won', () => {
    const state = { ...createInitialState(), won: true }
    expect(stepGame(state, noInput)).toBe(state)
  })

  it('applies gravity', () => {
    const state = createInitialState()
    // Place ball in open space so it falls
    const modified: GameState = {
      ...state,
      ball: { x: state.startX, y: TILE_SIZE * 2, vx: 0, vy: 0 },
    }
    const next = stepGame(modified, noInput)
    expect(next.ball.vy).toBeGreaterThan(0)
  })

  it('moves ball left when left is pressed', () => {
    const state = createInitialState()
    const modified: GameState = {
      ...state,
      ball: { x: state.startX, y: TILE_SIZE * 2, vx: 0, vy: 0 },
    }
    const next = stepGame(modified, { left: true, right: false, jump: false })
    expect(next.ball.x).toBeLessThan(modified.ball.x)
  })

  it('moves ball right when right is pressed', () => {
    const state = createInitialState()
    const modified: GameState = {
      ...state,
      ball: { x: state.startX, y: TILE_SIZE * 2, vx: 0, vy: 0 },
    }
    const next = stepGame(modified, { left: false, right: true, jump: false })
    expect(next.ball.x).toBeGreaterThan(modified.ball.x)
  })

  it('decelerates when no input', () => {
    const state = createInitialState()
    const modified: GameState = {
      ...state,
      ball: { x: state.startX, y: TILE_SIZE * 2, vx: 5, vy: 0 },
    }
    const next = stepGame(modified, noInput)
    expect(Math.abs(next.ball.vx)).toBeLessThan(5)
  })

  it('bounces ball when landing on a brick platform', () => {
    const state = createInitialState()
    // Find a position where the ball will land on a brick
    // Place ball just above a known brick tile (bottom row is all bricks)
    const brickRow = state.levelHeight - 1
    const brickY = brickRow * TILE_SIZE
    const modified: GameState = {
      ...state,
      ball: { x: TILE_SIZE * 3 + TILE_SIZE / 2, y: brickY - BALL_RADIUS - 5, vx: 0, vy: 8 },
    }
    const next = stepGame(modified, noInput)
    expect(next.ball.vy).toBeLessThan(0) // bounced upward
    expect(next.justBounced).toBe(true)
  })

  it('gives bigger bounce when jump is pressed', () => {
    const state = createInitialState()
    const brickRow = state.levelHeight - 1
    const brickY = brickRow * TILE_SIZE
    const modified: GameState = {
      ...state,
      ball: { x: TILE_SIZE * 3 + TILE_SIZE / 2, y: brickY - BALL_RADIUS - 5, vx: 0, vy: 8 },
    }
    const next = stepGame(modified, { left: false, right: false, jump: true })
    expect(next.ball.vy).toBe(BIG_BOUNCE_VY)
  })

  it('gives spring bounce when landing on spring', () => {
    // Create a custom state with a spring tile
    const state = createInitialState()
    const tiles = state.tiles.map((row) => [...row])
    // Place a spring in an empty area
    const springCol = 5
    const springRow = state.levelHeight - 2
    if (tiles[springRow]) tiles[springRow][springCol] = T_SPRING
    const springY = springRow * TILE_SIZE
    const modified: GameState = {
      ...state,
      tiles,
      ball: {
        x: springCol * TILE_SIZE + TILE_SIZE / 2,
        y: springY - BALL_RADIUS - 5,
        vx: 0,
        vy: 8,
      },
    }
    const next = stepGame(modified, noInput)
    expect(next.ball.vy).toBe(SPRING_VY)
  })

  it('triggers death when touching a spike', () => {
    const state = createInitialState()
    const tiles = state.tiles.map((row) => [...row])
    // Place a spike in an empty area
    const spikeCol = 5
    const spikeRow = 5
    if (tiles[spikeRow]) tiles[spikeRow][spikeCol] = T_SPIKE
    const modified: GameState = {
      ...state,
      tiles,
      ball: {
        x: spikeCol * TILE_SIZE + TILE_SIZE / 2,
        y: spikeRow * TILE_SIZE + TILE_SIZE / 2,
        vx: 0,
        vy: 0,
      },
    }
    const next = stepGame(modified, noInput)
    expect(next.deathTimer).toBeGreaterThan(0)
  })

  it('collects rings when ball overlaps them', () => {
    const state = createInitialState()
    if (state.rings.length === 0) return // skip if no rings
    const ring = state.rings[0]
    const rx = ring.col * TILE_SIZE + TILE_SIZE / 2
    const ry = ring.row * TILE_SIZE + TILE_SIZE / 2
    const modified: GameState = {
      ...state,
      ball: { x: rx, y: ry, vx: 0, vy: 1 },
    }
    const next = stepGame(modified, noInput)
    const collectedRing = next.rings.find((r) => r.col === ring.col && r.row === ring.row)
    expect(collectedRing?.collected).toBe(true)
    expect(next.score).toBeGreaterThanOrEqual(RING_SCORE)
  })

  it('decrements deathTimer each frame', () => {
    const state: GameState = { ...createInitialState(), deathTimer: 15 }
    const next = stepGame(state, noInput)
    expect(next.deathTimer).toBe(14)
  })

  it('loses a life when deathTimer reaches 0', () => {
    const state: GameState = { ...createInitialState(), deathTimer: 1, lives: 3 }
    const next = stepGame(state, noInput)
    expect(next.lives).toBe(2)
    expect(next.deathTimer).toBe(0)
  })

  it('triggers gameOver when last life is lost', () => {
    const state: GameState = { ...createInitialState(), deathTimer: 1, lives: 1 }
    const next = stepGame(state, noInput)
    expect(next.gameOver).toBe(true)
    expect(next.lives).toBe(0)
  })

  it('sets levelComplete when ball reaches finish on non-final level', () => {
    const state = createInitialState(0)
    const modified: GameState = {
      ...state,
      ball: { x: state.finishX, y: state.finishY, vx: 0, vy: 1 },
    }
    const next = stepGame(modified, noInput)
    expect(next.levelComplete).toBe(true)
    expect(next.score).toBe(state.score + LEVEL_BONUS)
  })

  it('sets won when ball reaches finish on final level', () => {
    const state = createInitialState(TOTAL_LEVELS - 1)
    const modified: GameState = {
      ...state,
      ball: { x: state.finishX, y: state.finishY, vx: 0, vy: 1 },
    }
    const next = stepGame(modified, noInput)
    expect(next.won).toBe(true)
    expect(next.score).toBe(state.score + LEVEL_BONUS)
  })

  it('pushes ball out of solid tile when vx is zero', () => {
    const state = createInitialState()
    const tiles = state.tiles.map((row) => [...row])
    // Place a brick where the ball is
    const brickCol = 5
    const brickRow = 5
    if (tiles[brickRow]) tiles[brickRow][brickCol] = T_BRICK
    const tileCenter = brickCol * TILE_SIZE + TILE_SIZE / 2
    // Ball slightly left of tile center, stationary
    const modified: GameState = {
      ...state,
      tiles,
      ball: {
        x: tileCenter - 2,
        y: brickRow * TILE_SIZE + TILE_SIZE / 2,
        vx: 0,
        vy: 0,
      },
    }
    const next = stepGame(modified, noInput)
    // Ball should be pushed out to the left of the tile
    expect(next.ball.x).toBeLessThan(brickCol * TILE_SIZE)
  })

  it('updates camera position', () => {
    const state = createInitialState()
    // Move ball far right to trigger camera movement
    const modified: GameState = {
      ...state,
      ball: { x: CANVAS_WIDTH * 2, y: state.ball.y, vx: 0, vy: 1 },
    }
    const next = stepGame(modified, noInput)
    expect(next.cameraX).toBeGreaterThan(0)
  })
})

describe('advanceLevel', () => {
  it('increments the level', () => {
    const state = { ...createInitialState(), score: 600 }
    const next = advanceLevel(state)
    expect(next.level).toBe(1)
  })

  it('preserves score and lives', () => {
    const state = createInitialState(0, 1200, 2)
    const next = advanceLevel(state)
    expect(next.score).toBe(1200)
    expect(next.lives).toBe(2)
  })

  it('resets ball to new level start position', () => {
    const next = advanceLevel(createInitialState())
    expect(next.ball.x).toBe(next.startX)
    expect(next.ball.y).toBe(next.startY)
    expect(next.ball.vx).toBe(0)
    expect(next.ball.vy).toBe(0)
  })
})

describe('constants', () => {
  it('has valid canvas dimensions', () => {
    expect(CANVAS_WIDTH).toBeGreaterThan(0)
    expect(CANVAS_HEIGHT).toBeGreaterThan(0)
  })

  it('has valid physics constants', () => {
    expect(BOUNCE_VY).toBeLessThan(0) // upward
    expect(BIG_BOUNCE_VY).toBeLessThan(BOUNCE_VY) // stronger
    expect(SPRING_VY).toBeLessThan(BIG_BOUNCE_VY) // strongest
    expect(MOVE_SPEED).toBeGreaterThan(0)
    expect(BALL_RADIUS).toBeGreaterThan(0)
    expect(TILE_SIZE).toBeGreaterThan(0)
  })

  it('has multiple levels', () => {
    expect(TOTAL_LEVELS).toBeGreaterThanOrEqual(3)
  })

  it('starts with multiple lives', () => {
    expect(INITIAL_LIVES).toBeGreaterThanOrEqual(2)
  })
})
