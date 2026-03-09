// ─── Constants ────────────────────────────────────────────────────────────────

export const MAP_WIDTH = 5000
export const MAP_HEIGHT = 5000
export const BASE_SPEED = 200
export const BOOST_SPEED = 380
export const BOOST_DRAIN = 0.3 // segments lost per second while boosting
export const SEGMENT_SPACING = 6 // pixels between segments
export const HEAD_RADIUS = 14
export const BODY_RADIUS = 12
export const START_LENGTH = 30 // starting segment count
export const FOOD_COUNT = 600
export const FOOD_RADIUS = 5
export const FOOD_PER_SEGMENT = 3 // food needed to gain 1 segment
export const GAME_DURATION = 180 // seconds
export const MAX_PLAYERS = 8
export const RESPAWN_DELAY = 3000
export const TURN_SPEED = 4.5 // radians per second
export const MIN_BOOST_LENGTH = 15 // can't boost below this

const PLAYER_COLORS = [
  '#FF073A',
  '#FF6B00',
  '#FFD700',
  '#39FF14',
  '#00FFFF',
  '#4D4DFF',
  '#FF44CC',
  '#B026FF',
  '#FF6EC7',
  '#00FF7F',
]

const FOOD_COLORS = [
  '#FF073A',
  '#FF6B00',
  '#FFD700',
  '#39FF14',
  '#00FFFF',
  '#4D4DFF',
  '#FF44CC',
  '#B026FF',
  '#FF6EC7',
  '#00FF7F',
  '#FFA07A',
  '#98FB98',
  '#DDA0DD',
  '#87CEFA',
]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Position {
  x: number
  y: number
}

export interface SnakeState {
  id: string
  name: string
  color: string
  segments: Position[] // [0] = head
  angle: number // radians, current heading
  targetLength: number
  score: number
  alive: boolean
  boosting: boolean
  deathTime: number | null
  foodEaten: number // fractional food counter for growth
}

export interface Food {
  id: number
  x: number
  y: number
  color: string
  size: number // slight variation
}

export interface LobbyPlayer {
  id: string
  name: string
  isHost: boolean
  color: string
}

export type GamePhase = 'lobby' | 'playing' | 'finished'

export interface GameState {
  phase: GamePhase
  players: LobbyPlayer[]
  hostId: string
}

// ─── Broadcast message types ──────────────────────────────────────────────────

export type BroadcastMessage =
  | { type: 'snake_update'; snake: SnakeState }
  | { type: 'food_sync'; food: Food[]; nextFoodId: number }
  | { type: 'eat_food'; playerId: string; foodIds: number[] }
  | { type: 'snake_killed'; killerId: string; killedId: string }
  | { type: 'death_food'; food: Food[] }
  | { type: 'game_start'; startTime: number; food: Food[]; nextFoodId: number }
  | { type: 'game_end' }

// ─── Pure functions ───────────────────────────────────────────────────────────

export function clampToMap(x: number, y: number): Position {
  return {
    x: Math.max(HEAD_RADIUS, Math.min(MAP_WIDTH - HEAD_RADIUS, x)),
    y: Math.max(HEAD_RADIUS, Math.min(MAP_HEIGHT - HEAD_RADIUS, y)),
  }
}

export function distanceBetween(a: Position, b: Position): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function angleTo(from: Position, to: Position): number {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

export function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

export function turnToward(current: number, target: number, maxTurn: number): number {
  const diff = normalizeAngle(target - current)
  if (Math.abs(diff) < maxTurn) return normalizeAngle(target)
  return normalizeAngle(current + Math.sign(diff) * maxTurn)
}

export function moveSnake(snake: SnakeState, targetAngle: number, dt: number): SnakeState {
  if (!snake.alive) return snake

  const speed = snake.boosting ? BOOST_SPEED : BASE_SPEED
  const angle = turnToward(snake.angle, targetAngle, TURN_SPEED * dt)

  // Move head
  const head = snake.segments[0]
  const newHead = clampToMap(
    head.x + Math.cos(angle) * speed * dt,
    head.y + Math.sin(angle) * speed * dt
  )

  // Build new segments: head moves forward, body follows
  const newSegments = [newHead]
  for (let i = 1; i < snake.segments.length; i++) {
    const prev = newSegments[i - 1]
    const curr = snake.segments[i]
    const dx = curr.x - prev.x
    const dy = curr.y - prev.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > SEGMENT_SPACING) {
      const nx = prev.x + (dx / dist) * SEGMENT_SPACING
      const ny = prev.y + (dy / dist) * SEGMENT_SPACING
      newSegments.push({ x: nx, y: ny })
    } else {
      newSegments.push({ ...curr })
    }
  }

  // Grow if targetLength > segments, shrink if less
  let segments = newSegments
  while (segments.length < snake.targetLength) {
    const tail = segments[segments.length - 1]
    segments.push({ ...tail })
  }
  if (segments.length > snake.targetLength) {
    segments = segments.slice(0, snake.targetLength)
  }

  // Boost drain
  let targetLength = snake.targetLength
  if (snake.boosting && targetLength > MIN_BOOST_LENGTH) {
    targetLength = Math.max(MIN_BOOST_LENGTH, targetLength - BOOST_DRAIN * dt * 10)
  }

  return {
    ...snake,
    segments,
    angle,
    targetLength,
  }
}

