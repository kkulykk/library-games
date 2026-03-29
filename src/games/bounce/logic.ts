// Nokia Bounce — pure game logic (no React)

export const CANVAS_WIDTH = 480
export const CANVAS_HEIGHT = 320
export const TILE_SIZE = 32
export const BALL_RADIUS = 10
export const GRAVITY = 0.42
export const BOUNCE_VY = -8.5
export const BIG_BOUNCE_VY = -11.5
export const SPRING_VY = -15
export const MOVE_SPEED = 3.5
export const MAX_FALL_SPEED = 12
export const RING_SCORE = 100
export const LEVEL_BONUS = 500
export const INITIAL_LIVES = 3

/* ── tile constants ──────────────────────────────── */
export const T_EMPTY = 0
export const T_BRICK = 1
export const T_BRICK2 = 2
export const T_SPIKE = 3
export const T_SPRING = 4
export const T_FINISH = 5

export type TileType = 0 | 1 | 2 | 3 | 4 | 5

/* ── types ───────────────────────────────────────── */
export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
}

export interface RingDef {
  col: number
  row: number
  collected: boolean
}

export interface Input {
  left: boolean
  right: boolean
  jump: boolean
}

export interface GameState {
  ball: Ball
  level: number
  lives: number
  score: number
  rings: RingDef[]
  tiles: TileType[][]
  levelWidth: number
  levelHeight: number
  cameraX: number
  cameraY: number
  gameOver: boolean
  levelComplete: boolean
  won: boolean
  startX: number
  startY: number
  finishX: number
  finishY: number
  /** true for exactly one frame after the ball bounces */
  justBounced: boolean
  /** countdown frames when dying (flash animation) */
  deathTimer: number
}

/* ── level maps ──────────────────────────────────── */
// Legend: B=brick  D=dark-brick  S=spike  P=spring  R=ring  @=start  F=finish  .=empty

const LEVEL_MAPS: string[][] = [
  // ── Level 1: Getting Started ──
  [
    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    'B...........................................B',
    'B...........................................B',
    'B........R.R.R...........R.R................B',
    'B.......BBBBBBB.........BBBBB..............B',
    'B...........................................B',
    'B............R.R.R.R...........R.R.....F....B',
    'B..........BBBBBBBBB........BBBBBBBBBBBBBBBBB',
    'B@.R.R.................................R....B',
    'BBBBBBB..BBBBB...BBBBB...BBBBB...BBBBBBBBBBB',
  ],
  // ── Level 2: Spring Time ──
  [
    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    'B.................................................B',
    'B...........................R.R.R.................B',
    'B..........................BBBBBBB........R.R.F...B',
    'B.........................................BBBBBBBBB',
    'B...........R.R..........R.R......................B',
    'B..........BBBBB.......BBBBB.......P.............B',
    'B.....R.R.............................P...........B',
    'B@...BBBBB..........P.............BBBBBBB........B',
    'BBBBBBBBBBB...BBBBBBBBB...BBBBBBBBBBBBBBBBBBBBBBBBB',
  ],
  // ── Level 3: Watch Your Step ──
  [
    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    'B......................................................B',
    'B......................................................B',
    'B.......................R.R.R..........R.R..............B',
    'B......................BBBBBBB........BBBBB.......F....B',
    'B......................................................B',
    'B...........R.R.R.................R.R.......BBBBBBBBBBBBB',
    'B..........BBBBBBB.....S.S....BBBBBBB.................B',
    'B@.R.R................S.S.S.S.........................B',
    'BBBBBBBBB...BBBBBBB..SSSSSSSSSS..BBBBBBB...BBBBBBBBBBB',
  ],
  // ── Level 4: Bounce Chamber ──
  [
    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    'B...........................................................B',
    'B..................................R.R.R..............R.F...B',
    'B.................................BBBBBBB.............BBBBBBB',
    'B.........R.R.R.......................S.S..............S.S.B',
    'B........BBBBBBB......R.R............S.S..............S.S.B',
    'B.....................BBBBB...P.......S.S......P......S.S.B',
    'B...R.R.....P..............................................B',
    'B@.BBBBB.BBB.BBB....P.........BBBBBBBBBBBB.....BBBBBBBBBBB',
    'BBBBBBBBBBBBBBBBB..BBBBBBB..SSSBBBBBBBBBBBBBBSSSBBBBBBBBBBB',
  ],
  // ── Level 5: The Escape ──
  [
    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    'B.................................................................B',
    'B............................R.R.R............R.R.R..........R.F..B',
    'B...........................BBBBBBB..........BBBBBBB........BBBBBBB',
    'B.........R.R.R....S.S.........S.S.....S.S.......S.S..S.S.....S.B',
    'B........BBBBBBB...S.S.........S.S.....S.S.......S.S..S.S.....S.B',
    'B.................P.S.S...P....S.S..P..S.S..P....S.S..S.S..P..S.B',
    'B...R.R.....P.......S.S............................................B',
    'B@.BBBBB..BBBBBB....S.S.....BBBBBBB....BBBBBBB....BBBBBBB..BBBBBB',
    'BBBBBBBBBBBBBBBBB.SSSSSSSSSSSBBBBBBBBSSSSBBBBBBBBSSSSBBBBBBBBBBBBB',
  ],
]

