'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  PUZZLES,
  ROUNDS_PER_GAME,
  BULLSEYE_RADIUS,
  CLOSE_RADIUS,
  MEDIUM_RADIUS,
  BULLSEYE_POINTS,
  CLOSE_POINTS,
  MEDIUM_POINTS,
  scoreGuess,
  distanceFromTarget,
  pickRoundPuzzles,
  maxPossibleScore,
  getRating,
  type Puzzle,
} from './logic'

type Phase = 'guessing' | 'revealed' | 'gameover'

function ScoringBand({
  target,
  radius,
  className,
}: {
  target: number
  radius: number
  className: string
}) {
  const left = Math.max(0, target - radius)
  const right = Math.min(100, target + radius)
  return (
    <div
      className={cn('absolute top-0 bottom-0', className)}
      style={{ left: `${left}%`, width: `${right - left}%` }}
    />
  )
}

function SpectrumBar({
  guess,
  revealed,
  target,
}: {
  guess: number
  revealed: boolean
  target: number
}) {
  return (
    <div className="relative h-20 w-full overflow-hidden rounded-xl border border-zinc-300 bg-gradient-to-r from-sky-200 via-zinc-100 to-rose-200 dark:border-zinc-700 dark:from-sky-900/40 dark:via-zinc-800 dark:to-rose-900/40">
      {/* Tick marks every 10% */}
      <div className="absolute inset-0">
        {Array.from({ length: 11 }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-zinc-400/40 dark:bg-zinc-500/40"
            style={{ left: `${i * 10}%` }}
          />
        ))}
      </div>

      {/* Scoring bands appear on reveal, centered on the target */}
      {revealed && (
        <>
          <ScoringBand
            target={target}
            radius={MEDIUM_RADIUS}
            className="bg-emerald-300/30 dark:bg-emerald-700/30"
          />
          <ScoringBand
            target={target}
            radius={CLOSE_RADIUS}
            className="bg-emerald-400/50 dark:bg-emerald-600/50"
          />
          <ScoringBand
            target={target}
            radius={BULLSEYE_RADIUS}
            className="bg-emerald-500/80 dark:bg-emerald-500/80"
          />
        </>
      )}

      {/* Target indicator — only shown after reveal */}
      {revealed && (
        <div
          className="absolute top-0 bottom-0 flex -translate-x-1/2 items-center justify-center"
          style={{ left: `${target}%` }}
        >
          <div className="h-full w-0.5 bg-emerald-700 dark:bg-emerald-300" />
          <div className="absolute -top-1 h-3 w-3 -translate-y-full rotate-45 bg-emerald-700 dark:bg-emerald-300" />
        </div>
      )}

      {/* Guess indicator */}
      <div
        className="absolute top-0 bottom-0 flex -translate-x-1/2 items-center justify-center transition-[left] duration-75"
        style={{ left: `${guess}%` }}
      >
        <div className="bg-foreground h-full w-1" />
        <div className="bg-foreground absolute -bottom-1 h-3 w-3 translate-y-full rotate-45" />
      </div>
    </div>
  )
}

function PhaseBadge({ label }: { label: string }) {
  return (
    <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
      {label}
    </span>
  )
}

