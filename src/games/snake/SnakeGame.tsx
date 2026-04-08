'use client'

import { useReducer, useEffect, useCallback, useRef } from 'react'
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

type State = {
  snake: Point[]
  food: Point
  direction: Direction
  score: number
  gameOver: boolean
  started: boolean
}

type Action =
  | { type: 'tick' }
  | { type: 'restart' }
  | { type: 'start' }
  | { type: 'turn'; dir: Direction }

function createInitialState(): State {
  const snake = createInitialSnake()
  return {
    snake,
    food: randomFood(snake),
    direction: 'RIGHT',
    score: 0,
    gameOver: false,
    started: false,
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'restart':
      return createInitialState()

    case 'start':
      return state.started ? state : { ...state, started: true }

    case 'turn': {
      if (isOppositeDirection(state.direction, action.dir)) return state
      return { ...state, direction: action.dir }
    }

    case 'tick': {
      const head = getNextHead(state.snake[0], state.direction)
      if (isOutOfBounds(head) || collidesWithSelf(state.snake, head)) {
        return { ...state, gameOver: true }
      }
      const newSnake = [head, ...state.snake]
      const ate = head.x === state.food.x && head.y === state.food.y
      if (ate) {
        return {
          ...state,
          snake: newSnake,
          food: randomFood(newSnake),
          score: state.score + 1,
        }
      }
      newSnake.pop()
      return { ...state, snake: newSnake }
    }
  }
}

export function SnakeGame() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)
  const { snake, food, score, gameOver, started } = state
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tick = useCallback(() => dispatch({ type: 'tick' }), [])

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
      if (!started) dispatch({ type: 'start' })
      dispatch({ type: 'turn', dir })
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [started])

  const handleDirection = (dir: Direction) => {
    if (!started) dispatch({ type: 'start' })
    dispatch({ type: 'turn', dir })
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-xs items-center justify-between">
        <span className="font-semibold">Score: {score}</span>
        <button
          onClick={() => dispatch({ type: 'restart' })}
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-1.5 text-sm font-semibold"
        >
          Restart
        </button>
      </div>

      {/* Canvas-like grid */}
      <div
        className="border-border relative overflow-hidden rounded border-2 bg-zinc-100 dark:bg-zinc-900"
        style={{ width: GRID_SIZE * CELL_PX, height: GRID_SIZE * CELL_PX }}
        onClick={() => !started && dispatch({ type: 'start' })}
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
              onClick={() => dispatch({ type: 'restart' })}
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
          onClick={() => handleDirection('UP')}
          className="bg-secondary hover:bg-secondary/80 rounded-lg p-3 text-lg"
        >
          ↑
        </button>
        <div />
        <button
          onClick={() => handleDirection('LEFT')}
          className="bg-secondary hover:bg-secondary/80 rounded-lg p-3 text-lg"
        >
          ←
        </button>
        <button
          onClick={() => handleDirection('DOWN')}
          className="bg-secondary hover:bg-secondary/80 rounded-lg p-3 text-lg"
        >
          ↓
        </button>
        <button
          onClick={() => handleDirection('RIGHT')}
          className="bg-secondary hover:bg-secondary/80 rounded-lg p-3 text-lg"
        >
          →
        </button>
      </div>
      <p className="text-muted-foreground text-xs">Arrow keys or WASD to control</p>
    </div>
  )
}
