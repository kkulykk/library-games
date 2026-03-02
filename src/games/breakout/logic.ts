export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

export interface Paddle {
  x: number
  y: number
  width: number
  height: number
}

export interface Brick {
  x: number
  y: number
  width: number
  height: number
  alive: boolean
  color: string
}

export const CANVAS_WIDTH = 480
export const CANVAS_HEIGHT = 600
export const PADDLE_WIDTH = 80
export const PADDLE_HEIGHT = 12
export const BALL_RADIUS = 8
export const BRICK_ROWS = 5
export const BRICK_COLS = 10
export const BRICK_WIDTH = 44
export const BRICK_HEIGHT = 18
export const BRICK_PADDING = 4
export const BRICK_OFFSET_TOP = 60
export const BRICK_OFFSET_LEFT = 8

const BRICK_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6']

export function createBricks(): Brick[] {
  const bricks: Brick[] = []
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      bricks.push({
        x: BRICK_OFFSET_LEFT + col * (BRICK_WIDTH + BRICK_PADDING),
        y: BRICK_OFFSET_TOP + row * (BRICK_HEIGHT + BRICK_PADDING),
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        alive: true,
        color: BRICK_COLORS[row],
      })
    }
  }
  return bricks
}

export function createBall(): Ball {
  return {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 80,
    vx: 4,
    vy: -4,
    radius: BALL_RADIUS,
  }
}

export function createPaddle(): Paddle {
  return {
    x: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
    y: CANVAS_HEIGHT - 30,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
  }
}

export function moveBall(ball: Ball): Ball {
  return { ...ball, x: ball.x + ball.vx, y: ball.y + ball.vy }
}

export function bounceWalls(ball: Ball): Ball {
  let { vx, vy } = ball
  if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= CANVAS_WIDTH) vx = -vx
  if (ball.y - ball.radius <= 0) vy = -vy
  return { ...ball, vx, vy }
}

export function checkPaddleCollision(ball: Ball, paddle: Paddle): Ball {
  if (
    ball.y + ball.radius >= paddle.y &&
    ball.y + ball.radius <= paddle.y + paddle.height &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.width
  ) {
    // Angle based on where ball hits paddle
    const hitPos = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2)
    const angle = hitPos * (Math.PI / 3) // max 60°
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
    return {
      ...ball,
      vx: speed * Math.sin(angle),
      vy: -Math.abs(speed * Math.cos(angle)),
    }
  }
  return ball
}

export function checkBrickCollisions(
  ball: Ball,
  bricks: Brick[]
): { ball: Ball; bricks: Brick[]; points: number } {
  let points = 0
  let { vx, vy } = ball
  const newBricks = bricks.map((brick) => {
    if (!brick.alive) return brick
    if (
      ball.x + ball.radius > brick.x &&
      ball.x - ball.radius < brick.x + brick.width &&
      ball.y + ball.radius > brick.y &&
      ball.y - ball.radius < brick.y + brick.height
    ) {
      // Determine collision side
      const overlapX = Math.min(
        Math.abs(ball.x + ball.radius - brick.x),
        Math.abs(ball.x - ball.radius - (brick.x + brick.width))
      )
      const overlapY = Math.min(
        Math.abs(ball.y + ball.radius - brick.y),
        Math.abs(ball.y - ball.radius - (brick.y + brick.height))
      )
      if (overlapX < overlapY) vx = -vx
      else vy = -vy
      points += 10
      return { ...brick, alive: false }
    }
    return brick
  })
  return { ball: { ...ball, vx, vy }, bricks: newBricks, points }
}

export function isBallLost(ball: Ball): boolean {
  return ball.y - ball.radius > CANVAS_HEIGHT
}

export function isLevelComplete(bricks: Brick[]): boolean {
  return bricks.every((b) => !b.alive)
}
