export type Grid = number[][]

export const GRID_SIZE = 4

export function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0))
}

export function addRandomTile(grid: Grid): Grid {
  const empty: [number, number][] = []
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 0) empty.push([r, c])
    }
  }
  if (empty.length === 0) return grid

  const newGrid = grid.map((row) => [...row])
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]
  newGrid[r][c] = Math.random() < 0.9 ? 2 : 4
  return newGrid
}

function mergeRow(row: number[]): { row: number[]; score: number } {
  const filtered = row.filter((v) => v !== 0)
  let score = 0
  const merged: number[] = []
  let i = 0
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      merged.push(filtered[i] * 2)
      score += filtered[i] * 2
      i += 2
    } else {
      merged.push(filtered[i])
      i++
    }
  }
  while (merged.length < GRID_SIZE) merged.push(0)
  return { row: merged, score }
}

export type Direction = 'left' | 'right' | 'up' | 'down'

export function move(
  grid: Grid,
  direction: Direction
): { grid: Grid; score: number; moved: boolean } {
  let totalScore = 0
  let newGrid = grid.map((row) => [...row])

  const rotateRight = (g: Grid): Grid =>
    Array.from({ length: GRID_SIZE }, (_, r) =>
      Array.from({ length: GRID_SIZE }, (_, c) => g[GRID_SIZE - 1 - c][r])
    )
  const rotateLeft = (g: Grid): Grid =>
    Array.from({ length: GRID_SIZE }, (_, r) =>
      Array.from({ length: GRID_SIZE }, (_, c) => g[c][GRID_SIZE - 1 - r])
    )

  // Normalize: always process as "left"
  if (direction === 'right') newGrid = rotateRight(rotateRight(newGrid))
  if (direction === 'up') newGrid = rotateLeft(newGrid)
  if (direction === 'down') newGrid = rotateRight(newGrid)

  newGrid = newGrid.map((row) => {
    const { row: newRow, score } = mergeRow(row)
    totalScore += score
    return newRow
  })

  if (direction === 'right') newGrid = rotateRight(rotateRight(newGrid))
  if (direction === 'up') newGrid = rotateRight(newGrid)
  if (direction === 'down') newGrid = rotateLeft(newGrid)

  // Re-check moved after rotations
  const movedFinal = grid.some((row, r) => row.some((v, c) => v !== newGrid[r][c]))

  return { grid: newGrid, score: totalScore, moved: movedFinal }
}

export function isGameOver(grid: Grid): boolean {
  // Check for empty cells
  if (grid.some((row) => row.some((v) => v === 0))) return false
  // Check for possible merges
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (c + 1 < GRID_SIZE && grid[r][c] === grid[r][c + 1]) return false
      if (r + 1 < GRID_SIZE && grid[r][c] === grid[r + 1][c]) return false
    }
  }
  return true
}

export function hasWon(grid: Grid): boolean {
  return grid.some((row) => row.some((v) => v >= 2048))
}

export function getMaxTile(grid: Grid): number {
  return Math.max(...grid.flat())
}