export function checkSnakeHeadVsBody(
  head: Position,
  otherSnake: SnakeState,
  skipSegments: number = 5
): boolean {
  if (!otherSnake.alive) return false
  // Skip first few segments (near head) to prevent self-collision artifacts
  for (let i = skipSegments; i < otherSnake.segments.length; i++) {
    const seg = otherSnake.segments[i]
    const dist = distanceBetween(head, seg)
    if (dist < HEAD_RADIUS + BODY_RADIUS * 0.7) {
      return true
    }
  }
  return false
}

export function checkSnakeVsBorder(head: Position): boolean {
  return (
    head.x <= HEAD_RADIUS + 1 ||
    head.x >= MAP_WIDTH - HEAD_RADIUS - 1 ||
    head.y <= HEAD_RADIUS + 1 ||
    head.y >= MAP_HEIGHT - HEAD_RADIUS - 1
  )
}

export function checkFoodCollisions(snake: SnakeState, food: Food[]): number[] {
  if (!snake.alive || snake.segments.length === 0) return []
  const head = snake.segments[0]
  const eaten: number[] = []

  for (const f of food) {
    const dx = head.x - f.x
    const dy = head.y - f.y
    if (dx * dx + dy * dy < (HEAD_RADIUS + FOOD_RADIUS) * (HEAD_RADIUS + FOOD_RADIUS)) {
      eaten.push(f.id)
    }
  }

  return eaten
}

export function snakeToFood(snake: SnakeState, startId: number): Food[] {
  // When a snake dies, its body becomes food
  const food: Food[] = []
  for (let i = 0; i < snake.segments.length; i += 2) {
    const seg = snake.segments[i]
    food.push({
      id: startId + food.length,
      x: seg.x + (Math.random() - 0.5) * 10,
      y: seg.y + (Math.random() - 0.5) * 10,
      color: snake.color,
      size: FOOD_RADIUS * (0.8 + Math.random() * 0.6),
    })
  }
  return food
}

export function generateFood(count: number, startId: number): Food[] {
  const food: Food[] = []
  for (let i = 0; i < count; i++) {
    food.push({
      id: startId + i,
      x: HEAD_RADIUS + Math.random() * (MAP_WIDTH - HEAD_RADIUS * 2),
      y: HEAD_RADIUS + Math.random() * (MAP_HEIGHT - HEAD_RADIUS * 2),
      color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
      size: FOOD_RADIUS * (0.5 + Math.random() * 1.0),
    })
  }
  return food
}

export function spawnPosition(): Position {
  return {
    x: MAP_WIDTH * 0.15 + Math.random() * MAP_WIDTH * 0.7,
    y: MAP_HEIGHT * 0.15 + Math.random() * MAP_HEIGHT * 0.7,
  }
}

export function createSnakeState(id: string, name: string, color: string): SnakeState {
  const pos = spawnPosition()
  const angle = Math.random() * Math.PI * 2
  const segments: Position[] = []
  for (let i = 0; i < START_LENGTH; i++) {
    segments.push({
      x: pos.x - Math.cos(angle) * i * SEGMENT_SPACING,
      y: pos.y - Math.sin(angle) * i * SEGMENT_SPACING,
    })
  }

  return {
    id,
    name,
    color,
    segments,
    angle,
    targetLength: START_LENGTH,
    score: 0,
    alive: true,
    boosting: false,
    deathTime: null,
    foodEaten: 0,
  }
}

