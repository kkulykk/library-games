import { createEmptyBoard, placeMines, revealCell, toggleFlag, checkWin, countFlags } from './logic'

describe('createEmptyBoard', () => {
  it('creates a board of the correct dimensions', () => {
    const board = createEmptyBoard(9, 9)
    expect(board.length).toBe(9)
    expect(board[0].length).toBe(9)
  })

  it('all cells are hidden and have no mines', () => {
    const board = createEmptyBoard(5, 5)
    board.forEach((row) =>
      row.forEach((cell) => {
        expect(cell.isMine).toBe(false)
        expect(cell.state).toBe('hidden')
        expect(cell.adjacentMines).toBe(0)
      })
    )
  })
})

describe('placeMines', () => {
  it('places the correct number of mines', () => {
    const board = createEmptyBoard(9, 9)
    const mined = placeMines(board, 10, 4, 4)
    const mineCount = mined.flat().filter((c) => c.isMine).length
    expect(mineCount).toBe(10)
  })

  it('does not place mines in the safe zone around first click', () => {
    const board = createEmptyBoard(9, 9)
    const mined = placeMines(board, 10, 0, 0)
    // Cells at (0,0), (0,1), (1,0), (1,1) must be mine-free
    expect(mined[0][0].isMine).toBe(false)
    expect(mined[0][1].isMine).toBe(false)
    expect(mined[1][0].isMine).toBe(false)
    expect(mined[1][1].isMine).toBe(false)
  })

  it('calculates adjacent mine counts', () => {
    // Place one mine and check neighbors
    const empty = createEmptyBoard(3, 3)
    // Force a mine at center by using a location far from safe
    const withMines = placeMines(empty, 1, 0, 0)
    const totalAdjacent = withMines.flat().reduce((sum, c) => sum + c.adjacentMines, 0)
    expect(totalAdjacent).toBeGreaterThan(0)
  })
})

describe('revealCell', () => {
  it('reveals a single cell', () => {
    const board = createEmptyBoard(3, 3)
    const revealed = revealCell(board, 1, 1)
    expect(revealed[1][1].state).toBe('revealed')
  })

  it('does not reveal already-flagged cells', () => {
    let board = createEmptyBoard(3, 3)
    board = toggleFlag(board, 0, 0)
    const revealed = revealCell(board, 0, 0)
    expect(revealed[0][0].state).toBe('flagged')
  })
})

describe('toggleFlag', () => {
  it('flags a hidden cell', () => {
    const board = createEmptyBoard(3, 3)
    const flagged = toggleFlag(board, 0, 0)
    expect(flagged[0][0].state).toBe('flagged')
  })

  it('unflags a flagged cell', () => {
    let board = createEmptyBoard(3, 3)
    board = toggleFlag(board, 0, 0)
    board = toggleFlag(board, 0, 0)
    expect(board[0][0].state).toBe('hidden')
  })
})

describe('checkWin', () => {
  it('returns false when mines are not all revealed', () => {
    const board = createEmptyBoard(2, 2)
    expect(checkWin(board)).toBe(false)
  })

  it('returns true when all non-mine cells are revealed', () => {
    let board = createEmptyBoard(2, 2)
    // No mines, just reveal all
    board = revealCell(board, 0, 0)
    board = revealCell(board, 0, 1)
    board = revealCell(board, 1, 0)
    board = revealCell(board, 1, 1)
    expect(checkWin(board)).toBe(true)
  })
})

describe('countFlags', () => {
  it('counts flags correctly', () => {
    let board = createEmptyBoard(3, 3)
    board = toggleFlag(board, 0, 0)
    board = toggleFlag(board, 1, 1)
    expect(countFlags(board)).toBe(2)
  })

  it('returns 0 when no flags', () => {
    const board = createEmptyBoard(3, 3)
    expect(countFlags(board)).toBe(0)
  })
})
