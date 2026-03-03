import {
  createInitialState,
  stepGame,
  totalScore,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BALL_RADIUS,
  BOUNCE_VY,
  H_SPEED,
  GRAVITY,
  STAR_SCORE,
  GameState,
} from './logic'

describe('createInitialState', () => {
  it('creates a valid initial state', () => {
    const state = createInitialState()
    expect(state.ball.x).toBe(CANVAS_WIDTH / 2)
    expect(state.ball.y).toBeLessThan(CANVAS_HEIGHT)
    expect(state.platforms.length).toBeGreaterThan(0)
    expect(state.gameOver).toBe(false)
    expect(state.heightScore).toBe(0)
    expect(state.starScore).toBe(0)
  })

  it('accepts an initial highScore', () => {
    const state = createInitialState(250)
    expect(state.highScore).toBe(250)
  })

  it('starts with a wide platform below the ball', () => {
    const state = createInitialState()
    const startPlat = state.platforms[0]
    expect(startPlat.w).toBe(140)
    expect(startPlat.type).toBe('normal')
    // Ball should be above this platform
    expect(state.ball.y + BALL_RADIUS).toBeLessThan(startPlat.y + 1)
  })
})

describe('totalScore', () => {
  it('returns the sum of heightScore and starScore', () => {
    const state = { ...createInitialState(), heightScore: 40, starScore: 20 }
    expect(totalScore(state)).toBe(60)
  })

  it('returns 0 for a fresh state', () => {
    expect(totalScore(createInitialState())).toBe(0)
  })
})

describe('stepGame', () => {
  it('returns the same reference when already gameOver', () => {
    const state = { ...createInitialState(), gameOver: true }
    const next = stepGame(state, { left: false, right: false })
    expect(next).toBe(state)
  })

  it('applies gravity (increases vy)', () => {
    const state = createInitialState()
    const initialVy = state.ball.vy
    const next = stepGame(state, { left: false, right: false })
    expect(next.ball.vy).toBeGreaterThan(initialVy + GRAVITY - 0.01)
  })

  it('sets vx to -H_SPEED when left is pressed', () => {
    const state = createInitialState()
    const next = stepGame(state, { left: true, right: false })
    expect(next.ball.vx).toBe(-H_SPEED)
  })

  it('sets vx to H_SPEED when right is pressed', () => {
    const state = createInitialState()
    const next = stepGame(state, { left: false, right: true })
    expect(next.ball.vx).toBe(H_SPEED)
  })

  it('decelerates vx when no input', () => {
    const state = { ...createInitialState(), ball: { ...createInitialState().ball, vx: 5 } }
    const next = stepGame(state, { left: false, right: false })
    expect(Math.abs(next.ball.vx)).toBeLessThan(5)
  })

  it('wraps ball from left edge to right', () => {
    const base = createInitialState()
    const state: GameState = {
      ...base,
      ball: { ...base.ball, x: -BALL_RADIUS - 1, vx: -5, vy: 5 },
      platforms: [],
    }
    const next = stepGame(state, { left: false, right: false })
    expect(next.ball.x).toBeGreaterThan(CANVAS_WIDTH / 2)
  })

  it('wraps ball from right edge to left', () => {
    const base = createInitialState()
    const state: GameState = {
      ...base,
      ball: { ...base.ball, x: CANVAS_WIDTH + BALL_RADIUS + 1, vx: 5, vy: 5 },
      platforms: [],
    }
    const next = stepGame(state, { left: false, right: false })
    expect(next.ball.x).toBeLessThan(CANVAS_WIDTH / 2)
  })

  it('bounces ball when it lands on a normal platform', () => {
    const base = createInitialState()
    const platY = 300
    const state: GameState = {
      ...base,
      ball: { x: 100, y: platY - BALL_RADIUS - 8, vx: 0, vy: 10 },
      platforms: [{ id: 99, x: 50, y: platY, w: 100, type: 'normal', vx: 0, bounceCount: 0 }],
      cameraY: 0,
    }
    const next = stepGame(state, { left: false, right: false })
    expect(next.ball.vy).toBe(BOUNCE_VY)
    expect(next.ball.y).toBe(platY - BALL_RADIUS)
  })

  it('does not bounce when ball is moving upward', () => {
    const base = createInitialState()
    const platY = 300
    const state: GameState = {
      ...base,
      ball: { x: 100, y: platY - BALL_RADIUS + 2, vx: 0, vy: -8 },
      platforms: [{ id: 99, x: 50, y: platY, w: 100, type: 'normal', vx: 0, bounceCount: 0 }],
      cameraY: 0,
    }
    const next = stepGame(state, { left: false, right: false })
    expect(next.ball.vy).not.toBe(BOUNCE_VY)
  })

  it('removes a breaking platform after one bounce', () => {
    const base = createInitialState()
    const platY = 300
    const state: GameState = {
      ...base,
      ball: { x: 100, y: platY - BALL_RADIUS - 8, vx: 0, vy: 10 },
      platforms: [{ id: 99, x: 50, y: platY, w: 100, type: 'breaking', vx: 0, bounceCount: 0 }],
      cameraY: 0,
    }
    const next = stepGame(state, { left: false, right: false })
    expect(next.platforms.find((p) => p.id === 99)).toBeUndefined()
  })

  it('collects a star when ball overlaps it', () => {
    const base = createInitialState()
    const state: GameState = {
      ...base,
      ball: { x: 100, y: 200, vx: 0, vy: 1 },
      stars: [{ id: 0, x: 100, y: 200, collected: false }],
      platforms: [],
      cameraY: 0,
    }
    const next = stepGame(state, { left: false, right: false })
    expect(next.starScore).toBe(STAR_SCORE)
    // Collected stars are filtered out
    expect(next.stars.find((s) => s.id === 0)).toBeUndefined()
  })

  it('does not collect an already-collected star twice', () => {
    const base = createInitialState()
    const state: GameState = {
      ...base,
      ball: { x: 100, y: 200, vx: 0, vy: 1 },
      stars: [{ id: 0, x: 100, y: 200, collected: true }],
      starScore: STAR_SCORE,
      platforms: [],
      cameraY: 0,
    }
    const next = stepGame(state, { left: false, right: false })
    expect(next.starScore).toBe(STAR_SCORE) // no double-counting
  })

  it('triggers game over when ball falls below the screen', () => {
    const base = createInitialState()
    const state: GameState = {
      ...base,
      ball: { ...base.ball, y: CANVAS_HEIGHT + 300 },
      platforms: [],
      cameraY: 0,
    }
    const next = stepGame(state, { left: false, right: false })
    expect(next.gameOver).toBe(true)
  })

  it('tracks highScore as the max total score', () => {
    const base = createInitialState(50)
    const state: GameState = {
      ...base,
      heightScore: 60,
      starScore: 10,
    }
    const next = stepGame(state, { left: false, right: false })
    expect(next.highScore).toBeGreaterThanOrEqual(50)
  })

  it('generates platforms as the ball ascends', () => {
    const base = createInitialState()
    // Start from a clean slate with no platforms and camera very high,
    // so the generation loop must create new platforms
    const state: GameState = {
      ...base,
      platforms: [],
      cameraY: -2000,
      lowestGenY: -1800,
    }
    const next = stepGame(state, { left: false, right: false })
    expect(next.platforms.length).toBeGreaterThan(0)
  })
})
