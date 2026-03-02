'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  createInitialSnake,
  getNextHead,
  isOutOfBounds,
  collidesWithSelf,
  randomFood,
  isOppositeDirection,
  getSpeed,
  GRID_SIZE,
  type Direction,
  type Point,
} from './logic'

const CELL_PX = 20

export function SnakeGame() {
  const [snake, setSnake] = useState<Point[]>(createInitialSnake)
  const [food, setFood] = useState<Point>(() => randomFood(createInitialSnake()))
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [started, setStarted] = useState(false)
  const dirRef = useRef<Direction>('RIGHT')
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const restart = () => {
    const initial = createInitialSnake()
    setSnake(initial)
    setFood(randomFood(initial))
    dirRef.current = 'RIGHT'
    setScore(0)
    setGameOver(false)
    setStarted(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  const tick = useCallback(() => {
    setSnake((prev) => {
      const head = getNextHead(prev[0], dirRef.current)
      if (isOutOfBounds(head) || collidesWithSelf(prev, head)) {
        setGameOver(true)
        return prev
      }
      const newSnake = [head, ...prev]
      setFood((prevFood) => {
        if (head.x === prevFood.x && head.y === prevFood.y) {
          setScore((s) => s + 1)
          return randomFood(newSnake)
        }
        newSnake.pop()
        return prevFood
      })
      return newSnake
    })
  }, [])

  useEffect(() => {
    if (!started || gameOver) return
    const speed = getSpeed(score)
    intervalRef.current = setInterval(tick, speed)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [started, gameOver, score, tick])

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowUp: 'UP',
        ArrowDown: 'DOWN',
        ArrowLeft: 'LEFT',
        ArrowRight: 'RIGHT',
        w: 'UP',
        s: 'DOWN',
        a: 'LEFT',
        d: 'RIGHT',
        W: 'UP',
        S: 'DOWN',
        A: 'LEFT',
        D: 'RIGHT',
      }
      const dir = map[e.key]
      if (!dir) return
      e.preventDefault()
      if (!started) setStarted(true)
      if (!isOppositeDirection(dirRef.current, dir)) {
        dirRef.current = dir
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [started])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-xs items-center justify-between">
        <span className="font-semibold">Score: {score}</span>
        <button
          onClick={restart}
          className="rounded-lg bg-secondary px-4 py-1.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80"
        >
          Restart
        </button>
      </div>

      {/* Canvas-like grid */}
      <div
        className="relative overflow-hidden rounded border-2 border-border bg-zinc-100 dark:bg-zinc-900"
        style={{ width: GRID_SIZE * CELL_PX, height: GRID_SIZE * CELL_PX }}
        onClick={() => !started && setStarted(true)}
      >
        {/* Food */}
        <div
          className="absolute flex items-center justify-center text-base"
          style={{
            left: food.x * CELL_PX,
            top: food.y * CELL_PX,
            width: CELL_PX,
            height: CELL_PX,
          }}
        >
          🍎
        </div>
        {/* Snake */}
        {snake.map((p, i) => (
          <div
            key={`${p.x}-${p.y}-${i}`}
            className={`absolute rounded-sm ${i === 0 ? 'bg-emerald-500' : 'bg-emerald-400'}`}
            style={{
              left: p.x * CELL_PX + 1,
              top: p.y * CELL_PX + 1,
              width: CELL_PX - 2,
              height: CELL_PX - 2,
            }}
          />
        ))}

        {/* Overlays */}
        {!started && !gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <p className="text-lg font-bold text-white">Click or press any arrow key to start</p>
          </div>
        )}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
            <p className="text-2xl font-extrabold text-white">Game Over</p>
            <p className="text-sm text-white">Score: {score}</p>
            <button
              onClick={restart}
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-zinc-900"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      {/* Mobile controls */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div />
        <button
          onClick={() => {
            if (!started) setStarted(true)
            if (!isOppositeDirection(dirRef.current, 'UP')) dirRef.current = 'UP'
          }}
          className="rounded-lg bg-secondary p-3 text-lg hover:bg-secondary/80"
        >
          ↑
        </button>
        <div />
        <button
          onClick={() => {
            if (!started) setStarted(true)
            if (!isOppositeDirection(dirRef.current, 'LEFT')) dirRef.current = 'LEFT'
          }}
          className="rounded-lg bg-secondary p-3 text-lg hover:bg-secondary/80"
        >
          ←
        </button>
        <button
          onClick={() => {
            if (!started) setStarted(true)
            if (!isOppositeDirection(dirRef.current, 'DOWN')) dirRef.current = 'DOWN'
          }}
          className="rounded-lg bg-secondary p-3 text-lg hover:bg-secondary/80"
        >
          ↓
        </button>
        <button
          onClick={() => {
            if (!started) setStarted(true)
            if (!isOppositeDirection(dirRef.current, 'RIGHT')) dirRef.current = 'RIGHT'
          }}
          className="rounded-lg bg-secondary p-3 text-lg hover:bg-secondary/80"
        >
          →
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Arrow keys or WASD to control</p>
    </div>
  )
}
