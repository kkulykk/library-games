import {
  createEmptyBoard,
  randomTetromino,
  rotate,
  isValidPosition,
  placeTetromino,
  clearLines,
  calcScore,
  calcLevel,
  dropSpeed,
  BOARD_WIDTH,
  BOARD_HEIGHT,
} from './logic'

describe('createEmptyBoard', () => {
  it('creates a board of correct dimensions', () => {
    const board = createEmptyBoard()
    expect(board.length).toBe(BOARD_HEIGHT)
    expect(board[0].length).toBe(BOARD_WIDTH)
  })

  it('all cells are null', () => {
    const board = createEmptyBoard()
    board.forEach((row) => row.forEach((cell) => expect(cell).toBeNull()))
  })
})

describe('randomTetromino', () => {
  it('returns a tetromino with valid shape', () => {
    const t = randomTetromino()
    expect(t.shape.length).toBeGreaterThan(0)
    expect(t.shape[0].length).toBeGreaterThan(0)
  })

  it('starts near the top of the board', () => {
    const t = randomTetromino()
    expect(t.y).toBe(0)
  })
})

describe('rotate', () => {
  it('rotates an L-shaped tetromino 90 degrees', () => {
    const shape = [
      [1, 0],
      [1, 0],
      [1, 1],
    ]
    const rotated = rotate(shape)
    expect(rotated.length).toBe(2) // cols become rows
    expect(rotated[0].length).toBe(3)
  })

  it('4 rotations return to original shape', () => {
    const shape = [
      [1, 0, 0],
      [1, 1, 1],
    ]
    let s = shape
    for (let i = 0; i < 4; i++) s = rotate(s)
    expect(s).toEqual(shape)
  })
})

describe('isValidPosition', () => {
  it('returns true for a tetromino in empty board', () => {
    const board = createEmptyBoard()
    const t = randomTetromino()
    expect(isValidPosition(board, t)).toBe(true)
  })

  it('returns false when tetromino is out of bounds left', () => {
    const board = createEmptyBoard()
    const t = { ...randomTetromino(), x: -5 }
    expect(isValidPosition(board, t)).toBe(false)
  })

  it('returns false when tetromino overlaps placed pieces', () => {
    const board = createEmptyBoard()
    board[0][5] = '#ff0000'
    const t = { ...randomTetromino(), x: 5, y: 0, shape: [[1]] }
    expect(isValidPosition(board, t)).toBe(false)
  })
})

describe('placeTetromino', () => {
  it('places the tetromino on the board', () => {
    const board = createEmptyBoard()
    const t = { ...randomTetromino(), x: 0, y: 0, shape: [[1, 1]] }
    const newBoard = placeTetromino(board, t)
    expect(newBoard[0][0]).not.toBeNull()
    expect(newBoard[0][1]).not.toBeNull()
  })
})

describe('clearLines', () => {
  it('clears full rows', () => {
    const board = createEmptyBoard()
    board[BOARD_HEIGHT - 1] = Array(BOARD_WIDTH).fill('#ff0000')
    const { board: cleared, linesCleared } = clearLines(board)
    expect(linesCleared).toBe(1)
    expect(cleared[BOARD_HEIGHT - 1].every((c) => c === null)).toBe(true)
  })

  it('does not clear partial rows', () => {
    const board = createEmptyBoard()
    board[BOARD_HEIGHT - 1][0] = '#ff0000' // Partial row
    const { linesCleared } = clearLines(board)
    expect(linesCleared).toBe(0)
  })
})

describe('calcScore', () => {
  it('gives more points for more lines at once', () => {
    expect(calcScore(4, 0)).toBeGreaterThan(calcScore(1, 0))
  })

  it('multiplies by level+1', () => {
    expect(calcScore(1, 1)).toBe(calcScore(1, 0) * 2)
  })

  it('returns 0 for 0 lines', () => {
    expect(calcScore(0, 0)).toBe(0)
  })
})

describe('calcLevel', () => {
  it('starts at level 0', () => {
    expect(calcLevel(0)).toBe(0)
  })

  it('advances level every 10 lines', () => {
    expect(calcLevel(10)).toBe(1)
    expect(calcLevel(20)).toBe(2)
  })
})

describe('dropSpeed', () => {
  it('decreases as level increases', () => {
    expect(dropSpeed(1)).toBeLessThan(dropSpeed(0))
  })

  it('does not go below 100ms', () => {
    expect(dropSpeed(100)).toBe(100)
  })
})
