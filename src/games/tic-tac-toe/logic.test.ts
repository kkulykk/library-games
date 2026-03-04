import {
  createInitialState,
  makeMove,
  checkWinner,
  checkDraw,
  getAIMove,
  isGameOver,
  type Board,
  type Cell,
} from './logic'

describe('createInitialState', () => {
  it('creates an empty board', () => {
    const state = createInitialState()
    expect(state.board).toHaveLength(9)
    state.board.forEach((cell) => expect(cell).toBeNull())
  })

  it('starts with player X', () => {
    const state = createInitialState()
    expect(state.currentPlayer).toBe('X')
  })

  it('has no winner or draw at start', () => {
    const state = createInitialState()
    expect(state.winner).toBeNull()
    expect(state.isDraw).toBe(false)
    expect(state.winningLine).toBeNull()
  })
})

describe('checkWinner', () => {
  it('detects row win', () => {
    const board: Board = ['X', 'X', 'X', null, null, null, null, null, null]
    const { winner, line } = checkWinner(board)
    expect(winner).toBe('X')
    expect(line).toEqual([0, 1, 2])
  })

  it('detects column win', () => {
    const board: Board = ['O', null, null, 'O', null, null, 'O', null, null]
    const { winner, line } = checkWinner(board)
    expect(winner).toBe('O')
    expect(line).toEqual([0, 3, 6])
  })

  it('detects diagonal win', () => {
    const board: Board = ['X', null, null, null, 'X', null, null, null, 'X']
    const { winner, line } = checkWinner(board)
    expect(winner).toBe('X')
    expect(line).toEqual([0, 4, 8])
  })

  it('detects anti-diagonal win', () => {
    const board: Board = [null, null, 'O', null, 'O', null, 'O', null, null]
    const { winner, line } = checkWinner(board)
    expect(winner).toBe('O')
    expect(line).toEqual([2, 4, 6])
  })

  it('returns null when no winner', () => {
    const board: Board = ['X', 'O', null, null, null, null, null, null, null]
    const { winner, line } = checkWinner(board)
    expect(winner).toBeNull()
    expect(line).toBeNull()
  })
})

describe('checkDraw', () => {
  it('returns true when all cells are filled with no winner', () => {
    const board: Board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']
    expect(checkDraw(board)).toBe(true)
  })

  it('returns false when board has empty cells', () => {
    const board: Board = ['X', 'O', null, null, null, null, null, null, null]
    expect(checkDraw(board)).toBe(false)
  })
})

describe('makeMove', () => {
  it('places the current player mark on the board', () => {
    const state = createInitialState()
    const next = makeMove(state, 4)
    expect(next.board[4]).toBe('X')
  })

  it('switches the current player after a move', () => {
    const state = createInitialState()
    const next = makeMove(state, 0)
    expect(next.currentPlayer).toBe('O')
  })

  it('ignores a move on an occupied cell', () => {
    let state = createInitialState()
    state = makeMove(state, 0)
    const afterInvalid = makeMove(state, 0)
    expect(afterInvalid).toBe(state) // same reference
  })

  it('ignores moves after game is over', () => {
    let state = createInitialState()
    // X wins top row
    state = makeMove(state, 0) // X
    state = makeMove(state, 3) // O
    state = makeMove(state, 1) // X
    state = makeMove(state, 4) // O
    state = makeMove(state, 2) // X wins
    const afterWin = makeMove(state, 8)
    expect(afterWin).toBe(state)
  })

  it('detects a win', () => {
    let state = createInitialState()
    state = makeMove(state, 0) // X
    state = makeMove(state, 3) // O
    state = makeMove(state, 1) // X
    state = makeMove(state, 4) // O
    state = makeMove(state, 2) // X wins
    expect(state.winner).toBe('X')
    expect(state.winningLine).toEqual([0, 1, 2])
  })

  it('detects a draw', () => {
    // Draw: X X O / O O X / X O X  — sequence verified to produce no winner
    let state = createInitialState()
    const moves = [0, 4, 1, 2, 6, 3, 5, 7, 8] // alternating X/O
    for (const m of moves) state = makeMove(state, m)
    expect(state.winner).toBeNull()
    expect(state.isDraw).toBe(true)
  })
})

describe('getAIMove', () => {
  it('returns a valid empty cell index', () => {
    const board: Board = Array(9).fill(null) as Cell[]
    const move = getAIMove(board, 'O')
    expect(move).toBeGreaterThanOrEqual(0)
    expect(move).toBeLessThan(9)
    expect(board[move]).toBeNull()
  })

  it('blocks opponent from winning', () => {
    // Near-endgame: X threatens diagonal (0,4,8). O must block at 8; blocking leads to draw.
    // Board: X O X / X X O / O _ _  (two empty cells: 7 and 8)
    const board: Board = ['X', 'O', 'X', 'X', 'X', 'O', 'O', null, null]
    const move = getAIMove(board, 'O')
    expect(move).toBe(8)
  })

  it('takes the winning move', () => {
    // O has row 1 almost complete (indices 3 and 4); playing at 5 wins immediately.
    const board: Board = ['X', 'X', null, 'O', 'O', null, 'X', null, null]
    const move = getAIMove(board, 'O')
    expect(move).toBe(5)
  })

  it('returns -1 when no moves available', () => {
    const board: Board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']
    const move = getAIMove(board, 'O')
    expect(move).toBe(-1)
  })
})

describe('isGameOver', () => {
  it('returns false when game is ongoing', () => {
    const state = createInitialState()
    expect(isGameOver(state)).toBe(false)
  })

  it('returns true when there is a winner', () => {
    let state = createInitialState()
    state = makeMove(state, 0)
    state = makeMove(state, 3)
    state = makeMove(state, 1)
    state = makeMove(state, 4)
    state = makeMove(state, 2)
    expect(isGameOver(state)).toBe(true)
  })

  it('returns true on a draw', () => {
    let state = createInitialState()
    const moves = [0, 4, 2, 1, 7, 3, 5, 6, 8]
    for (const m of moves) state = makeMove(state, m)
    expect(isGameOver(state)).toBe(true)
  })
})
