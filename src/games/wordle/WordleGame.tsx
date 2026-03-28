'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  evaluateGuess,
  mergeKeyboardStates,
  isWin,
  getDailyWord,
  isValidGuess,
  WORD_LIST,
  WORD_LENGTH,
  MAX_GUESSES,
  type TileState,
  type GuessResult,
} from './logic'
import { cn } from '@/lib/utils'

const TOAST_DURATION_MS = 2000
const SHAKE_DURATION_MS = 500

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
]

const TILE_COLORS: Record<TileState, string> = {
  correct: 'bg-emerald-500 border-emerald-500 text-white',
  present: 'bg-amber-400 border-amber-400 text-white',
  absent: 'bg-zinc-500 border-zinc-500 text-white',
  empty: 'bg-transparent border-zinc-300 dark:border-zinc-600 text-foreground',
  tbd: 'bg-transparent border-zinc-500 text-foreground',
}

const KEY_COLORS: Record<TileState, string> = {
  correct: 'bg-emerald-500 text-white',
  present: 'bg-amber-400 text-white',
  absent: 'bg-zinc-400 text-white',
  empty: 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100',
  tbd: 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100',
}

function Tile({ letter, state }: { letter: string; state: TileState }) {
  return (
    <div
      className={cn(
        'flex h-14 w-14 select-none items-center justify-center border-2 text-xl font-bold uppercase transition-colors duration-300',
        TILE_COLORS[state]
      )}
    >
      {letter}
    </div>
  )
}

function Key({
  label,
  state,
  onClick,
}: {
  label: string
  state: TileState
  onClick: (key: string) => void
}) {
  const isWide = label === 'ENTER' || label === '⌫'
  return (
    <button
      onClick={() => onClick(label)}
      className={cn(
        'flex h-14 select-none items-center justify-center rounded font-bold transition-colors duration-200',
        isWide ? 'px-3 text-xs' : 'w-9 text-sm',
        KEY_COLORS[state]
      )}
    >
      {label}
    </button>
  )
}

export function WordleGame() {
  const [answer] = useState(() => getDailyWord(WORD_LIST))
  const [guesses, setGuesses] = useState<GuessResult[][]>([])
  const [currentGuess, setCurrentGuess] = useState('')
  const [keyStates, setKeyStates] = useState<Record<string, TileState>>({})
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [shake, setShake] = useState(false)
  const [message, setMessage] = useState('')

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), TOAST_DURATION_MS)
  }

  const submitGuess = useCallback(() => {
    if (currentGuess.length !== WORD_LENGTH) {
      setShake(true)
      setTimeout(() => setShake(false), SHAKE_DURATION_MS)
      showMessage('Not enough letters')
      return
    }
    if (!isValidGuess(currentGuess)) {
      setShake(true)
      setTimeout(() => setShake(false), SHAKE_DURATION_MS)
      showMessage('Not in word list')
      return
    }

    const results = evaluateGuess(currentGuess, answer)
    const newGuesses = [...guesses, results]
    setGuesses(newGuesses)
    setKeyStates((prev) => mergeKeyboardStates(prev, results))
    setCurrentGuess('')

    if (isWin(results)) {
      setWon(true)
      setGameOver(true)
      const messages = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!']
      showMessage(messages[newGuesses.length - 1] ?? 'Nice!')
    } else if (newGuesses.length >= MAX_GUESSES) {
      setGameOver(true)
      showMessage(answer)
    }
  }, [currentGuess, guesses, answer])

  const handleKey = useCallback(
    (key: string) => {
      if (gameOver) return
      if (key === 'ENTER') {
        submitGuess()
      } else if (key === '⌫' || key === 'BACKSPACE') {
        setCurrentGuess((prev) => prev.slice(0, -1))
      } else if (/^[A-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((prev) => prev + key)
      }
    },
    [gameOver, currentGuess, submitGuess]
  )

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      handleKey(e.key.toUpperCase())
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [handleKey])

  // Build the full grid (submitted + current + empty rows)
  const rows: Array<{ letters: string[]; states: TileState[] }> = []
  for (let i = 0; i < MAX_GUESSES; i++) {
    if (i < guesses.length) {
      rows.push({
        letters: guesses[i].map((r) => r.letter),
        states: guesses[i].map((r) => r.state),
      })
    } else if (i === guesses.length && !gameOver) {
      const letters = currentGuess
        .split('')
        .concat(Array(WORD_LENGTH).fill(''))
        .slice(0, WORD_LENGTH)
      rows.push({
        letters,
        states: letters.map((l) => (l ? 'tbd' : 'empty')),
      })
    } else {
      rows.push({
        letters: Array(WORD_LENGTH).fill(''),
        states: Array(WORD_LENGTH).fill('empty'),
      })
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      {/* Message toast */}
      <div
        className={cn(
          'fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-background transition-opacity duration-200',
          message ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        {message}
      </div>

      {/* Grid */}
      <div className="flex flex-col gap-1.5">
        {rows.map((row, ri) => (
          <div
            key={ri}
            className={cn(
              'flex gap-1.5',
              shake && ri === guesses.length ? 'animate-[wiggle_0.5s_ease-in-out]' : ''
            )}
          >
            {row.letters.map((letter, ci) => (
              <Tile key={ci} letter={letter} state={row.states[ci]} />
            ))}
          </div>
        ))}
      </div>

      {/* Keyboard */}
      <div className="flex w-full flex-col gap-1.5">
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-1.5">
            {row.map((key) => (
              <Key key={key} label={key} state={keyStates[key] ?? 'empty'} onClick={handleKey} />
            ))}
          </div>
        ))}
      </div>

      {gameOver && !won && (
        <p className="text-sm text-muted-foreground">
          The word was <span className="font-bold text-foreground">{answer}</span>
        </p>
      )}
    </div>
  )
}
