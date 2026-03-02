export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

export const BOARD_WIDTH = 10
export const BOARD_HEIGHT = 20

export type Board = (string | null)[][]

export interface Tetromino {
  type: TetrominoType
  shape: number[][]
  x: number
  y: number
}

export const TETROMINOES: Record<TetrominoType, { shape: number[][]; color: string }> = {
  I: { shape: [[1, 1, 1, 1]], color: '#06b6d4' },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: '#eab308',
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: '#a855f7',
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: '#22c55e',
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: '#ef4444',
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: '#3b82f6',
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: '#f97316',
  },
}

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null))
}

export function randomTetromino(): Tetromino {
  const types: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
  const type = types[Math.floor(Math.random() * types.length)]
  const shape = TETROMINOES[type].shape
  return {
    type,
    shape,
    x: Math.floor((BOARD_WIDTH - shape[0].length) / 2),
    y: 0,
  }
}

export function rotate(shape: number[][]): number[][] {
  const rows = shape.length
  const cols = shape[0].length
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (_, r) => shape[rows - 1 - r][c])
  )
}

export function isValidPosition(board: Board, tetromino: Tetromino): boolean {
  for (let r = 0; r < tetromino.shape.length; r++) {
    for (let c = 0; c < tetromino.shape[r].length; c++) {
      if (!tetromino.shape[r][c]) continue
      const boardR = tetromino.y + r
      const boardC = tetromino.x + c
      if (boardC < 0 || boardC >= BOARD_WIDTH || boardR >= BOARD_HEIGHT) return false
      if (boardR >= 0 && board[boardR][boardC] !== null) return false
    }
  }
  return true
}

export function placeTetromino(board: Board, tetromino: Tetromino): Board {
  const newBoard = board.map((row) => [...row])
  const color = TETROMINOES[tetromino.type].color
  for (let r = 0; r < tetromino.shape.length; r++) {
    for (let c = 0; c < tetromino.shape[r].length; c++) {
      if (!tetromino.shape[r][c]) continue
      const boardR = tetromino.y + r
      const boardC = tetromino.x + c
      if (boardR >= 0) newBoard[boardR][boardC] = color
    }
  }
  return newBoard
}

export function clearLines(board: Board): { board: Board; linesCleared: number } {
  const newBoard = board.filter((row) => row.some((cell) => cell === null))
  const linesCleared = BOARD_HEIGHT - newBoard.length
  const emptyRows = Array.from({ length: linesCleared }, () => Array(BOARD_WIDTH).fill(null))
  return { board: [...emptyRows, ...newBoard], linesCleared }
}

export function calcScore(linesCleared: number, level: number): number {
  const basePoints = [0, 100, 300, 500, 800]
  return (basePoints[linesCleared] ?? 0) * (level + 1)
}

export function calcLevel(totalLines: number): number {
  return Math.floor(totalLines / 10)
}

export function dropSpeed(level: number): number {
  return Math.max(100, 1000 - level * 100)
}
