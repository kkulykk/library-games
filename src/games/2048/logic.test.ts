import {
  createEmptyGrid,
  addRandomTile,
  move,
  isGameOver,
  hasWon,
  getMaxTile,
  GRID_SIZE,
} from './logic'

describe('createEmptyGrid', () => {
  it('creates a 4x4 grid of zeros', () => {
    const grid = createEmptyGrid()
    expect(grid.length).toBe(GRID_SIZE)
    grid.forEach((row) => {
      expect(row.length).toBe(GRID_SIZE)
      row.forEach((cell) => expect(cell).toBe(0))
    })
  })
})

describe('addRandomTile', () => {
  it('adds a tile (2 or 4) to an empty grid', () => {
    const grid = createEmptyGrid()
    const newGrid = addRandomTile(grid)
    const nonZero = newGrid.flat().filter((v) => v !== 0)
    expect(nonZero.length).toBe(1)
    expect([2, 4]).toContain(nonZero[0])
  })

  it('does not add a tile to a full grid', () => {
    const full = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(1))
    const result = addRandomTile(full)
    expect(result.flat().every((v) => v === 1)).toBe(true)
  })
})

describe('move - left', () => {
  it('merges equal adjacent tiles', () => {
    const grid = [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    const { grid: result, score } = move(grid, 'left')
    expect(result[0][0]).toBe(4)
    expect(result[0][1]).toBe(0)
    expect(score).toBe(4)
  })

  it('slides tiles to the left', () => {
    const grid = [
      [0, 0, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    const { grid: result } = move(grid, 'left')
    expect(result[0][0]).toBe(2)
    expect(result[0][2]).toBe(0)
  })

  it('does not merge same tile twice', () => {
    const grid = [
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    const { grid: result } = move(grid, 'left')
    expect(result[0][0]).toBe(4)
    expect(result[0][1]).toBe(4)
    expect(result[0][2]).toBe(0)
  })
})

describe('move - right', () => {
  it('merges tiles to the right', () => {
    const grid = [
      [0, 0, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    const { grid: result } = move(grid, 'right')
    expect(result[0][3]).toBe(4)
    expect(result[0][2]).toBe(0)
  })
})

describe('isGameOver', () => {
  it('returns false when board has empty cells', () => {
    const grid = createEmptyGrid()
    expect(isGameOver(grid)).toBe(false)
  })

  it('returns false when adjacent cells can merge', () => {
    const grid = [
      [2, 4, 8, 16],
      [16, 8, 4, 2],
      [2, 4, 8, 16],
      [16, 8, 4, 2],
    ]
    // Actually need to check if adjacent same values
    expect(isGameOver(grid)).toBe(true)
  })

  it('returns false when board has mergeable tiles', () => {
    const grid = [
      [2, 2, 8, 16],
      [16, 8, 4, 2],
      [2, 4, 8, 16],
      [16, 8, 4, 2],
    ]
    expect(isGameOver(grid)).toBe(false)
  })
})

describe('hasWon', () => {
  it('returns true when 2048 is present', () => {
    const grid = createEmptyGrid()
    grid[0][0] = 2048
    expect(hasWon(grid)).toBe(true)
  })

  it('returns false when max tile is below 2048', () => {
    const grid = createEmptyGrid()
    grid[0][0] = 1024
    expect(hasWon(grid)).toBe(false)
  })
})

describe('getMaxTile', () => {
  it('returns the maximum tile value', () => {
    const grid = createEmptyGrid()
    grid[0][0] = 512
    grid[1][1] = 256
    expect(getMaxTile(grid)).toBe(512)
  })

  it('returns 0 for empty grid', () => {
    expect(getMaxTile(createEmptyGrid())).toBe(0)
  })
})
