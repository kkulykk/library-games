export type CellState = 'hidden' | 'revealed' | 'flagged'

export interface Cell {
  isMine: boolean
  adjacentMines: number
  state: CellState
}

export type Board = Cell[][]

export interface MinesweeperConfig {
  rows: number
  cols: number
  mines: number
}

export const CONFIGS: Record<string, MinesweeperConfig> = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 16, cols: 30, mines: 99 },
}

export function createEmptyBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      isMine: false,
      adjacentMines: 0,
      state: 'hidden' as CellState,
    }))
  )
}

export function placeMines(board: Board, mines: number, safeRow: number, safeCol: number): Board {
  const rows = board.length
  const cols = board[0].length
  const newBoard = board.map((row) => row.map((cell) => ({ ...cell })))
  let placed = 0

  while (placed < mines) {
    const r = Math.floor(Math.random() * rows)
    const c = Math.floor(Math.random() * cols)
    // Skip the safe first-click area (3x3 around it)
    if (Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1) continue
    if (newBoard[r][c].isMine) continue
    newBoard[r][c].isMine = true
    placed++
  }

  // Calculate adjacent mine counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (newBoard[r][c].isMine) continue
      let count = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr
          const nc = c + dc
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && newBoard[nr][nc].isMine) {
            count++
          }
        }
      }
      newBoard[r][c].adjacentMines = count
    }
  }

  return newBoard
}

export function revealCell(board: Board, row: number, col: number): Board {
  const rows = board.length
  const cols = board[0].length
  const newBoard = board.map((r) => r.map((c) => ({ ...c })))

  function floodFill(r: number, c: number) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return
    if (newBoard[r][c].state !== 'hidden') return
    newBoard[r][c].state = 'revealed'
    if (newBoard[r][c].adjacentMines === 0 && !newBoard[r][c].isMine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr !== 0 || dc !== 0) floodFill(r + dr, c + dc)
        }
      }
    }
  }

  floodFill(row, col)
  return newBoard
}

export function toggleFlag(board: Board, row: number, col: number): Board {
  const newBoard = board.map((r) => r.map((c) => ({ ...c })))
  const cell = newBoard[row][col]
  if (cell.state === 'hidden') cell.state = 'flagged'
  else if (cell.state === 'flagged') cell.state = 'hidden'
  return newBoard
}

export function checkWin(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell.isMine || cell.state === 'revealed'))
}

export function countFlags(board: Board): number {
  return board.flat().filter((c) => c.state === 'flagged').length
}
