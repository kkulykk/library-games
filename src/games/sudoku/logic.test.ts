import {
  isValidPlacement,
  solveSudoku,
  isBoardComplete,
  isBoardValid,
  generatePuzzle,
  type SudokuGrid,
} from './logic'

const EMPTY_GRID: SudokuGrid = Array.from({ length: 9 }, () => Array(9).fill(null))

const VALID_GRID: SudokuGrid = [
  [5, 3, null, null, 7, null, null, null, null],
  [6, null, null, 1, 9, 5, null, null, null],
  [null, 9, 8, null, null, null, null, 6, null],
  [8, null, null, null, 6, null, null, null, 3],
  [4, null, null, 8, null, 3, null, null, 1],
  [7, null, null, null, 2, null, null, null, 6],
  [null, 6, null, null, null, null, 2, 8, null],
  [null, null, null, 4, 1, 9, null, null, 5],
  [null, null, null, null, 8, null, null, 7, 9],
]

describe('isValidPlacement', () => {
  it('returns false when number already in row', () => {
    const grid = EMPTY_GRID.map((r) => [...r])
    grid[0][0] = 5
    expect(isValidPlacement(grid, 0, 4, 5)).toBe(false)
  })

  it('returns false when number already in column', () => {
    const grid = EMPTY_GRID.map((r) => [...r])
    grid[0][0] = 5
    expect(isValidPlacement(grid, 4, 0, 5)).toBe(false)
  })

  it('returns false when number already in 3x3 box', () => {
    const grid = EMPTY_GRID.map((r) => [...r])
    grid[0][0] = 5
    expect(isValidPlacement(grid, 1, 1, 5)).toBe(false)
  })

  it('returns true when placement is valid', () => {
    const grid = EMPTY_GRID.map((r) => [...r])
    expect(isValidPlacement(grid, 0, 0, 5)).toBe(true)
  })
})

describe('solveSudoku', () => {
  it('solves a valid puzzle', () => {
    const solved = solveSudoku(VALID_GRID)
    expect(solved).not.toBeNull()
    expect(isBoardComplete(solved!)).toBe(true)
  })

  it('returns a valid solution', () => {
    const solved = solveSudoku(VALID_GRID)
    expect(isBoardValid(solved!)).toBe(true)
  })
})

describe('isBoardComplete', () => {
  it('returns false for empty board', () => {
    expect(isBoardComplete(EMPTY_GRID)).toBe(false)
  })

  it('returns true when all cells filled', () => {
    const full: SudokuGrid = Array.from({ length: 9 }, () => Array(9).fill(1))
    expect(isBoardComplete(full)).toBe(true)
  })
})

describe('isBoardValid', () => {
  it('returns true for an empty board', () => {
    expect(isBoardValid(EMPTY_GRID)).toBe(true)
  })

  it('returns false for an invalid board', () => {
    const invalid: SudokuGrid = EMPTY_GRID.map((r) => [...r])
    invalid[0][0] = 5
    invalid[0][1] = 5
    expect(isBoardValid(invalid)).toBe(false)
  })
})

describe('generatePuzzle', () => {
  it('generates a puzzle with some cells empty', () => {
    const { puzzle } = generatePuzzle('easy')
    const emptyCells = puzzle.flat().filter((c) => c === null).length
    expect(emptyCells).toBeGreaterThan(0)
  })

  it('generates a puzzle with a valid solution', () => {
    const { solution } = generatePuzzle('easy')
    expect(isBoardComplete(solution)).toBe(true)
    expect(isBoardValid(solution)).toBe(true)
  })

  it('hard difficulty has more empty cells than easy', () => {
    const { puzzle: easy } = generatePuzzle('easy')
    const { puzzle: hard } = generatePuzzle('hard')
    const easyEmpty = easy.flat().filter((c) => c === null).length
    const hardEmpty = hard.flat().filter((c) => c === null).length
    expect(hardEmpty).toBeGreaterThan(easyEmpty)
  })
})
