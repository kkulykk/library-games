'use client'

import { useState, useEffect } from 'react'
import { createInitialState, makeMove, getAIMove, isGameOver, type GameState } from './logic'
import { cn } from '@/lib/utils'

const AI_THINK_DELAY_MS = 400

type GameMode = 'single' | 'dual'

export function TicTacToeGame() {
  const [mode, setMode] = useState<GameMode | null>(null)
  const [state, setState] = useState<GameState>(createInitialState())
  const [aiThinking, setAiThinking] = useState(false)

  // AI move for single-player mode (AI plays as O)
  useEffect(() => {
    if (mode !== 'single') return
    if (state.currentPlayer !== 'O') return
    if (isGameOver(state)) return

    setAiThinking(true)
    const timeout = setTimeout(() => {
      const move = getAIMove(state.board, 'O')
      if (move !== -1) {
        setState((prev) => makeMove(prev, move))
      }
      setAiThinking(false)
    }, AI_THINK_DELAY_MS)

    return () => clearTimeout(timeout)
  }, [mode, state])

  function handleCellClick(index: number) {
    if (aiThinking) return
    if (mode === 'single' && state.currentPlayer === 'O') return
    setState((prev) => makeMove(prev, index))
  }

  function restart() {
    setState(createInitialState())
    setAiThinking(false)
  }

  function changeMode() {
    setMode(null)
    setState(createInitialState())
    setAiThinking(false)
  }

  if (mode === null) {
    return (
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-xl font-bold">Choose Mode</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => setMode('single')}
            className="bg-secondary hover:bg-secondary/70 flex flex-col items-center gap-1 rounded-2xl px-8 py-5 text-center font-semibold transition-colors"
          >
            <span className="text-3xl">🤖</span>
            <span>vs Computer</span>
            <span className="text-muted-foreground text-xs font-normal">You are X</span>
          </button>
          <button
            onClick={() => setMode('dual')}
            className="bg-secondary hover:bg-secondary/70 flex flex-col items-center gap-1 rounded-2xl px-8 py-5 text-center font-semibold transition-colors"
          >
            <span className="text-3xl">👥</span>
            <span>2 Players</span>
            <span className="text-muted-foreground text-xs font-normal">Local co-op</span>
          </button>
        </div>
      </div>
    )
  }

  const statusText = () => {
    if (state.winner) {
      if (mode === 'single') {
        return state.winner === 'X' ? 'You win! 🎉' : 'Computer wins!'
      }
      return `Player ${state.winner} wins! 🎉`
    }
    if (state.isDraw) return "It's a draw!"
    if (mode === 'single') {
      return state.currentPlayer === 'X' ? 'Your turn (X)' : 'Computer thinking…'
    }
    return `Player ${state.currentPlayer}'s turn`
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Status */}
      <div
        className={cn(
          'rounded-xl px-6 py-2 text-center text-sm font-semibold',
          state.winner
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
            : state.isDraw
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
              : 'bg-secondary text-secondary-foreground'
        )}
      >
        {statusText()}
      </div>

      {/* Board */}
      <div data-testid="tic-tac-toe-board" className="grid grid-cols-3 gap-2">
        {state.board.map((cell, index) => {
          const isWinningCell = state.winningLine?.includes(index) ?? false
          return (
            <button
              key={index}
              onClick={() => handleCellClick(index)}
              disabled={cell !== null || isGameOver(state) || aiThinking}
              aria-label={`Cell ${index + 1}${cell ? ` (${cell})` : ''}`}
              className={cn(
                'flex h-20 w-20 items-center justify-center rounded-2xl text-4xl font-bold transition-all duration-150 select-none sm:h-24 sm:w-24',
                isWinningCell && 'bg-emerald-200 dark:bg-emerald-800',
                !isWinningCell && cell === null && !isGameOver(state) && !aiThinking
                  ? 'bg-secondary hover:bg-secondary/70 active:scale-95'
                  : !isWinningCell
                    ? 'bg-secondary/50'
                    : '',
                cell === 'X'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {cell}
            </button>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={restart}
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-5 py-2 text-sm font-semibold"
        >
          Restart
        </button>
        <button
          onClick={changeMode}
          className="hover:bg-secondary rounded-lg border px-5 py-2 text-sm font-semibold"
        >
          Change Mode
        </button>
      </div>
    </div>
  )
}