/* ── level parsing ───────────────────────────────── */
export interface ParsedLevel {
  tiles: TileType[][]
  rings: RingDef[]
  startCol: number
  startRow: number
  finishCol: number
  finishRow: number
  width: number
  height: number
}

export function parseLevel(index: number): ParsedLevel {
  const map = LEVEL_MAPS[Math.min(index, LEVEL_MAPS.length - 1)]
  const height = map.length
  const width = map[0].length
  const tiles: TileType[][] = []
  const rings: RingDef[] = []
  let startCol = 1
  let startRow = height - 2
  let finishCol = width - 2
  let finishRow = 1

  for (let r = 0; r < height; r++) {
    const row: TileType[] = []
    for (let c = 0; c < width; c++) {
      const ch = map[r]?.[c] ?? '.'
      switch (ch) {
        case 'B':
          row.push(T_BRICK)
          break
        case 'D':
          row.push(T_BRICK2)
          break
        case 'S':
          row.push(T_SPIKE)
          break
        case 'P':
          row.push(T_SPRING)
          break
        case 'F':
          row.push(T_FINISH)
          finishCol = c
          finishRow = r
          break
        case 'R':
          rings.push({ col: c, row: r, collected: false })
          row.push(T_EMPTY)
          break
        case '@':
          startCol = c
          startRow = r
          row.push(T_EMPTY)
          break
        default:
          row.push(T_EMPTY)
      }
    }
    tiles.push(row)
  }

  return { tiles, rings, startCol, startRow, finishCol, finishRow, width, height }
}

export const TOTAL_LEVELS = LEVEL_MAPS.length

/* ── state creation ──────────────────────────────── */
export function createInitialState(level = 0, score = 0, lives = INITIAL_LIVES): GameState {
  const parsed = parseLevel(level)
  return {
    ball: {
      x: parsed.startCol * TILE_SIZE + TILE_SIZE / 2,
      y: parsed.startRow * TILE_SIZE + TILE_SIZE / 2,
      vx: 0,
      vy: 0,
    },
    level,
    lives,
    score,
    rings: parsed.rings.map((r) => ({ ...r })),
    tiles: parsed.tiles,
    levelWidth: parsed.width,
    levelHeight: parsed.height,
    cameraX: 0,
    cameraY: 0,
    gameOver: false,
    levelComplete: false,
    won: false,
    startX: parsed.startCol * TILE_SIZE + TILE_SIZE / 2,
    startY: parsed.startRow * TILE_SIZE + TILE_SIZE / 2,
    finishX: parsed.finishCol * TILE_SIZE + TILE_SIZE / 2,
    finishY: parsed.finishRow * TILE_SIZE + TILE_SIZE / 2,
    justBounced: false,
    deathTimer: 0,
  }
}

/* ── helpers ──────────────────────────────────────── */
export function isSolid(t: TileType): boolean {
  return t === T_BRICK || t === T_BRICK2 || t === T_SPRING
}

export function getTile(
  tiles: TileType[][],
  col: number,
  row: number,
  w: number,
  h: number
): TileType {
  if (col < 0 || col >= w || row < 0 || row >= h) return T_BRICK
  return tiles[row][col]
}

