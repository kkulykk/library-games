'use client'

import { useState, useCallback } from 'react'
import {
  createEmptyBoard,
  placeMines,
  revealCell,
  toggleFlag,
  checkWin,
  countFlags,
  CONFIGS,
  type Board,
  type MinesweeperConfig,
} from './logic'
import { cn } from '@/lib/utils'

type GameState = 'idle' | 'playing' | 'won' | 'lost'
type Difficulty = keyof typeof CONFIGS

const CELL_NUMBERS = ['', '1', '2', '3', '4', '5', '6', '7', '8']
const NUMBER_COLORS = [
  '',
  'text-blue-600',
  'text-green-600',
  'text-red-600',
  'text-purple-800',
  'text-red-800',
  'text-cyan-600',
  'text-black',
  'text-gray-500',
]

export function MinesweeperGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [config, setConfig] = useState<MinesweeperConfig>(CONFIGS.easy)
  const [board, setBoard] = useState<Board>(() =>
    createEmptyBoard(CONFIGS.easy.rows, CONFIGS.easy.cols)
  )
  const [gameState, setGameState] = useState<GameState>('idle')
  const [firstClick, setFirstClick] = useState(true)

  const startGame = useCallback((diff: Difficulty) => {
    setDifficulty(diff)
    const cfg = CONFIGS[diff]
    setConfig(cfg)
    setBoard(createEmptyBoard(cfg.rows, cfg.cols))
    setGameState('idle')
    setFirstClick(true)
  }, [])

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (gameState === 'won' || gameState === 'lost') return
      const cell = board[row][col]
      if (cell.state === 'flagged' || cell.state === 'revealed') return

      let currentBoard = board
      if (firstClick) {
        currentBoard = placeMines(board, config.mines, row, col)
        setFirstClick(false)
        setGameState('playing')
      }

      if (currentBoard[row][col].isMine) {
        // Reveal all mines
        const lostBoard = currentBoard.map((r) =>
          r.map((c) => (c.isMine ? { ...c, state: 'revealed' as const } : c))
        )
        setBoard(lostBoard)
        setGameState('lost')
        return
      }

      const newBoard = revealCell(currentBoard, row, col)
      setBoard(newBoard)
      if (checkWin(newBoard)) setGameState('won')
    },
    [board, config.mines, firstClick, gameState]
  )

  const handleRightClick = useCallback(
    (e: React.MouseEvent, row: number, col: number) => {
      e.preventDefault()
      if (gameState === 'won' || gameState === 'lost' || gameState === 'idle') return
      setBoard((prev) => toggleFlag(prev, row, col))
    },
    [gameState]
  )

  const flagsUsed = countFlags(board)
  const cellSize =
    difficulty === 'easy'
      ? 'w-8 h-8 text-sm'
      : difficulty === 'medium'
        ? 'w-7 h-7 text-xs'
        : 'w-6 h-6 text-xs'

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-2">
        {(Object.keys(CONFIGS) as Difficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => startGame(d)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors',
              difficulty === d
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Status */}
      <div className="flex items-center gap-4 text-sm font-medium">
        <span>💣 {config.mines - flagsUsed}</span>
        <button
          onClick={() => startGame(difficulty)}
          className="rounded-lg bg-secondary px-3 py-1 text-secondary-foreground hover:bg-secondary/80"
        >
          {gameState === 'won' ? '😎' : gameState === 'lost' ? '😵' : '🙂'} Reset
        </button>
      </div>

      {/* Game state banner */}
      {gameState === 'won' && (
        <div className="rounded-lg bg-emerald-100 px-4 py-2 font-semibold text-emerald-800">
          You cleared the minefield!
        </div>
      )}
      {gameState === 'lost' && (
        <div className="rounded-lg bg-red-100 px-4 py-2 font-semibold text-red-800">
          Boom! Hit a mine.
        </div>
      )}

      {/* Board */}
      <div
        className="inline-grid gap-px overflow-hidden rounded border bg-border"
        style={{ gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))` }}
      >
        {board.map((row, ri) =>
          row.map((cell, ci) => {
            const isRevealed = cell.state === 'revealed'
            const isFlagged = cell.state === 'flagged'
            return (
              <button
                key={`${ri}-${ci}`}
                onClick={() => handleCellClick(ri, ci)}
                onContextMenu={(e) => handleRightClick(e, ri, ci)}
                className={cn(
                  cellSize,
                  'flex select-none items-center justify-center font-bold transition-colors',
                  isRevealed
                    ? cell.isMine
                      ? 'bg-red-400'
                      : 'bg-zinc-100 dark:bg-zinc-800'
                    : 'bg-zinc-300 hover:bg-zinc-200 active:bg-zinc-400 dark:bg-zinc-600 dark:hover:bg-zinc-500',
                  isRevealed && !cell.isMine ? NUMBER_COLORS[cell.adjacentMines] : ''
                )}
              >
                {isFlagged
                  ? '🚩'
                  : isRevealed && cell.isMine
                    ? '💣'
                    : isRevealed && cell.adjacentMines > 0
                      ? CELL_NUMBERS[cell.adjacentMines]
                      : ''}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
