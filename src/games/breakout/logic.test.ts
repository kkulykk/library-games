import {
  createBricks,
  createBall,
  createPaddle,
  moveBall,
  bounceWalls,
  checkPaddleCollision,
  isBallLost,
  isLevelComplete,
  BRICK_ROWS,
  BRICK_COLS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './logic'

describe('createBricks', () => {
  it('creates the correct number of bricks', () => {
    const bricks = createBricks()
    expect(bricks.length).toBe(BRICK_ROWS * BRICK_COLS)
  })

  it('all bricks start alive', () => {
    const bricks = createBricks()
    expect(bricks.every((b) => b.alive)).toBe(true)
  })
})

describe('createBall', () => {
  it('creates a ball near the center', () => {
    const ball = createBall()
    expect(ball.x).toBeCloseTo(CANVAS_WIDTH / 2)
    expect(ball.radius).toBeGreaterThan(0)
  })
})

describe('moveBall', () => {
  it('updates position by velocity', () => {
    const ball = createBall()
    const moved = moveBall(ball)
    expect(moved.x).toBe(ball.x + ball.vx)
    expect(moved.y).toBe(ball.y + ball.vy)
  })
})

describe('bounceWalls', () => {
  it('reverses horizontal velocity at left wall', () => {
    const ball = { x: 0, y: 300, vx: -4, vy: -4, radius: 8 }
    const bounced = bounceWalls(ball)
    expect(bounced.vx).toBe(4)
  })

  it('reverses horizontal velocity at right wall', () => {
    const ball = { x: CANVAS_WIDTH, y: 300, vx: 4, vy: -4, radius: 8 }
    const bounced = bounceWalls(ball)
    expect(bounced.vx).toBe(-4)
  })

  it('reverses vertical velocity at top wall', () => {
    const ball = { x: 240, y: 0, vx: 4, vy: -4, radius: 8 }
    const bounced = bounceWalls(ball)
    expect(bounced.vy).toBe(4)
  })
})

describe('checkPaddleCollision', () => {
  it('reverses vertical velocity on paddle hit', () => {
    const paddle = createPaddle()
    const ball = {
      x: paddle.x + paddle.width / 2,
      y: paddle.y,
      vx: 4,
      vy: 4,
      radius: 8,
    }
    const result = checkPaddleCollision(ball, paddle)
    expect(result.vy).toBeLessThan(0)
  })

  it('does not change ball when not hitting paddle', () => {
    const paddle = createPaddle()
    const ball = createBall()
    const result = checkPaddleCollision(ball, paddle)
    // Ball is in the middle, far from paddle
    expect(result.vx).toBe(ball.vx)
    expect(result.vy).toBe(ball.vy)
  })
})

describe('isBallLost', () => {
  it('returns true when ball falls below canvas', () => {
    const ball = { x: 240, y: CANVAS_HEIGHT + 10, vx: 4, vy: 4, radius: 8 }
    expect(isBallLost(ball)).toBe(true)
  })

  it('returns false when ball is within canvas', () => {
    const ball = createBall()
    expect(isBallLost(ball)).toBe(false)
  })
})

describe('isLevelComplete', () => {
  it('returns false when some bricks are alive', () => {
    const bricks = createBricks()
    expect(isLevelComplete(bricks)).toBe(false)
  })

  it('returns true when all bricks are destroyed', () => {
    const bricks = createBricks().map((b) => ({ ...b, alive: false }))
    expect(isLevelComplete(bricks)).toBe(true)
  })
})