/* ── main step ───────────────────────────────────── */
export function stepGame(state: GameState, input: Input): GameState {
  if (state.gameOver || state.levelComplete || state.won) return state

  // Death animation
  if (state.deathTimer > 0) {
    const dt = state.deathTimer - 1
    if (dt <= 0) {
      // Respawn or game over
      if (state.lives <= 1) {
        return { ...state, deathTimer: 0, gameOver: true, lives: 0 }
      }
      const parsed = parseLevel(state.level)
      return {
        ...state,
        ball: {
          x: state.startX,
          y: state.startY,
          vx: 0,
          vy: 0,
        },
        lives: state.lives - 1,
        rings: parsed.rings.map((r) => ({ ...r })),
        deathTimer: 0,
        justBounced: false,
      }
    }
    return { ...state, deathTimer: dt }
  }

  const { tiles, levelWidth: lw, levelHeight: lh } = state
  const ball = { ...state.ball }
  let justBounced = false

  // Horizontal movement
  if (input.left) ball.vx = -MOVE_SPEED
  else if (input.right) ball.vx = MOVE_SPEED
  else ball.vx *= 0.7

  if (Math.abs(ball.vx) < 0.2) ball.vx = 0

  // Apply gravity
  ball.vy = Math.min(ball.vy + GRAVITY, MAX_FALL_SPEED)

  // ── horizontal collision ──
  ball.x += ball.vx
  const r = BALL_RADIUS - 1 // shrink hitbox slightly for feel

  // Check tile overlaps after horizontal move
  const colL = Math.floor((ball.x - r) / TILE_SIZE)
  const colR = Math.floor((ball.x + r) / TILE_SIZE)
  const rowT = Math.floor((ball.y - r) / TILE_SIZE)
  const rowB = Math.floor((ball.y + r) / TILE_SIZE)

  for (let row = rowT; row <= rowB; row++) {
    for (let col = colL; col <= colR; col++) {
      if (!isSolid(getTile(tiles, col, row, lw, lh))) continue
      const tileLeft = col * TILE_SIZE
      const tileRight = tileLeft + TILE_SIZE
      // Resolve push-out
      if (ball.vx > 0) {
        ball.x = tileLeft - r - 0.01
      } else if (ball.vx < 0) {
        ball.x = tileRight + r + 0.01
      }
      ball.vx = 0
    }
  }

  // ── vertical collision ──
  ball.y += ball.vy

  const colL2 = Math.floor((ball.x - r) / TILE_SIZE)
  const colR2 = Math.floor((ball.x + r) / TILE_SIZE)
  const rowT2 = Math.floor((ball.y - r) / TILE_SIZE)
  const rowB2 = Math.floor((ball.y + r) / TILE_SIZE)

  let onGround = false
  let onSpring = false

  for (let row = rowT2; row <= rowB2; row++) {
    for (let col = colL2; col <= colR2; col++) {
      const t = getTile(tiles, col, row, lw, lh)
      if (!isSolid(t)) continue
      const tileTop = row * TILE_SIZE
      const tileBottom = tileTop + TILE_SIZE

      if (ball.vy > 0) {
        // Falling → land on top of tile
        ball.y = tileTop - r - 0.01
        if (t === T_SPRING) {
          onSpring = true
        }
        onGround = true
        ball.vy = 0
      } else if (ball.vy < 0) {
        // Rising → hit ceiling
        ball.y = tileBottom + r + 0.01
        ball.vy = 0
      }
    }
  }

  // Auto-bounce when landing
  if (onGround) {
    if (onSpring) {
      ball.vy = SPRING_VY
    } else if (input.jump) {
      ball.vy = BIG_BOUNCE_VY
    } else {
      ball.vy = BOUNCE_VY
    }
    justBounced = true
  }

  // ── spike check ──
  const sColL = Math.floor((ball.x - r) / TILE_SIZE)
  const sColR = Math.floor((ball.x + r) / TILE_SIZE)
  const sRowT = Math.floor((ball.y - r) / TILE_SIZE)
  const sRowB = Math.floor((ball.y + r) / TILE_SIZE)

  for (let row = sRowT; row <= sRowB; row++) {
    for (let col = sColL; col <= sColR; col++) {
      if (getTile(tiles, col, row, lw, lh) === T_SPIKE) {
        return { ...state, ball, deathTimer: 30, justBounced: false }
      }
    }
  }

  // ── ring collection ──
  const rings = state.rings.map((ring) => {
    if (ring.collected) return ring
    const rx = ring.col * TILE_SIZE + TILE_SIZE / 2
    const ry = ring.row * TILE_SIZE + TILE_SIZE / 2
    const dx = ball.x - rx
    const dy = ball.y - ry
    if (dx * dx + dy * dy < (BALL_RADIUS + 10) ** 2) {
      return { ...ring, collected: true }
    }
    return ring
  })

  const newCollected = rings.filter((r) => r.collected).length
  const oldCollected = state.rings.filter((r) => r.collected).length
  const score = state.score + (newCollected - oldCollected) * RING_SCORE

  // ── finish check ──
  const fx = state.finishX
  const fy = state.finishY
  const fdx = ball.x - fx
  const fdy = ball.y - fy
  const reachedFinish = fdx * fdx + fdy * fdy < (BALL_RADIUS + 14) ** 2

  if (reachedFinish) {
    const finalScore = score + LEVEL_BONUS
    if (state.level >= TOTAL_LEVELS - 1) {
      return { ...state, ball, rings, score: finalScore, won: true, justBounced }
    }
    return { ...state, ball, rings, score: finalScore, levelComplete: true, justBounced }
  }

  // ── camera ──
  const maxCamX = Math.max(0, lw * TILE_SIZE - CANVAS_WIDTH)
  const maxCamY = Math.max(0, lh * TILE_SIZE - CANVAS_HEIGHT)
  const targetCamX = Math.max(0, Math.min(maxCamX, ball.x - CANVAS_WIDTH / 2))
  const targetCamY = Math.max(0, Math.min(maxCamY, ball.y - CANVAS_HEIGHT / 2))
  const camLerp = 0.1
  const cameraX = state.cameraX + (targetCamX - state.cameraX) * camLerp
  const cameraY = state.cameraY + (targetCamY - state.cameraY) * camLerp

  return {
    ...state,
    ball,
    rings,
    score,
    cameraX,
    cameraY,
    justBounced,
  }
}

export function advanceLevel(state: GameState): GameState {
  return createInitialState(state.level + 1, state.score, state.lives)
}
