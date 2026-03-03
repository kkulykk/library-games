export const CANVAS_WIDTH = 380
export const CANVAS_HEIGHT = 580
export const BALL_RADIUS = 13
export const GRAVITY = 0.4
export const BOUNCE_VY = -13.5
export const H_SPEED = 5
export const PLATFORM_H = 12
export const MIN_PLAT_W = 55
export const MAX_PLAT_W = 110
export const STAR_RADIUS = 9
export const STAR_SCORE = 5
export const GAP_MIN = 65
export const GAP_MAX = 100
export const HEIGHT_SCORE_DIVISOR = 8

export type PlatformType = 'normal' | 'moving' | 'breaking'

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
}

export interface Platform {
  id: number
  x: number
  y: number
  w: number
  type: PlatformType
  vx: number
  bounceCount: number
}

export interface Star {
  id: number
  x: number
  y: number
  collected: boolean
}

export interface Input {
  left: boolean
  right: boolean
}

export interface GameState {
  ball: Ball
  platforms: Platform[]
  stars: Star[]
  heightScore: number
  starScore: number
  highScore: number
  cameraY: number
  gameOver: boolean
  nextPlatformId: number
  nextStarId: number
  lowestGenY: number
}

export function totalScore(state: GameState): number {
  return state.heightScore + state.starScore
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function makePlatform(
  id: number,
  x: number,
  y: number,
  w: number,
  type: PlatformType,
  vx = 0
): Platform {
  return { id, x, y, w, type, vx, bounceCount: 0 }
}

export function createInitialState(highScore = 0): GameState {
  let nextPlatformId = 0
  const platforms: Platform[] = []

  // Wide starting platform directly below the ball
  platforms.push(
    makePlatform(nextPlatformId++, CANVAS_WIDTH / 2 - 70, CANVAS_HEIGHT - 80, 140, 'normal')
  )

  // Pre-generate platforms going upward
  let y = CANVAS_HEIGHT - 80 - 85
  while (y > -CANVAS_HEIGHT * 0.6) {
    const w = rand(MIN_PLAT_W, MAX_PLAT_W)
    const x = rand(10, CANVAS_WIDTH - w - 10)
    platforms.push(makePlatform(nextPlatformId++, x, y, w, 'normal'))
    y -= rand(GAP_MIN, GAP_MAX)
  }

  return {
    ball: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 80 - BALL_RADIUS - 2,
      vx: 0,
      vy: -1,
    },
    platforms,
    stars: [],
    heightScore: 0,
    starScore: 0,
    highScore,
    cameraY: 0,
    gameOver: false,
    nextPlatformId,
    nextStarId: 0,
    lowestGenY: y,
  }
}

export function stepGame(state: GameState, input: Input): GameState {
  if (state.gameOver) return state

  const ball = { ...state.ball }
  let nextPlatformId = state.nextPlatformId
  let nextStarId = state.nextStarId
  let starScore = state.starScore

  // Horizontal control
  if (input.left) {
    ball.vx = -H_SPEED
  } else if (input.right) {
    ball.vx = H_SPEED
  } else {
    ball.vx *= 0.75
  }

  // Gravity with terminal velocity cap
  ball.vy = Math.min(ball.vy + GRAVITY, 20)

  const prevY = ball.y
  ball.x += ball.vx
  ball.y += ball.vy

  // Wrap horizontally
  if (ball.x < -BALL_RADIUS) ball.x = CANVAS_WIDTH + BALL_RADIUS
  if (ball.x > CANVAS_WIDTH + BALL_RADIUS) ball.x = -BALL_RADIUS

  // Platform collisions
  let platforms = state.platforms.map((p) => ({ ...p }))
  const prevBallBottom = prevY + BALL_RADIUS
  const ballBottom = ball.y + BALL_RADIUS

  for (const p of platforms) {
    // Skip already-bounced breaking platforms
    if (p.type === 'breaking' && p.bounceCount > 0) continue

    if (
      ball.vy > 0 &&
      prevBallBottom <= p.y + 5 &&
      ballBottom >= p.y &&
      ball.x + BALL_RADIUS > p.x &&
      ball.x - BALL_RADIUS < p.x + p.w
    ) {
      ball.y = p.y - BALL_RADIUS
      ball.vy = BOUNCE_VY
      if (p.type === 'breaking') p.bounceCount++
    }
  }

  // Remove spent breaking platforms
  platforms = platforms.filter((p) => !(p.type === 'breaking' && p.bounceCount > 0))

  // Animate moving platforms
  platforms = platforms.map((p) => {
    if (p.type !== 'moving') return p
    let nx = p.x + p.vx
    let nvx = p.vx
    if (nx <= 0 || nx + p.w >= CANVAS_WIDTH) {
      nvx = -nvx
      nx = p.x + nvx
    }
    return { ...p, x: nx, vx: nvx }
  })

  // Camera follows ball upward only (never scrolls back down)
  const cameraY = Math.min(state.cameraY, ball.y - CANVAS_HEIGHT * 0.45)

  // Height score: increases as camera scrolls up
  const heightScore = Math.max(state.heightScore, Math.floor(-cameraY / HEIGHT_SCORE_DIVISOR))

  // Star collection
  let stars = state.stars.map((s) => ({ ...s }))
  for (const star of stars) {
    if (star.collected) continue
    const dx = ball.x - star.x
    const dy = ball.y - star.y
    if (dx * dx + dy * dy < (BALL_RADIUS + STAR_RADIUS) ** 2) {
      star.collected = true
      starScore += STAR_SCORE
    }
  }

  // Cull off-screen entities
  const cullBottom = cameraY + CANVAS_HEIGHT + 300
  platforms = platforms.filter((p) => p.y < cullBottom)
  stars = stars.filter((s) => !s.collected && s.y < cullBottom)

  // Generate new platforms above visible area
  let { lowestGenY } = state
  const screenTop = cameraY - 300
  const difficulty = Math.min(heightScore / 80, 1) // ramps from 0→1 over first 80 pts

  while (lowestGenY > screenTop) {
    const w = rand(MIN_PLAT_W * (1 - difficulty * 0.3), MAX_PLAT_W * (1 - difficulty * 0.15))
    const x = rand(10, CANVAS_WIDTH - w - 10)

    let type: PlatformType = 'normal'
    const r = Math.random()
    if (difficulty > 0.25 && r < 0.18) type = 'moving'
    else if (difficulty > 0.5 && r < 0.28) type = 'breaking'

    const vx = type === 'moving' ? rand(1.5, 2.8) * (Math.random() < 0.5 ? 1 : -1) : 0
    platforms.push(makePlatform(nextPlatformId++, x, lowestGenY, w, type, vx))

    // Occasionally place a star above the platform
    if (Math.random() < 0.3) {
      stars.push({
        id: nextStarId++,
        x: x + rand(8, w - 8),
        y: lowestGenY - rand(28, 48),
        collected: false,
      })
    }

    lowestGenY -= rand(GAP_MIN, GAP_MAX + difficulty * 35)
  }

  const gameOver = ball.y - BALL_RADIUS > cameraY + CANVAS_HEIGHT + 100
  const highScore = Math.max(state.highScore, heightScore + starScore)

  return {
    ...state,
    ball,
    platforms,
    stars,
    heightScore,
    starScore,
    highScore,
    cameraY,
    gameOver,
    nextPlatformId,
    nextStarId,
    lowestGenY,
  }
}
