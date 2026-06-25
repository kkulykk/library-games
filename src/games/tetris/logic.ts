// =========================================================================
// TETRIS ENGINE — pure logic. No React, no DOM.
// Reducer-based state machine: every action is `(state, action) => state`.
// =========================================================================

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
export type Cell = PieceType | null
export type Board = Cell[][]
export type Status = 'playing' | 'paused' | 'over'

export interface Piece {
  type: PieceType
  m: number[][]
  x: number
  y: number
}

export interface GameState {
  board: Board
  piece: Piece | null
  queue: PieceType[]
  hold: PieceType | null
  canHold: boolean
  score: number
  lines: number
  level: number
  baseLevel: number
  status: Status
}

export type Action =
  | { type: 'init'; startLevel?: number }
  | { type: 'left' }
  | { type: 'right' }
  | { type: 'cw' }
  | { type: 'ccw' }
  | { type: 'soft' }
  | { type: 'hard' }
  | { type: 'tick' }
  | { type: 'hold' }
  | { type: 'pause' }
  | { type: 'resume' }

export const COLS = 10
export const ROWS = 20
// Back-compat aliases.
export const BOARD_WIDTH = COLS
export const BOARD_HEIGHT = ROWS

// Piece matrices (1 = filled). Rotations are derived by rotating the matrix.
export const SHAPES: Record<PieceType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
}

// Accent palette: shared lightness/chroma, hue varies — fits the design system.
export const COLORS: Record<PieceType, string> = {
  I: 'oklch(0.78 0.15 200)',
  O: 'oklch(0.83 0.16 95)',
  T: 'oklch(0.72 0.18 305)',
  S: 'oklch(0.78 0.16 150)',
  Z: 'oklch(0.7 0.19 25)',
  J: 'oklch(0.72 0.15 255)',
  L: 'oklch(0.77 0.16 55)',
}

export const TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
const LINE_SCORES = [0, 100, 300, 500, 800]

export const emptyBoard = (): Board =>
  Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null))

export function rotateMatrix(m: number[][], dir: number): number[][] {
  const n = m.length
  const out = Array.from({ length: n }, () => Array<number>(n).fill(0))
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (dir > 0)
        out[x][n - 1 - y] = m[y][x] // clockwise
      else out[n - 1 - x][y] = m[y][x] // counter-clockwise
    }
  }
  return out
}

export function newBag(): PieceType[] {
  const bag = TYPES.slice()
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

export function makePiece(type: PieceType): Piece {
  const m = SHAPES[type]
  const x = Math.floor((COLS - m[0].length) / 2)
  return { type, m, x, y: 0 }
}

export function cells(piece: Piece): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = []
  const { m, x, y } = piece
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (m[r][c]) out.push({ x: x + c, y: y + r })
    }
  }
  return out
}

export function collides(board: Board, piece: Piece): boolean {
  for (const { x, y } of cells(piece)) {
    if (x < 0 || x >= COLS || y >= ROWS) return true
    if (y >= 0 && board[y][x]) return true
  }
  return false
}

export function ghost(board: Board, piece: Piece): Piece {
  let p = { ...piece }
  while (!collides(board, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 }
  return p
}

export function merge(board: Board, piece: Piece): Board {
  const b = board.map((row) => row.slice())
  for (const { x, y } of cells(piece)) {
    if (y >= 0) b[y][x] = piece.type
  }
  return b
}

export function clearLines(board: Board): { board: Board; cleared: number } {
  const kept = board.filter((row) => row.some((c) => !c))
  const n = ROWS - kept.length
  const top = Array.from({ length: n }, () => Array<Cell>(COLS).fill(null))
  return { board: top.concat(kept), cleared: n }
}

function refill(queue: PieceType[]): PieceType[] {
  let q = queue.slice()
  while (q.length < 7) q = q.concat(newBag())
  return q
}

// Spawn next piece from the queue. Sets status='over' if it can't appear.
function spawn(state: GameState): GameState {
  const queue = refill(state.queue)
  const piece = makePiece(queue[0])
  const rest = queue.slice(1)
  if (collides(state.board, piece)) {
    return { ...state, piece, queue: rest, status: 'over' }
  }
  return { ...state, piece, queue: rest, canHold: true }
}

export function init(startLevel = 0): GameState {
  const base: GameState = {
    board: emptyBoard(),
    piece: null,
    queue: [],
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: startLevel,
    baseLevel: startLevel,
    status: 'playing',
  }
  return spawn(base)
}

// Lock the current piece, clear lines, score, and spawn the next.
function lock(state: GameState): GameState {
  if (!state.piece) return state
  const merged = merge(state.board, state.piece)
  const { board, cleared } = clearLines(merged)
  const lines = state.lines + cleared
  const level = state.baseLevel + Math.floor(lines / 10)
  const score = state.score + LINE_SCORES[cleared] * (state.level + 1)
  return spawn({ ...state, board, lines, level, score, piece: null })
}

function tryMove(state: GameState, dx: number, dy: number): GameState | null {
  if (!state.piece) return null
  const moved = { ...state.piece, x: state.piece.x + dx, y: state.piece.y + dy }
  if (!collides(state.board, moved)) return { ...state, piece: moved }
  return null
}

function tryRotate(state: GameState, dir: number): GameState | null {
  if (!state.piece) return null
  const m = rotateMatrix(state.piece.m, dir)
  const kicks = [0, -1, 1, -2, 2]
  for (const dx of kicks) {
    const cand = { ...state.piece, m, x: state.piece.x + dx }
    if (!collides(state.board, cand)) return { ...state, piece: cand }
  }
  return null
}

export function reduce(state: GameState | null, action: Action): GameState | null {
  if (action.type === 'init') return init(action.startLevel)
  if (!state || state.status === 'over') return state

  if (action.type === 'pause') {
    return { ...state, status: state.status === 'paused' ? 'playing' : 'paused' }
  }
  if (action.type === 'resume') {
    return state.status === 'paused' ? { ...state, status: 'playing' } : state
  }
  if (state.status !== 'playing' || !state.piece) return state

  switch (action.type) {
    case 'left':
      return tryMove(state, -1, 0) || state
    case 'right':
      return tryMove(state, 1, 0) || state
    case 'cw':
      return tryRotate(state, 1) || state
    case 'ccw':
      return tryRotate(state, -1) || state

    case 'tick':
    case 'soft': {
      const down = tryMove(state, 0, 1)
      if (down) {
        return action.type === 'soft' ? { ...down, score: down.score + 1 } : down
      }
      return lock(state)
    }

    case 'hard': {
      const g = ghost(state.board, state.piece)
      const dist = g.y - state.piece.y
      return lock({ ...state, piece: g, score: state.score + dist * 2 })
    }

    case 'hold': {
      if (!state.canHold) return state
      const curType = state.piece.type
      if (state.hold) {
        const piece = makePiece(state.hold)
        if (collides(state.board, piece)) return state
        return { ...state, piece, hold: curType, canHold: false }
      }
      const spawned = spawn({ ...state, hold: curType })
      return { ...spawned, canHold: false }
    }

    default:
      return state
  }
}

export function gravityMs(level: number): number {
  return Math.max(70, Math.round(800 * Math.pow(0.82, level)))
}
