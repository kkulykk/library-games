'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getRandomWordByDifficulty,
  getMaskedWord,
  getLetterState,
  countWrongGuesses,
  isWin,
  isLoss,
  MAX_WRONG_GUESSES,
  type LetterState,
  type Difficulty,
} from './logic'
import { cn } from '@/lib/utils'

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

const KEY_COLORS: Record<LetterState, string> = {
  correct: 'bg-emerald-500 text-white',
  wrong: 'bg-zinc-500 text-white opacity-40',
  unguessed: 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100',
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

const BODY_PARTS = [
  // head
  <circle key="head" cx="130" cy="60" r="15" fill="none" strokeWidth="3" />,
  // body
  <line key="body" x1="130" y1="75" x2="130" y2="140" strokeWidth="3" />,
  // left arm
  <line key="left-arm" x1="130" y1="90" x2="105" y2="120" strokeWidth="3" />,
  // right arm
  <line key="right-arm" x1="130" y1="90" x2="155" y2="120" strokeWidth="3" />,
  // left leg
  <line key="left-leg" x1="130" y1="140" x2="105" y2="175" strokeWidth="3" />,
  // right leg
  <line key="right-leg" x1="130" y1="140" x2="155" y2="175" strokeWidth="3" />,
]

function HangmanSvg({ wrongCount }: { wrongCount: number }) {
  return (
    <svg
      viewBox="0 0 200 220"
      className="text-foreground h-52 w-52"
      stroke="currentColor"
      fill="none"
      strokeLinecap="round"
    >
      {/* Gallows */}
      <line x1="20" y1="210" x2="180" y2="210" strokeWidth="4" />
      <line x1="60" y1="210" x2="60" y2="10" strokeWidth="4" />
      <line x1="60" y1="10" x2="130" y2="10" strokeWidth="4" />
      <line x1="130" y1="10" x2="130" y2="45" strokeWidth="3" />
      {/* Body parts revealed progressively */}
      {BODY_PARTS.slice(0, wrongCount)}
    </svg>
  )
}

export function HangmanGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [word, setWord] = useState(() => getRandomWordByDifficulty('medium'))
  const [guessedLetters, setGuessedLetters] = useState<Set<string>>(new Set())

  const wrongCount = countWrongGuesses(word, guessedLetters)
  const won = isWin(word, guessedLetters)
  const lost = isLoss(wrongCount)
  const gameOver = won || lost
  const masked = getMaskedWord(word, guessedLetters)

  const handleGuess = useCallback(
    (letter: string) => {
      if (gameOver) return
      if (guessedLetters.has(letter)) return
      setGuessedLetters((prev) => new Set([...prev, letter]))
    },
    [gameOver, guessedLetters]
  )

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      const key = e.key.toUpperCase()
      if (/^[A-Z]$/.test(key)) handleGuess(key)
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [handleGuess])

  function startNewGame(d: Difficulty = difficulty) {
    setDifficulty(d)
    setWord(getRandomWordByDifficulty(d))
    setGuessedLetters(new Set())
  }

  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-6">
      {/* Difficulty selector */}
      <div className="flex gap-2">
        {(['easy', 'medium', 'hard'] as const).map((d) => (
          <button
            key={d}
            onClick={() => startNewGame(d)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors',
              d === difficulty
                ? 'bg-foreground text-background'
                : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600'
            )}
          >
            {DIFFICULTY_LABELS[d]}
          </button>
        ))}
      </div>

      {/* Hangman SVG */}
      <HangmanSvg wrongCount={wrongCount} />

      {/* Wrong guesses counter */}
      <p className="text-muted-foreground text-sm">
        {wrongCount} / {MAX_WRONG_GUESSES} wrong guesses
      </p>

      {/* Word display */}
      <div data-testid="hangman-board" className="flex flex-wrap justify-center gap-2">
        {masked.map((char, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="text-foreground min-w-[1.5rem] text-center text-2xl font-bold tracking-widest uppercase">
              {char === '_' ? '\u00A0' : char}
            </span>
            <span className="bg-foreground mt-1 h-0.5 w-6" />
          </div>
        ))}
      </div>

      {/* Status banner */}
      {won && (
        <div className="rounded-lg bg-emerald-500 px-6 py-3 text-center font-bold text-white">
          You won! The word was <span className="uppercase">{word}</span>
        </div>
      )}
      {lost && (
        <div className="rounded-lg bg-red-500 px-6 py-3 text-center font-bold text-white">
          Game over! The word was <span className="uppercase">{word}</span>
        </div>
      )}

      {/* Keyboard */}
      <div className="flex flex-col items-center gap-1.5">
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} className="flex gap-1.5">
            {row.map((letter) => {
              const state = getLetterState(word, guessedLetters, letter)
              return (
                <button
                  key={letter}
                  onClick={() => handleGuess(letter)}
                  disabled={state !== 'unguessed' || gameOver}
                  className={cn(
                    'flex h-10 w-9 items-center justify-center rounded text-sm font-bold transition-colors duration-200 select-none',
                    KEY_COLORS[state],
                    state !== 'unguessed' || gameOver ? 'cursor-default' : 'cursor-pointer'
                  )}
                >
                  {letter}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* New Game button */}
      {gameOver && (
        <button
          onClick={() => startNewGame()}
          className="bg-foreground text-background rounded-lg px-6 py-2 font-bold transition-opacity hover:opacity-80"
        >
          New Game
        </button>
      )}
    </div>
  )
}