export function MindmeldGame() {
  const [puzzles, setPuzzles] = useState<Puzzle[]>(() => pickRoundPuzzles(PUZZLES, ROUNDS_PER_GAME))
  const [roundIndex, setRoundIndex] = useState(0)
  const [guess, setGuess] = useState(50)
  const [phase, setPhase] = useState<Phase>('guessing')
  const [totalScore, setTotalScore] = useState(0)
  const [lastPoints, setLastPoints] = useState(0)

  const currentPuzzle = puzzles[roundIndex]

  const handleLockIn = useCallback(() => {
    if (phase !== 'guessing') return
    const points = scoreGuess(guess, currentPuzzle.target)
    setLastPoints(points)
    setTotalScore((s) => s + points)
    setPhase('revealed')
  }, [phase, guess, currentPuzzle])

  const handleNext = useCallback(() => {
    if (phase !== 'revealed') return
    if (roundIndex + 1 >= ROUNDS_PER_GAME) {
      setPhase('gameover')
    } else {
      setRoundIndex((i) => i + 1)
      setGuess(50)
      setPhase('guessing')
    }
  }, [phase, roundIndex])

  const handleRestart = useCallback(() => {
    setPuzzles(pickRoundPuzzles(PUZZLES, ROUNDS_PER_GAME))
    setRoundIndex(0)
    setGuess(50)
    setPhase('guessing')
    setTotalScore(0)
    setLastPoints(0)
  }, [])

  // Keyboard: Enter = lock in / next round, arrows handled by range input.
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key === 'Enter') {
        e.preventDefault()
        if (phase === 'guessing') handleLockIn()
        else if (phase === 'revealed') handleNext()
        else if (phase === 'gameover') handleRestart()
      } else if (phase === 'guessing') {
        if (e.key === 'ArrowLeft') setGuess((g) => Math.max(0, g - 1))
        else if (e.key === 'ArrowRight') setGuess((g) => Math.min(100, g + 1))
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [phase, handleLockIn, handleNext, handleRestart])

  const pointsLabel = useMemo(() => {
    if (lastPoints === BULLSEYE_POINTS) return 'Bullseye!'
    if (lastPoints === CLOSE_POINTS) return 'Close!'
    if (lastPoints === MEDIUM_POINTS) return 'Warm.'
    return 'Cold.'
  }, [lastPoints])

  if (phase === 'gameover') {
    const max = maxPossibleScore(ROUNDS_PER_GAME)
    const rating = getRating(totalScore, ROUNDS_PER_GAME)
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-6 text-center">
        <div className="text-6xl">🎯</div>
        <h2 className="text-3xl font-bold">Game over</h2>
        <div className="text-muted-foreground text-sm">Your final reading</div>
        <div className="text-foreground text-5xl font-bold tabular-nums">
          {totalScore}
          <span className="text-muted-foreground text-2xl font-normal"> / {max}</span>
        </div>
        <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{rating}</div>
        <button
          onClick={handleRestart}
          className="bg-foreground text-background rounded-lg px-6 py-3 font-semibold transition-opacity hover:opacity-90"
        >
          Play again
        </button>
      </div>
    )
  }

  const revealed = phase === 'revealed'
  const distance = distanceFromTarget(guess, currentPuzzle.target)

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-6">
      {/* Top bar */}
      <div className="flex w-full items-center justify-between">
        <PhaseBadge label={`Round ${roundIndex + 1} / ${ROUNDS_PER_GAME}`} />
        <div className="text-sm font-semibold tabular-nums">
          Score: <span className="text-foreground">{totalScore}</span>
          <span className="text-muted-foreground">
            {' / '}
            {maxPossibleScore(ROUNDS_PER_GAME)}
          </span>
        </div>
      </div>

      {/* Clue */}
      <div className="bg-secondary/60 flex w-full flex-col items-center gap-2 rounded-2xl border p-6 text-center">
        <div className="text-muted-foreground text-xs tracking-widest uppercase">The clue is</div>
        <div className="text-foreground text-3xl font-bold sm:text-4xl">{currentPuzzle.clue}</div>
      </div>

      {/* Spectrum */}
      <div className="flex w-full flex-col gap-3">
        <div className="flex w-full items-center justify-between text-sm font-semibold">
          <span className="text-sky-700 dark:text-sky-300">← {currentPuzzle.spectrum.left}</span>
          <span className="text-rose-700 dark:text-rose-300">{currentPuzzle.spectrum.right} →</span>
        </div>
        <SpectrumBar guess={guess} revealed={revealed} target={currentPuzzle.target} />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={guess}
          disabled={revealed}
          onChange={(e) => setGuess(Number(e.target.value))}
          aria-label="Your guess on the spectrum"
          className="accent-foreground w-full disabled:opacity-40"
        />
      </div>

      {/* Reveal panel */}
      {revealed ? (
        <div className="bg-secondary/60 flex w-full flex-col items-center gap-2 rounded-xl border p-4 text-center">
          <div className="text-muted-foreground text-xs tracking-widest uppercase">Target</div>
          <div className="text-foreground text-2xl font-bold tabular-nums">
            {currentPuzzle.target}
          </div>
          <div className="text-muted-foreground text-sm">
            You guessed <span className="text-foreground font-semibold">{guess}</span> — off by{' '}
            <span className="text-foreground font-semibold">{distance}</span>
          </div>
          <div
            className={cn(
              'text-lg font-bold',
              lastPoints === BULLSEYE_POINTS && 'text-emerald-600 dark:text-emerald-400',
              lastPoints === CLOSE_POINTS && 'text-emerald-600 dark:text-emerald-400',
              lastPoints === MEDIUM_POINTS && 'text-amber-600 dark:text-amber-400',
              lastPoints === 0 && 'text-muted-foreground'
            )}
          >
            {pointsLabel} +{lastPoints} {lastPoints === 1 ? 'point' : 'points'}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-center text-xs">
          Drag the dial (or use ← →) to where you think the clue lands, then lock it in.
        </p>
      )}

      {/* Action */}
      <button
        onClick={revealed ? handleNext : handleLockIn}
        className="bg-foreground text-background rounded-lg px-6 py-3 font-semibold transition-opacity hover:opacity-90"
      >
        {revealed ? (roundIndex + 1 >= ROUNDS_PER_GAME ? 'See results' : 'Next round') : 'Lock in'}
      </button>
    </div>
  )
}
