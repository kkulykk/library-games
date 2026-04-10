'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { getSavedPlayerName, savePlayerName } from '@/lib/player-name'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useInviteCode, getInviteLink } from '@/hooks/useInviteCode'
import { useMindmeldRoom } from './useMindmeldRoom'
import {
  BULLSEYE_RADIUS,
  CLOSE_RADIUS,
  HIDDEN_TARGET,
  MAX_CLUE_LENGTH,
  MEDIUM_RADIUS,
  MIN_PLAYERS,
  allGuessersSubmitted,
  canStartGame,
  distanceFromTarget,
  getGuessers,
  getLeaderboard,
  getPsychic,
  getWinners,
  hasPlayerGuessed,
  isPsychic,
  redactForPlayer,
  type GameState,
  type Player,
} from './logic'

// ─── Screens ────────────────────────────────────────────────────────────────

function SetupRequired() {
  return (
    <div className="bg-secondary/40 mx-auto max-w-md rounded-2xl border p-6 text-center">
      <div className="mb-3 text-4xl">🔧</div>
      <h2 className="mb-2 text-lg font-bold">Supabase setup required</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Online multiplayer requires a Supabase project. Create a free project at{' '}
        <span className="text-foreground font-medium">supabase.com</span>, run the schema from{' '}
        <code className="bg-secondary rounded px-1 text-xs">supabase-schema.sql</code>, then set:
      </p>
      <pre className="bg-secondary rounded-lg p-3 text-left text-xs">
        {`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}
      </pre>
    </div>
  )
}

interface EntryScreenProps {
  onCreate: (name: string) => void
  onJoin: (code: string, name: string) => void
  onRestore?: () => void
  savedSession: { roomCode: string; playerName: string } | null
  loading: boolean
  error: string | null
  initialCode?: string | null
}

function EntryScreen({
  onCreate,
  onJoin,
  onRestore,
  savedSession,
  loading,
  error,
  initialCode,
}: EntryScreenProps) {
  const [name, setName] = useState(getSavedPlayerName)
  const [joinCode, setJoinCode] = useState(initialCode ?? '')
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(initialCode ? 'join' : 'choose')

  if (mode === 'choose') {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <div className="mb-3 text-5xl">🧠</div>
          <h2 className="text-xl font-black tracking-tight">Mindmeld</h2>
          <p className="text-muted-foreground text-sm">{MIN_PLAYERS}-10 players</p>
        </div>
        {savedSession && onRestore && (
          <button
            onClick={onRestore}
            className="border-primary/40 hover:bg-secondary w-64 rounded-xl border-2 border-dashed px-6 py-3 text-center text-sm transition-colors"
          >
            <div className="font-semibold">Resume session</div>
            <div className="text-muted-foreground text-xs">
              {savedSession.playerName} · Room {savedSession.roomCode}
            </div>
          </button>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => setMode('create')}
            className="bg-secondary hover:bg-secondary/70 flex w-36 flex-col items-center gap-2 rounded-2xl px-6 py-5 text-center font-semibold transition-all hover:shadow-lg active:scale-95"
          >
            <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
              <span className="text-2xl">+</span>
            </div>
            <span>Create Room</span>
            <span className="text-muted-foreground text-xs font-normal">Host a game</span>
          </button>
          <button
            onClick={() => setMode('join')}
            className="bg-secondary hover:bg-secondary/70 flex w-36 flex-col items-center gap-2 rounded-2xl px-6 py-5 text-center font-semibold transition-all hover:shadow-lg active:scale-95"
          >
            <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
              <span className="text-2xl">&rarr;</span>
            </div>
            <span>Join Room</span>
            <span className="text-muted-foreground text-xs font-normal">Enter a code</span>
          </button>
        </div>
      </div>
    )
  }

  const isCreate = mode === 'create'
  return (
    <div className="flex w-72 flex-col gap-4">
      <button
        onClick={() => setMode('choose')}
        className="text-muted-foreground hover:text-foreground self-start text-sm"
      >
        &larr; Back
      </button>
      <h2 className="text-lg font-bold">{isCreate ? 'Create Room' : 'Join Room'}</h2>
      {error && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">{error}</p>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          maxLength={16}
          className="bg-background focus:ring-primary/40 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
        />
      </label>
      {!isCreate && (
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">Room code</span>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. AB12"
            maxLength={4}
            className="bg-background focus:ring-primary/40 rounded-lg border px-3 py-2 text-sm tracking-widest uppercase outline-none focus:ring-2"
          />
        </label>
      )}
      <button
        disabled={loading || !name.trim() || (!isCreate && joinCode.length < 4)}
        onClick={() => {
          savePlayerName(name.trim())
          if (isCreate) onCreate(name.trim())
          else onJoin(joinCode, name.trim())
        }}
        className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
      >
        {loading ? 'Connecting\u2026' : isCreate ? 'Create Room' : 'Join Room'}
      </button>
    </div>
  )
}

// ─── Lobby ──────────────────────────────────────────────────────────────────

interface LobbyScreenProps {
  gameState: GameState
  playerId: string
  roomCode: string
  onStart: () => void
  onLeave: () => void
}

function LobbyScreen({ gameState, playerId, roomCode, onStart, onLeave }: LobbyScreenProps) {
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const ready = canStartGame(gameState)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  function copyCode() {
    navigator.clipboard.writeText(roomCode).then(
      () => {
        setCopied('code')
        setTimeout(() => setCopied(null), 2000)
      },
      () => {}
    )
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(getInviteLink('mindmeld', roomCode)).then(
      () => {
        setCopied('link')
        setTimeout(() => setCopied(null), 2000)
      },
      () => {}
    )
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div className="bg-secondary rounded-2xl p-4 text-center">
        <p className="text-muted-foreground mb-1 text-xs font-medium">
          Room code &mdash; share with friends
        </p>
        <p className="mb-2 text-3xl font-black tracking-widest">{roomCode}</p>
        <div className="flex justify-center gap-2">
          <button
            onClick={copyCode}
            className="hover:bg-background rounded-lg border px-3 py-1 text-xs font-medium transition-colors"
          >
            {copied === 'code' ? 'Copied!' : 'Copy code'}
          </button>
          <button
            onClick={copyInviteLink}
            className="hover:bg-background rounded-lg border px-3 py-1 text-xs font-medium transition-colors"
          >
            {copied === 'link' ? 'Copied!' : 'Copy invite link'}
          </button>
        </div>
      </div>

      <div className="bg-secondary/60 rounded-2xl border p-4">
        <p className="text-muted-foreground mb-2 text-xs font-medium">
          Players ({gameState.players.length})
        </p>
        <ul className="flex flex-col gap-1.5">
          {gameState.players.map((p) => (
            <li
              key={p.id}
              className="bg-background flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            >
              <span className="font-medium">{p.name}</span>
              {p.isHost && (
                <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                  Host
                </span>
              )}
              {p.id === playerId && <span className="text-muted-foreground ml-auto">you</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="text-muted-foreground rounded-xl border border-dashed p-3 text-center text-xs leading-relaxed">
        Each round, one player becomes the{' '}
        <span className="text-foreground font-semibold">Psychic</span>. They see a target on a
        spectrum (e.g. Cold ↔ Hot) and give a one-word clue. Everyone else slides a dial to where
        they think the clue lands. Points for being close!
      </div>

      {!ready && (
        <p className="text-muted-foreground text-center text-xs">
          Need at least {MIN_PLAYERS} players to start
        </p>
      )}

      <div className="flex gap-3">
        {isHost ? (
          <button
            disabled={!ready}
            onClick={onStart}
            className="bg-primary text-primary-foreground flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40"
          >
            Start Game
          </button>
        ) : (
          <p className="text-muted-foreground flex-1 text-center text-sm">
            Waiting for host to start&hellip;
          </p>
        )}
        <button
          onClick={onLeave}
          className="hover:bg-secondary rounded-lg border px-4 py-2.5 text-sm font-semibold"
        >
          Leave
        </button>
      </div>
    </div>
  )
}

// ─── Spectrum bar ───────────────────────────────────────────────────────────

interface SpectrumBarProps {
  leftLabel: string
  rightLabel: string
  guess: number | null
  targetVisible: boolean
  target: number
  /** Other guessers' markers to display in reveal phase. */
  otherGuesses?: Array<{ name: string; guess: number; isYou: boolean }>
}

function SpectrumBar({
  leftLabel,
  rightLabel,
  guess,
  targetVisible,
  target,
  otherGuesses,
}: SpectrumBarProps) {
  const bands = targetVisible
    ? [
        {
          radius: MEDIUM_RADIUS,
          className: 'bg-emerald-300/30 dark:bg-emerald-700/30',
        },
        {
          radius: CLOSE_RADIUS,
          className: 'bg-emerald-400/50 dark:bg-emerald-600/50',
        },
        {
          radius: BULLSEYE_RADIUS,
          className: 'bg-emerald-500/80 dark:bg-emerald-500/80',
        },
      ]
    : []

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex w-full items-center justify-between text-sm font-semibold">
        <span className="text-sky-700 dark:text-sky-300">← {leftLabel}</span>
        <span className="text-rose-700 dark:text-rose-300">{rightLabel} →</span>
      </div>
      <div className="relative h-20 w-full overflow-hidden rounded-xl border border-zinc-300 bg-gradient-to-r from-sky-200 via-zinc-100 to-rose-200 dark:border-zinc-700 dark:from-sky-900/40 dark:via-zinc-800 dark:to-rose-900/40">
        {/* Tick marks */}
        <div className="absolute inset-0">
          {Array.from({ length: 11 }, (_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-zinc-400/40 dark:bg-zinc-500/40"
              style={{ left: `${i * 10}%` }}
            />
          ))}
        </div>

        {bands.map((band, i) => {
          const left = Math.max(0, target - band.radius)
          const right = Math.min(100, target + band.radius)
          return (
            <div
              key={i}
              className={cn('absolute top-0 bottom-0', band.className)}
              style={{ left: `${left}%`, width: `${right - left}%` }}
            />
          )
        })}

        {/* Target marker */}
        {targetVisible && (
          <div
            className="absolute top-0 bottom-0 flex -translate-x-1/2 items-center justify-center"
            style={{ left: `${target}%` }}
          >
            <div className="h-full w-0.5 bg-emerald-700 dark:bg-emerald-300" />
            <div className="absolute -top-1 h-3 w-3 -translate-y-full rotate-45 bg-emerald-700 dark:bg-emerald-300" />
          </div>
        )}

        {/* Other players' guesses (reveal only) */}
        {otherGuesses?.map((g, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 flex -translate-x-1/2 flex-col items-center justify-end pb-1"
            style={{ left: `${g.guess}%` }}
          >
            <div
              className={cn(
                'h-1/2 w-0.5',
                g.isYou ? 'bg-foreground' : 'bg-foreground/50 dark:bg-foreground/60'
              )}
            />
            <span
              className={cn(
                'absolute top-1 rounded bg-black/60 px-1 text-[9px] font-semibold whitespace-nowrap text-white',
                g.isYou && 'bg-foreground text-background'
              )}
            >
              {g.name}
            </span>
          </div>
        ))}

        {/* Active (current) guess marker — shown when guess is set and no otherGuesses list */}
        {guess !== null && !otherGuesses && (
          <div
            className="absolute top-0 bottom-0 flex -translate-x-1/2 items-center justify-center transition-[left] duration-75"
            style={{ left: `${guess}%` }}
          >
            <div className="bg-foreground h-full w-1" />
            <div className="bg-foreground absolute -bottom-1 h-3 w-3 translate-y-full rotate-45" />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Playing screen ─────────────────────────────────────────────────────────

interface PlayingScreenProps {
  gameState: GameState
  playerId: string
  onSubmitClue: (clue: string) => void
  onSubmitGuess: (guess: number) => void
  onReveal: () => void
  onNextRound: () => void
  onLeave: () => void
}

function PlayingScreen({
  gameState,
  playerId,
  onSubmitClue,
  onSubmitGuess,
  onReveal,
  onNextRound,
  onLeave,
}: PlayingScreenProps) {
  const round = gameState.currentRound!
  const psychic = getPsychic(gameState)
  const youArePsychic = isPsychic(gameState, playerId)
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const youGuessed = hasPlayerGuessed(gameState, playerId)
  const allIn = allGuessersSubmitted(gameState)
  const guessers = getGuessers(gameState)

  const [clueInput, setClueInput] = useState('')
  const [guess, setGuess] = useState(50)

  const targetVisible = round.phase === 'reveal' || youArePsychic
  const targetForDisplay = targetVisible && round.target !== HIDDEN_TARGET ? round.target : 50

  const revealMarkers = useMemo(() => {
    if (round.phase !== 'reveal') return undefined
    return Object.entries(round.guesses).map(([pid, g]) => {
      const p = gameState.players.find((pp) => pp.id === pid)
      return {
        name: p?.name ?? '?',
        guess: g,
        isYou: pid === playerId,
      }
    })
  }, [round, gameState.players, playerId])

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-5">
      {/* Header */}
      <div className="flex w-full items-center justify-between">
        <span className="bg-secondary rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
          Round {round.number} / {gameState.totalRounds}
        </span>
        <div className="text-muted-foreground text-xs">
          Psychic:{' '}
          <span className="text-foreground font-semibold">
            {psychic?.name ?? '?'}
            {youArePsychic && ' (you)'}
          </span>
        </div>
      </div>

      {/* Leaderboard strip */}
      <div className="flex w-full flex-wrap justify-center gap-1.5 text-xs">
        {getLeaderboard(gameState).map((p) => (
          <span
            key={p.id}
            className={cn(
              'bg-secondary/60 flex items-center gap-1.5 rounded-full border px-2 py-1',
              p.id === playerId && 'border-primary/40'
            )}
          >
            <span className="font-medium">{p.name}</span>
            <span className="text-muted-foreground tabular-nums">{p.score}</span>
          </span>
        ))}
      </div>

      {/* Clue card */}
      {round.phase === 'clue' && youArePsychic && (
        <div className="bg-secondary/60 flex w-full flex-col items-center gap-3 rounded-2xl border p-5 text-center">
          <div className="text-muted-foreground text-xs tracking-widest uppercase">
            You are the Psychic
          </div>
          <div className="text-foreground text-sm">
            The hidden target is{' '}
            <span className="font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
              {round.target}
            </span>
            . Give a clue that hints where on the spectrum it sits.
          </div>
        </div>
      )}
      {round.phase === 'clue' && !youArePsychic && (
        <div className="bg-secondary/60 w-full rounded-2xl border p-5 text-center text-sm">
          Waiting for{' '}
          <span className="text-foreground font-semibold">{psychic?.name ?? 'the Psychic'}</span> to
          write a clue&hellip;
        </div>
      )}
      {round.phase !== 'clue' && round.clue && (
        <div className="bg-secondary/60 flex w-full flex-col items-center gap-2 rounded-2xl border p-6 text-center">
          <div className="text-muted-foreground text-xs tracking-widest uppercase">The clue is</div>
          <div className="text-foreground text-3xl font-bold sm:text-4xl">{round.clue}</div>
        </div>
      )}

      {/* Spectrum */}
      <SpectrumBar
        leftLabel={round.spectrum.left}
        rightLabel={round.spectrum.right}
        guess={
          round.phase === 'guessing' && !youArePsychic && !youGuessed
            ? guess
            : round.phase === 'reveal'
              ? null
              : null
        }
        targetVisible={targetVisible}
        target={targetForDisplay}
        otherGuesses={revealMarkers}
      />

      {/* Phase-specific controls */}
      {round.phase === 'clue' && youArePsychic && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = clueInput.trim()
            if (trimmed) onSubmitClue(trimmed)
          }}
          className="flex w-full flex-col gap-2"
        >
          <input
            value={clueInput}
            onChange={(e) => setClueInput(e.target.value)}
            placeholder="Type your clue…"
            maxLength={MAX_CLUE_LENGTH}
            autoFocus
            className="bg-background focus:ring-primary/40 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2"
          />
          <button
            type="submit"
            disabled={!clueInput.trim()}
            className="bg-foreground text-background rounded-lg px-6 py-3 font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Send clue
          </button>
        </form>
      )}

      {round.phase === 'guessing' && !youArePsychic && !youGuessed && (
        <div className="flex w-full flex-col items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={guess}
            onChange={(e) => setGuess(Number(e.target.value))}
            aria-label="Your guess on the spectrum"
            className="accent-foreground w-full"
          />
          <button
            onClick={() => onSubmitGuess(guess)}
            className="bg-foreground text-background rounded-lg px-6 py-3 font-semibold transition-opacity hover:opacity-90"
          >
            Lock in
          </button>
        </div>
      )}

      {round.phase === 'guessing' && !youArePsychic && youGuessed && (
        <div className="text-muted-foreground text-sm">
          You&rsquo;re locked in. Waiting for others&hellip;
        </div>
      )}

      {round.phase === 'guessing' && youArePsychic && (
        <div className="bg-secondary/60 flex w-full flex-col items-center gap-2 rounded-xl border p-4 text-center text-sm">
          <div>Guessers are locking in&hellip;</div>
          <div className="text-muted-foreground text-xs">
            {Object.keys(round.guesses).length} / {guessers.length} submitted
          </div>
          {isHost && !allIn && Object.keys(round.guesses).length > 0 && (
            <button
              onClick={onReveal}
              className="bg-secondary hover:bg-secondary/80 mt-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
            >
              Reveal now
            </button>
          )}
        </div>
      )}

      {round.phase === 'reveal' && (
        <div className="bg-secondary/60 flex w-full flex-col items-center gap-3 rounded-xl border p-5 text-center">
          <div className="text-muted-foreground text-xs tracking-widest uppercase">
            Target revealed
          </div>
          <div className="text-foreground text-3xl font-bold tabular-nums">{round.target}</div>
          <div className="grid w-full grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {gameState.players.map((p) => {
              const g = round.guesses[p.id]
              const points = round.roundScores[p.id] ?? 0
              const isThePsychic = p.id === round.psychicId
              const dist = g === undefined ? null : distanceFromTarget(g, round.target)
              return (
                <div
                  key={p.id}
                  className="bg-background flex items-center justify-between rounded-lg border px-2 py-1"
                >
                  <span className="flex items-center gap-1 truncate font-medium">
                    {p.name}
                    {isThePsychic && <span className="text-[10px]">🧠</span>}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {isThePsychic
                      ? `+${points} (best)`
                      : g === undefined
                        ? '—'
                        : `${g} · off ${dist} · +${points}`}
                  </span>
                </div>
              )
            })}
          </div>
          {isHost ? (
            <button
              onClick={onNextRound}
              className="bg-foreground text-background mt-1 rounded-lg px-6 py-2.5 font-semibold transition-opacity hover:opacity-90"
            >
              {round.number >= gameState.totalRounds ? 'See results' : 'Next round'}
            </button>
          ) : (
            <div className="text-muted-foreground text-xs">Waiting for host&hellip;</div>
          )}
        </div>
      )}

      <button
        onClick={onLeave}
        className="text-muted-foreground hover:bg-secondary rounded-xl border px-3 py-1.5 text-xs transition-colors"
      >
        Leave
      </button>
    </div>
  )
}

// ─── Finished ───────────────────────────────────────────────────────────────

interface FinishedScreenProps {
  gameState: GameState
  playerId: string
  onPlayAgain: () => void
  onLeave: () => void
}

function FinishedScreen({ gameState, playerId, onPlayAgain, onLeave }: FinishedScreenProps) {
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const leaderboard = getLeaderboard(gameState)
  const winners = getWinners(gameState)
  const youWon = winners.some((w: Player) => w.id === playerId)
  const winnerNames = winners.map((w) => w.name).join(' & ')

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
      <div className="text-6xl">{youWon ? '🏆' : '🧠'}</div>
      <div>
        <h2 className="text-2xl font-black">{winnerNames} wins!</h2>
        <p className="text-muted-foreground text-sm">
          {youWon ? 'Your mind was in sync.' : 'Telepathy takes practice.'}
        </p>
      </div>

      <div className="w-full rounded-2xl border p-4">
        <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Final scores
        </p>
        <ul className="flex flex-col gap-1.5">
          {leaderboard.map((p, i) => (
            <li
              key={p.id}
              className={cn(
                'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                i === 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-secondary/60'
              )}
            >
              <span className="flex items-center gap-2 truncate">
                <span className="text-muted-foreground w-5 tabular-nums">{i + 1}.</span>
                <span className="font-semibold">{p.name}</span>
                {p.id === playerId && <span className="text-muted-foreground text-xs">you</span>}
              </span>
              <span className="font-bold tabular-nums">{p.score}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3">
        {isHost ? (
          <button
            onClick={onPlayAgain}
            className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-semibold"
          >
            Play again
          </button>
        ) : (
          <p className="text-muted-foreground text-sm">Waiting for host to start another&hellip;</p>
        )}
        <button
          onClick={onLeave}
          className="hover:bg-secondary rounded-lg border px-5 py-2.5 text-sm font-semibold"
        >
          Leave
        </button>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function MindmeldGame() {
  const inviteCode = useInviteCode()
  const {
    gameState,
    playerId,
    roomCode,
    status,
    error,
    savedSession,
    createRoom,
    joinRoom,
    restoreSession,
    dispatch,
    leaveRoom,
  } = useMindmeldRoom()

  // Redaction is client-side only. Trusted-group play.
  const redactedState = useMemo(
    () => (gameState && playerId ? redactForPlayer(gameState, playerId) : gameState),
    [gameState, playerId]
  )

  if (!isSupabaseConfigured) return <SetupRequired />

  const isLoading = status === 'creating' || status === 'joining' || status === 'restoring'

  if (!redactedState || !playerId || !roomCode) {
    return (
      <EntryScreen
        onCreate={createRoom}
        onJoin={joinRoom}
        onRestore={savedSession ? restoreSession : undefined}
        savedSession={savedSession}
        loading={isLoading}
        error={error}
        initialCode={inviteCode}
      />
    )
  }

  if (redactedState.phase === 'lobby') {
    return (
      <LobbyScreen
        gameState={redactedState}
        playerId={playerId}
        roomCode={roomCode}
        onStart={() => dispatch({ type: 'START_GAME', playerId })}
        onLeave={leaveRoom}
      />
    )
  }

  if (redactedState.phase === 'finished') {
    return (
      <FinishedScreen
        gameState={redactedState}
        playerId={playerId}
        onPlayAgain={() => dispatch({ type: 'PLAY_AGAIN', playerId })}
        onLeave={leaveRoom}
      />
    )
  }

  return (
    <PlayingScreen
      gameState={redactedState}
      playerId={playerId}
      onSubmitClue={(clue) => dispatch({ type: 'SUBMIT_CLUE', playerId, clue })}
      onSubmitGuess={(guess) => dispatch({ type: 'SUBMIT_GUESS', playerId, guess })}
      onReveal={() => dispatch({ type: 'REVEAL_ROUND', playerId })}
      onNextRound={() => dispatch({ type: 'NEXT_ROUND', playerId })}
      onLeave={leaveRoom}
    />
  )
}
