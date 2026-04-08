'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  createEmptyGrid,
  addRandomTile,
  move,
  isGameOver,
  hasWon,
  type Grid,
  type Direction,
} from './logic'
import { cn } from '@/lib/utils'

const TILE_COLORS: Record<number, string> = {
  0: 'bg-zinc-200 dark:bg-zinc-700',
  2: 'bg-amber-100 text-zinc-800',
  4: 'bg-amber-200 text-zinc-800',
  8: 'bg-orange-300 text-white',
  16: 'bg-orange-400 text-white',
  32: 'bg-orange-500 text-white',
  64: 'bg-red-500 text-white',
  128: 'bg-yellow-400 text-white',
  256: 'bg-yellow-500 text-white',
  512: 'bg-yellow-600 text-white',
  1024: 'bg-yellow-700 text-white',
  2048: 'bg-yellow-800 text-white',
  4096: 'bg-purple-500 text-white',
  8192: 'bg-purple-600 text-white',
  16384: 'bg-purple-700 text-white',
  32768: 'bg-pink-600 text-white',
  65536: 'bg-pink-700 text-white',
}

function getTileColor(value: number): string {
  return TILE_COLORS[value] ?? 'bg-zinc-900 text-white'
}

function initGame(): { grid: Grid; score: number } {
  let grid = createEmptyGrid()
  grid = addRandomTile(grid)
  grid = addRandomTile(grid)
  return { grid, score: 0 }
}

export function Game2048() {
  const [{ grid, score }, setState] = useState(initGame)
  const [best, setBest] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const handleMove = useCallback(
    (direction: Direction) => {
      if (gameOver) return
      setState((prev) => {
        const { grid: newGrid, score: gained, moved } = move(prev.grid, direction)
        if (!moved) return prev
        const withTile = addRandomTile(newGrid)
        const newScore = prev.score + gained
        setBest((b) => Math.max(b, newScore))
        if (hasWon(withTile) && !won) setWon(true)
        if (isGameOver(withTile)) setGameOver(true)
        return { grid: withTile, score: newScore }
      })
    },
    [gameOver, won]
  )

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
      }
      const dir = map[e.key]
      if (dir) {
        e.preventDefault()
        handleMove(dir)
      } else if (e.key === ' ') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [handleMove])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStartRef.current.x
      const dy = touch.clientY - touchStartRef.current.y
      touchStartRef.current = null
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return
      if (Math.abs(dx) > Math.abs(dy)) {
        handleMove(dx > 0 ? 'right' : 'left')
      } else {
        handleMove(dy > 0 ? 'down' : 'up')
      }
    },
    [handleMove]
  )

  const restart = () => {
    setState(initGame())
    setGameOver(false)
    setWon(false)
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      {/* Score row */}
      <div className="flex w-full items-center justify-between">
        <div className="flex gap-3">
          <div className="bg-secondary rounded-lg px-4 py-2 text-center">
            <div className="text-muted-foreground text-xs">SCORE</div>
            <div className="text-xl font-bold">{score}</div>
          </div>
          <div className="bg-secondary rounded-lg px-4 py-2 text-center">
            <div className="text-muted-foreground text-xs">BEST</div>
            <div className="text-xl font-bold">{best}</div>
          </div>
        </div>
        <button
          onClick={restart}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold"
        >
          New Game
        </button>
      </div>

      {/* Grid */}
      <div
        className="relative w-full rounded-2xl bg-zinc-300 p-2 dark:bg-zinc-700"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {won && !gameOver && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-yellow-500/80">
            <p className="text-3xl font-extrabold text-white">You Win! 🎉</p>
            <button
              onClick={() => setWon(false)}
              className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-bold text-yellow-600"
            >
              Keep Going
            </button>
          </div>
        )}
        {gameOver && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-black/60">
            <p className="text-3xl font-extrabold text-white">Game Over</p>
            <button
              onClick={restart}
              className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-bold text-zinc-900"
            >
              Try Again
            </button>
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          {grid.flat().map((value, i) => (
            <div
              key={i}
              className={cn(
                'flex aspect-square items-center justify-center rounded-lg text-2xl font-extrabold transition-colors duration-100',
                getTileColor(value)
              )}
            >
              {value !== 0 ? value : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Arrow controls for mobile */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div />
        <button
          onClick={() => handleMove('up')}
          className="bg-secondary hover:bg-secondary/80 rounded-lg p-3 text-lg"
        >
          ↑
        </button>
        <div />
        <button
          onClick={() => handleMove('left')}
          className="bg-secondary hover:bg-secondary/80 rounded-lg p-3 text-lg"
        >
          ←
        </button>
        <button
          onClick={() => handleMove('down')}
          className="bg-secondary hover:bg-secondary/80 rounded-lg p-3 text-lg"
        >
          ↓
        </button>
        <button
          onClick={() => handleMove('right')}
          className="bg-secondary hover:bg-secondary/80 rounded-lg p-3 text-lg"
        >
          →
        </button>
      </div>
      <p className="text-muted-foreground text-xs">
        Use arrow keys, swipe on the grid, or tap the buttons to play
      </p>
    </div>
  )
}