export function assignColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length]
}

// ─── Lobby state management (stored in DB) ────────────────────────────────────

export function createLobbyState(host: LobbyPlayer): GameState {
  return {
    phase: 'lobby',
    players: [host],
    hostId: host.id,
  }
}

export function addPlayer(state: GameState, player: LobbyPlayer): GameState {
  if (state.phase !== 'lobby') return state
  if (state.players.length >= MAX_PLAYERS) return state
  if (state.players.some((p) => p.id === player.id)) return state

  return {
    ...state,
    players: [...state.players, player],
  }
}

export function removePlayer(state: GameState, playerId: string): GameState {
  const newPlayers = state.players.filter((p) => p.id !== playerId)
  if (newPlayers.length === state.players.length) return state

  if (state.hostId === playerId && newPlayers.length > 0) {
    newPlayers[0] = { ...newPlayers[0], isHost: true }
    return { ...state, players: newPlayers, hostId: newPlayers[0].id }
  }

  return { ...state, players: newPlayers }
}

export type GameAction =
  | { type: 'START_GAME'; playerId: string }
  | { type: 'PLAY_AGAIN'; playerId: string }

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      if (state.phase !== 'lobby') return state
      if (action.playerId !== state.hostId) return state
      if (state.players.length < 2) return state
      return { ...state, phase: 'playing' }
    }
    case 'PLAY_AGAIN': {
      if (state.phase !== 'finished') return state
      if (action.playerId !== state.hostId) return state
      return { ...state, phase: 'lobby' }
    }
    default:
      return state
  }
}

// ─── Viewport helpers ─────────────────────────────────────────────────────────

export function getViewport(
  headX: number,
  headY: number,
  snakeLength: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; scale: number } {
  // Zoom out slightly as snake grows
  const scale = Math.max(0.4, 1 - snakeLength * 0.0008)
  return {
    x: headX - canvasWidth / 2 / scale,
    y: headY - canvasHeight / 2 / scale,
    scale,
  }
}

export function lerpViewport(
  current: { x: number; y: number; scale: number },
  target: { x: number; y: number; scale: number },
  t: number
): { x: number; y: number; scale: number } {
  return {
    x: current.x + (target.x - current.x) * t,
    y: current.y + (target.y - current.y) * t,
    scale: current.scale + (target.scale - current.scale) * t,
  }
}

// Downsample segments for network broadcast (every Nth point)
export function compressSegments(segments: Position[], maxPoints: number = 80): Position[] {
  if (segments.length <= maxPoints) return segments
  const step = segments.length / maxPoints
  const result: Position[] = [segments[0]] // always include head
  for (let i = 1; i < maxPoints - 1; i++) {
    result.push(segments[Math.floor(i * step)])
  }
  result.push(segments[segments.length - 1]) // always include tail
  return result
}

// Reconstruct full segment chain from compressed points
export function decompressSegments(compressed: Position[], targetCount: number): Position[] {
  if (compressed.length >= targetCount || compressed.length < 2) return compressed
  const result: Position[] = []
  const totalDist = compressed.reduce((sum, p, i) => {
    if (i === 0) return 0
    return sum + distanceBetween(compressed[i - 1], p)
  }, 0)
  const segDist = totalDist / (targetCount - 1)

  let ci = 0
  let traveled = 0
  result.push(compressed[0])

  for (let i = 1; i < targetCount; i++) {
    let remaining = segDist
    while (remaining > 0 && ci < compressed.length - 1) {
      const d = distanceBetween(compressed[ci], compressed[ci + 1])
      const leftInSeg = d - traveled
      if (leftInSeg <= remaining) {
        remaining -= leftInSeg
        traveled = 0
        ci++
      } else {
        traveled += remaining
        const t = traveled / d
        result.push({
          x: compressed[ci].x + (compressed[ci + 1].x - compressed[ci].x) * t,
          y: compressed[ci].y + (compressed[ci + 1].y - compressed[ci].y) * t,
        })
        remaining = 0
      }
    }
    if (result.length <= i) {
      result.push(compressed[compressed.length - 1])
    }
  }

  return result
}
