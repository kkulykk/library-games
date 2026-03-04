export type Player = 'X' | 'O'
export type Cell = Player | null
export type Board = Cell[] // 9-element array representing a 3×3 grid

export interface GameState {
  board: Board
  currentPlayer: Player
  winner: Player | null
  isDraw: boolean
  winningLine: number[] | null
}

export const WINNING_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // cols
  [0, 4, 8],
  [2, 4, 6], // diagonals
]

export function createInitialState(): GameState {
  return {
    board: Array(9).fill(null) as Cell[],
    currentPlayer: 'X',
    winner: null,
    isDraw: false,
    winningLine: null,
  }
}

export function checkWinner(board: Board): { winner: Player | null; line: number[] | null } {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as Player, line }
    }
  }
  return { winner: null, line: null }
}

export function checkDraw(board: Board): boolean {
  return board.every((cell) => cell !== null)
}

export function makeMove(state: GameState, index: number): GameState {
  if (state.board[index] !== null || state.winner !== null || state.isDraw) {
    return state
  }

  const newBoard = [...state.board] as Board
  newBoard[index] = state.currentPlayer

  const { winner, line } = checkWinner(newBoard)
  const isDraw = !winner && checkDraw(newBoard)

  return {
    board: newBoard,
    currentPlayer: state.currentPlayer === 'X' ? 'O' : 'X',
    winner,
    isDraw,
    winningLine: line,
  }
}

// Minimax for perfect AI play
function minimax(board: Board, isMaximizing: boolean, aiPlayer: Player): number {
  const humanPlayer: Player = aiPlayer === 'O' ? 'X' : 'O'
  const { winner } = checkWinner(board)

  if (winner === aiPlayer) return 10
  if (winner === humanPlayer) return -10
  if (checkDraw(board)) return 0

  const scores: number[] = []
  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue
    const next = [...board] as Board
    next[i] = isMaximizing ? aiPlayer : humanPlayer
    scores.push(minimax(next, !isMaximizing, aiPlayer))
  }

  return isMaximizing ? Math.max(...scores) : Math.min(...scores)
}

export function getAIMove(board: Board, aiPlayer: Player): number {
  let bestScore = -Infinity
  let bestMove = -1

  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue
    const next = [...board] as Board
    next[i] = aiPlayer
    const score = minimax(next, false, aiPlayer)
    if (score > bestScore) {
      bestScore = score
      bestMove = i
    }
  }

  return bestMove
}

export function isGameOver(state: GameState): boolean {
  return state.winner !== null || state.isDraw
}
