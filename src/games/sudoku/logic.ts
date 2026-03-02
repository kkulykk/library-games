export type SudokuGrid = (number | null)[][]
export type Difficulty = 'easy' | 'medium' | 'hard'

export function isValidPlacement(grid: SudokuGrid, row: number, col: number, num: number): boolean {
  // Check row
  if (grid[row].includes(num)) return false
  // Check column
  if (grid.some((r) => r[col] === num)) return false
  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3
  const boxCol = Math.floor(col / 3) * 3
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] === num) return false
    }
  }
  return true
}

export function solveSudoku(grid: SudokuGrid): SudokuGrid | null {
  const clone = grid.map((row) => [...row])
  if (backtrack(clone)) return clone
  return null
}

function backtrack(grid: SudokuGrid): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] !== null) continue
      for (let num = 1; num <= 9; num++) {
        if (isValidPlacement(grid, row, col, num)) {
          grid[row][col] = num
          if (backtrack(grid)) return true
          grid[row][col] = null
        }
      }
      return false
    }
  }
  return true
}

const CLUES: Record<Difficulty, number> = {
  easy: 36,
  medium: 28,
  hard: 22,
}

export function generatePuzzle(difficulty: Difficulty): {
  puzzle: SudokuGrid
  solution: SudokuGrid
} {
  // Start with a solved board
  const solution: SudokuGrid = Array.from({ length: 9 }, () => Array(9).fill(null))
  fillBoard(solution)

  const puzzle = solution.map((row) => [...row])
  const clues = CLUES[difficulty]
  const total = 81
  let toRemove = total - clues

  const positions = shuffle(Array.from({ length: total }, (_, i) => i))
  for (const pos of positions) {
    if (toRemove <= 0) break
    const r = Math.floor(pos / 9)
    const c = pos % 9
    puzzle[r][c] = null
    toRemove--
  }

  return { puzzle, solution }
}

function fillBoard(grid: SudokuGrid): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] !== null) continue
      const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])
      for (const num of nums) {
        if (isValidPlacement(grid, row, col, num)) {
          grid[row][col] = num
          if (fillBoard(grid)) return true
          grid[row][col] = null
        }
      }
      return false
    }
  }
  return true
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function isBoardComplete(grid: SudokuGrid): boolean {
  return grid.every((row) => row.every((cell) => cell !== null))
}

export function isBoardValid(grid: SudokuGrid): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const val = grid[row][col]
      if (val === null) continue
      // Temporarily blank the cell and check placement
      grid[row][col] = null
      const valid = isValidPlacement(grid, row, col, val)
      grid[row][col] = val
      if (!valid) return false
    }
  }
  return true
}
