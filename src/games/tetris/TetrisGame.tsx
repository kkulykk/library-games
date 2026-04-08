'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  TETROMINOES,
  type Tetromino,
} from './logic'

const CELL_PX = 28

function initState() {
  const current = randomTetromino()
  const next = randomTetromino()
  return {
    board: createEmptyBoard(),
    current,
    next,
    score: 0,
    lines: 0,
    gameOver: false,
    started: false,
  }
}

export function TetrisGame() {
  const [state, setState] = useState(initState)
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tryMove = useCallback((dx: number, dy: number, newShape?: number[][]) => {
    setState((prev) => {
      if (prev.gameOver || !prev.started) return prev
      const moved: Tetromino = {
        ...prev.current,
        x: prev.current.x + dx,
        y: prev.current.y + dy,
        shape: newShape ?? prev.current.shape,
      }
      if (isValidPosition(prev.board, moved)) {
        return { ...prev, current: moved }
      }
      return prev
    })
  }, [])

  const drop = useCallback(() => {
    setState((prev) => {
      if (prev.gameOver || !prev.started) return prev
      const moved: Tetromino = { ...prev.current, y: prev.current.y + 1 }
      if (isValidPosition(prev.board, moved)) {
        return { ...prev, current: moved }
      }
      // Lock piece
      const locked = placeTetromino(prev.board, prev.current)
      const { board: cleared, linesCleared } = clearLines(locked)
      const newLines = prev.lines + linesCleared
      const newScore = prev.score + calcScore(linesCleared, calcLevel(prev.lines))
      const next = randomTetromino()
      if (!isValidPosition(cleared, prev.next)) {
        return { ...prev, board: cleared, score: newScore, lines: newLines, gameOver: true }
      }
      return { ...prev, board: cleared, current: prev.next, next, score: newScore, lines: newLines }
    })
  }, [])

  useEffect(() => {
    if (!state.started || state.gameOver) return
    const level = calcLevel(state.lines)
    const speed = dropSpeed(level)
    intervalRef.current = setInterval(drop, speed)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [state.started, state.gameOver, state.lines, drop])

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        tryMove(-1, 0)
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        tryMove(1, 0)
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        drop()
      }
      if (e.key === 'ArrowUp' || e.key === 'x') {
        e.preventDefault()
        setState((prev) => {
          const rotated = rotate(prev.current.shape)
          const moved = { ...prev.current, shape: rotated }
          if (isValidPosition(prev.board, moved)) return { ...prev, current: moved }
          return prev
        })
      }
      if (e.key === ' ') {
        e.preventDefault()
        if (!state.started) {
          setState((prev) => ({ ...prev, started: true }))
        }
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [tryMove, drop, state.started])

  const restart = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setState(initState())
  }

  // Build display grid
  const displayBoard: (string | null)[][] = state.board.map((row) => [...row])
  if (state.started && !state.gameOver) {
    state.current.shape.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (!cell) return
        const br = state.current.y + r
        const bc = state.current.x + c
        if (br >= 0 && br < BOARD_HEIGHT && bc >= 0 && bc < BOARD_WIDTH) {
          displayBoard[br][bc] = TETROMINOES[state.current.type].color
        }
      })
    })
  }

  const level = calcLevel(state.lines)

  return (
    <div className="flex items-start gap-6">
      {/* Board */}
      <div className="border-border relative overflow-hidden rounded border-2 bg-zinc-900">
        <div style={{ width: BOARD_WIDTH * CELL_PX, height: BOARD_HEIGHT * CELL_PX }}>
          {displayBoard.map((row, ri) =>
            row.map((color, ci) => (
              <div
                key={`${ri}-${ci}`}
                className="absolute"
                style={{
                  left: ci * CELL_PX + 1,
                  top: ri * CELL_PX + 1,
                  width: CELL_PX - 2,
                  height: CELL_PX - 2,
                  backgroundColor: color ?? 'transparent',
                  borderRadius: color ? 3 : 0,
                }}
              />
            ))
          )}
        </div>

        {!state.started && !state.gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
            <p className="text-xl font-extrabold text-white">Tetris</p>
            <button
              onClick={() => setState((p) => ({ ...p, started: true }))}
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-zinc-900"
            >
              Start Game
            </button>
            <p className="mt-1 text-xs text-white/70">or press Space</p>
          </div>
        )}
        {state.gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
            <p className="text-2xl font-extrabold text-white">Game Over</p>
            <p className="text-sm text-white">Score: {state.score}</p>
            <button
              onClick={restart}
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-zinc-900"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="flex min-w-[100px] flex-col gap-4">
        <div>
          <div className="text-muted-foreground mb-1 text-xs">SCORE</div>
          <div className="text-xl font-bold">{state.score}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1 text-xs">LEVEL</div>
          <div className="text-xl font-bold">{level}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1 text-xs">LINES</div>
          <div className="text-xl font-bold">{state.lines}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1 text-xs">NEXT</div>
          <div className="mt-1 rounded bg-zinc-900 p-2">
            {state.next.shape.map((row, ri) => (
              <div key={ri} className="flex">
                {row.map((cell, ci) => (
                  <div
                    key={ci}
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: cell ? TETROMINOES[state.next.type].color : 'transparent',
                      borderRadius: cell ? 2 : 0,
                      margin: 1,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Mobile controls */}
        <div className="mt-2 grid grid-cols-3 gap-1">
          <div />
          <button
            onClick={() =>
              setState((p) => {
                const rotated = rotate(p.current.shape)
                const moved = { ...p.current, shape: rotated }
                return isValidPosition(p.board, moved) ? { ...p, current: moved } : p
              })
            }
            className="bg-secondary hover:bg-secondary/80 rounded p-2 text-xs"
          >
            ↻
          </button>
          <div />
          <button
            onClick={() => tryMove(-1, 0)}
            className="bg-secondary hover:bg-secondary/80 rounded p-2 text-xs"
          >
            ←
          </button>
          <button
            onClick={() => drop()}
            className="bg-secondary hover:bg-secondary/80 rounded p-2 text-xs"
          >
            ↓
          </button>
          <button
            onClick={() => tryMove(1, 0)}
            className="bg-secondary hover:bg-secondary/80 rounded p-2 text-xs"
          >
            →
          </button>
        </div>
        <p className="text-muted-foreground text-xs">Arrow keys + Space</p>

        <button
          onClick={restart}
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-3 py-1.5 text-xs font-semibold"
        >
          Restart
        </button>
      </div>
    </div>
  )
}
