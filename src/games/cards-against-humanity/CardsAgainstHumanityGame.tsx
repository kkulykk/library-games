'use client'

import { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { getSavedPlayerName, savePlayerName } from '@/lib/player-name'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useInviteCode, getInviteLink } from '@/hooks/useInviteCode'
import { useCAHRoom } from './useCAHRoom'
import {
  getCzar,
  isCzar,
  getNonCzarPlayers,
  hasSubmitted,
  getWhiteCardText,
  type GameState,
} from './logic'

// ─── Animations ─────────────────────────────────────────────────────────────

function CAHStyles() {
  return (
    <style>{`
      @keyframes cah-fade-in {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes cah-slide-up {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes cah-card-flip {
        0% { transform: rotateY(90deg); opacity: 0; }
        100% { transform: rotateY(0deg); opacity: 1; }
      }
      @keyframes cah-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-3px); }
      }
      .animate-cah-fade-in { animation: cah-fade-in 0.3s ease-out; }
      .animate-cah-slide-up { animation: cah-slide-up 0.3s ease-out both; }
      .animate-cah-card-flip { animation: cah-card-flip 0.4s ease-out; }
      .animate-cah-bounce { animation: cah-bounce 0.5s ease-in-out infinite; }
    `}</style>
  )
}

// ─── Card components ────────────────────────────────────────────────────────

interface BlackCardDisplayProps {
  text: string
  pick: number
}

function BlackCardDisplay({ text, pick }: BlackCardDisplayProps) {
  return (
    <div className="relative flex min-h-[180px] w-full max-w-sm flex-col justify-between rounded-2xl bg-black p-5 text-white shadow-xl sm:min-h-[200px] sm:p-6">
      <p className="text-base font-bold leading-relaxed sm:text-lg">
        {text.split('___').map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 && (
              <span className="mx-0.5 inline-block w-16 border-b-2 border-white sm:w-20" />
            )}
          </span>
        ))}
      </p>
      {pick > 1 && (
        <div className="mt-3 self-end">
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-black">
            PICK {pick}
          </span>
        </div>
      )}
    </div>
  )
}

interface WhiteCardProps {
  text: string
  selected?: boolean
  selectionIndex?: number
  disabled?: boolean
  onClick?: () => void
  className?: string
}

function WhiteCard({
  text,
  selected,
  selectionIndex,
  disabled,
  onClick,
  className,
}: WhiteCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled && !selected}
      className={cn(
        'relative flex min-h-[120px] w-full flex-col justify-between rounded-2xl border-2 p-4 text-left text-sm font-semibold shadow-md transition-all duration-200 sm:p-5 sm:text-base',
        selected
          ? 'border-black bg-gray-100 ring-2 ring-black dark:border-white dark:bg-gray-800 dark:ring-white'
          : disabled
            ? 'cursor-not-allowed border-border bg-card opacity-50'
            : 'cursor-pointer border-border bg-card hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]',
        className
      )}
    >
      <span>{text}</span>
      {selected && selectionIndex !== undefined && (
        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs font-black text-white dark:bg-white dark:text-black">
          {selectionIndex + 1}
        </span>
      )}
    </button>
  )
}

// ─── Screens ────────────────────────────────────────────────────────────────

function SetupRequired() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-secondary/40 p-6 text-center">
      <div className="mb-3 text-4xl">🔧</div>
      <h2 className="mb-2 text-lg font-bold">Supabase setup required</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Online multiplayer requires a Supabase project. Create a free project at{' '}
        <span className="font-medium text-foreground">supabase.com</span>, run the schema from{' '}
        <code className="rounded bg-secondary px-1 text-xs">supabase-schema.sql</code>, then set:
      </p>
      <pre className="rounded-lg bg-secondary p-3 text-left text-xs">
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
      <div className="animate-cah-fade-in flex flex-col items-center gap-6">
        <div className="text-center">
          <div className="mb-3 flex justify-center gap-1.5">
            <div className="h-12 w-9 rounded-lg bg-black shadow-md" />
            <div className="-ml-1 h-12 w-9 -rotate-3 rounded-lg bg-white shadow-md ring-1 ring-border" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Cards Against Humanity</h2>
          <p className="text-sm text-muted-foreground">3-10 players</p>
        </div>
        {savedSession && (
          <button
            onClick={onRestore}
            className="w-64 rounded-xl border-2 border-dashed border-primary/40 px-6 py-3 text-center text-sm transition-colors hover:bg-secondary"
          >
            <div className="font-semibold">Resume session</div>
            <div className="text-xs text-muted-foreground">
              {savedSession.playerName} &middot; Room {savedSession.roomCode}
            </div>
          </button>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => setMode('create')}
            className="flex w-36 flex-col items-center gap-2 rounded-2xl bg-secondary px-6 py-5 text-center font-semibold transition-all hover:bg-secondary/70 hover:shadow-lg active:scale-95"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <span className="text-2xl">+</span>
            </div>
            <span>Create Room</span>
            <span className="text-xs font-normal text-muted-foreground">Host a game</span>
          </button>
          <button
            onClick={() => setMode('join')}
            className="flex w-36 flex-col items-center gap-2 rounded-2xl bg-secondary px-6 py-5 text-center font-semibold transition-all hover:bg-secondary/70 hover:shadow-lg active:scale-95"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <span className="text-2xl">&rarr;</span>
            </div>
            <span>Join Room</span>
            <span className="text-xs font-normal text-muted-foreground">Enter a code</span>
          </button>
        </div>
      </div>
    )
  }

  const isCreate = mode === 'create'
  return (
    <div className="animate-cah-slide-up flex w-72 flex-col gap-4">
      <button
        onClick={() => setMode('choose')}
        className="self-start text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back
      </button>
      <h2 className="text-lg font-bold">{isCreate ? 'Create Room' : 'Join Room'}</h2>
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          maxLength={16}
          className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </label>
      {!isCreate && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Room code</span>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. AB12"
            maxLength={4}
            className="rounded-lg border bg-background px-3 py-2 text-sm uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/40"
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
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
      >
        {loading ? 'Connecting\u2026' : isCreate ? 'Create Room' : 'Join Room'}
      </button>
    </div>
  )
}

interface LobbyScreenProps {
  gameState: GameState
  playerId: string
  roomCode: string
  onStart: () => void
  onLeave: () => void
}

function LobbyScreen({ gameState, playerId, roomCode, onStart, onLeave }: LobbyScreenProps) {
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
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
    navigator.clipboard.writeText(getInviteLink('cards-against-humanity', roomCode)).then(
      () => {
        setCopied('link')
        setTimeout(() => setCopied(null), 2000)
      },
      () => {}
    )
  }

  return (
    <div className="animate-cah-fade-in flex w-80 flex-col gap-5">
      <div className="rounded-2xl bg-secondary p-5 text-center">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Room code &mdash; share with friends
        </p>
        <p className="mb-3 text-4xl font-black tracking-widest">{roomCode}</p>
        <div className="flex justify-center gap-2">
          <button
            onClick={copyCode}
            className="rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors hover:bg-background"
          >
            {copied === 'code' ? 'Copied!' : 'Copy code'}
          </button>
          <button
            onClick={copyInviteLink}
            className="rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors hover:bg-background"
          >
            {copied === 'link' ? 'Copied!' : 'Copy invite link'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Players ({gameState.players.length}/10)
        </p>
        {gameState.players.map((p, i) => (
          <div
            key={p.id}
            className="animate-cah-slide-up flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span
              className={cn('h-2 w-2 rounded-full', p.isHost ? 'bg-amber-400' : 'bg-green-400')}
            />
            <span className="font-medium">{p.name}</span>
            {p.isHost && <span className="ml-auto text-xs text-muted-foreground">host</span>}
            {p.id === playerId && !p.isHost && (
              <span className="ml-auto text-xs text-muted-foreground">you</span>
            )}
          </div>
        ))}
      </div>

      {isHost && gameState.players.length < 3 && (
        <p className="text-center text-xs text-muted-foreground">
          Need at least 3 players to start&hellip;
        </p>
      )}

      <div className="flex gap-3">
        {isHost && (
          <button
            disabled={gameState.players.length < 3}
            onClick={onStart}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
          >
            Start Game
          </button>
        )}
        {!isHost && (
          <p className="flex-1 text-center text-sm text-muted-foreground">
            Waiting for host to start&hellip;
          </p>
        )}
        <button
          onClick={onLeave}
          className="rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
        >
          Leave
        </button>
      </div>
    </div>
  )
}

// ─── Game Board ─────────────────────────────────────────────────────────────

interface GameBoardProps {
  gameState: GameState
  playerId: string
  onSubmit: (cardIndices: number[]) => void
  onRevealNext: () => void
  onPickWinner: (winnerId: string) => void
  onNextRound: () => void
  onLeave: () => void
}

function GameBoard({
  gameState,
  playerId,
  onSubmit,
  onRevealNext,
  onPickWinner,
  onNextRound,
  onLeave,
}: GameBoardProps) {
  const [selectedCards, setSelectedCards] = useState<number[]>([])

  const czar = getCzar(gameState)
  const amCzar = isCzar(gameState, playerId)
  const myHand = gameState.hands[playerId] ?? []
  const submitted = hasSubmitted(gameState, playerId)
  const nonCzarPlayers = getNonCzarPlayers(gameState)
  const submittedCount = Object.keys(gameState.submissions).length
  const totalNeeded = nonCzarPlayers.length
  const pick = gameState.blackCard?.pick ?? 1

  // Reset selection on phase change
  useEffect(() => {
    setSelectedCards([])
  }, [gameState.phase, gameState.blackCard?.text])

  function handleCardClick(cardIndex: number) {
    if (amCzar || submitted || gameState.phase !== 'playing') return

    setSelectedCards((prev) => {
      if (prev.includes(cardIndex)) {
        return prev.filter((c) => c !== cardIndex)
      }
      if (prev.length >= pick) {
        // Replace the last card
        return [...prev.slice(0, -1), cardIndex]
      }
      return [...prev, cardIndex]
    })
  }

  function handleSubmit() {
    if (selectedCards.length !== pick) return
    onSubmit(selectedCards)
    setSelectedCards([])
  }

  // Status text
  const statusText = () => {
    if (gameState.phase === 'playing') {
      if (amCzar)
        return `You are the Card Czar. Waiting for answers\u2026 (${submittedCount}/${totalNeeded})`
      if (submitted) return `Waiting for other players\u2026 (${submittedCount}/${totalNeeded})`
      return `Pick ${pick} card${pick > 1 ? 's' : ''} to answer`
    }
    if (gameState.phase === 'judging') {
      if (amCzar) {
        if (gameState.revealIndex < gameState.revealOrder.length - 1) return 'Tap to reveal answers'
        return 'Pick the funniest answer!'
      }
      return `${czar?.name ?? 'Card Czar'} is judging\u2026`
    }
    if (gameState.phase === 'reveal') {
      const winner = gameState.players.find((p) => p.id === gameState.roundWinnerId)
      return `${winner?.name ?? '?'} wins the round!`
    }
    return ''
  }

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-4 px-2 sm:px-0">
      {/* Scoreboard */}
      <div className="flex w-full flex-wrap justify-center gap-2">
        {gameState.players.map((p) => (
          <div
            key={p.id}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all',
              czar?.id === p.id
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : p.id === playerId
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                  : 'bg-secondary text-secondary-foreground'
            )}
          >
            <span className="max-w-[5rem] truncate">{p.name}</span>
            <span className="rounded-md bg-black/10 px-1.5 py-0.5 text-[10px] font-black tabular-nums dark:bg-white/10">
              {gameState.scores[p.id] ?? 0}
            </span>
            {czar?.id === p.id && <span className="text-[10px] font-normal opacity-70">czar</span>}
            {gameState.phase === 'playing' && !amCzar && p.id !== playerId && czar?.id !== p.id && (
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  hasSubmitted(gameState, p.id) ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div
        className={cn(
          'w-full rounded-xl px-4 py-2 text-center text-sm font-semibold transition-colors duration-300',
          gameState.phase === 'reveal'
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
            : amCzar
              ? 'bg-black text-white dark:bg-white dark:text-black'
              : submitted
                ? 'bg-secondary text-secondary-foreground'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
        )}
      >
        {statusText()}
      </div>

      {/* Black card */}
      {gameState.blackCard && (
        <div className="flex w-full justify-center">
          <BlackCardDisplay text={gameState.blackCard.text} pick={gameState.blackCard.pick} />
        </div>
      )}

      {/* Judging phase: revealed submissions (anonymized) */}
      {gameState.phase === 'judging' && (
        <div className="flex w-full flex-col gap-3">
          {gameState.revealOrder.map((anonId, idx) => {
            const isRevealed = idx <= gameState.revealIndex
            const cards = gameState.shuffledSubmissions[idx] ?? []

            if (!isRevealed) {
              return (
                <div
                  key={anonId}
                  className="flex min-h-[80px] items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/30"
                >
                  <span className="text-sm text-muted-foreground">?</span>
                </div>
              )
            }

            return (
              <button
                key={anonId}
                onClick={() => {
                  if (amCzar && gameState.revealIndex >= gameState.revealOrder.length - 1) {
                    onPickWinner(anonId)
                  }
                }}
                disabled={!amCzar || gameState.revealIndex < gameState.revealOrder.length - 1}
                className={cn(
                  'animate-cah-card-flip flex gap-2 rounded-2xl border-2 bg-card p-3 text-left transition-all sm:p-4',
                  amCzar && gameState.revealIndex >= gameState.revealOrder.length - 1
                    ? 'cursor-pointer border-border hover:border-black hover:shadow-lg dark:hover:border-white'
                    : 'cursor-default border-border'
                )}
              >
                {cards.map((cardIdx) => (
                  <div key={cardIdx} className="flex-1 text-sm font-semibold sm:text-base">
                    {getWhiteCardText(cardIdx)}
                  </div>
                ))}
              </button>
            )
          })}

          {amCzar && gameState.revealIndex < gameState.revealOrder.length - 1 && (
            <button
              onClick={onRevealNext}
              className="animate-cah-bounce mx-auto rounded-xl bg-black px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-gray-800 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              Reveal next
            </button>
          )}
        </div>
      )}

      {/* Reveal phase: show winner */}
      {gameState.phase === 'reveal' && (
        <div className="animate-cah-fade-in flex w-full flex-col items-center gap-4">
          <div className="flex w-full gap-2 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-500/50 dark:bg-amber-500/10">
            {(gameState.roundWinnerCards ?? []).map((cardIdx) => (
              <div key={cardIdx} className="flex-1 text-sm font-bold sm:text-base">
                {getWhiteCardText(cardIdx)}
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {gameState.players.find((p) => p.id === gameState.roundWinnerId)?.name} gets a point!
          </p>
          {amCzar && (
            <button
              onClick={onNextRound}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-all active:scale-95"
            >
              Next round
            </button>
          )}
          {!amCzar && (
            <p className="text-xs text-muted-foreground">
              Waiting for Card Czar to continue&hellip;
            </p>
          )}
        </div>
      )}

      {/* Player's hand (playing phase) */}
      {gameState.phase === 'playing' && !amCzar && !submitted && (
        <div className="w-full">
          <p className="mb-2 text-center text-xs text-muted-foreground">
            Your hand ({myHand.length})
            {selectedCards.length > 0 && (
              <span className="ml-1 font-semibold text-primary">
                &mdash; {selectedCards.length}/{pick} selected
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {myHand.map((cardIndex, i) => (
              <div
                key={cardIndex}
                className="animate-cah-slide-up"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <WhiteCard
                  text={getWhiteCardText(cardIndex)}
                  selected={selectedCards.includes(cardIndex)}
                  selectionIndex={selectedCards.indexOf(cardIndex)}
                  onClick={() => handleCardClick(cardIndex)}
                />
              </div>
            ))}
          </div>
          {selectedCards.length === pick && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={handleSubmit}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-all active:scale-95"
              >
                Submit answer{pick > 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Submitted / Czar waiting view: show hand as non-interactive */}
      {gameState.phase === 'playing' && (submitted || amCzar) && (
        <div className="w-full text-center">
          {submitted && (
            <p className="text-sm text-muted-foreground">
              Your answer is in. Waiting for others&hellip;
            </p>
          )}
        </div>
      )}

      {/* Leave button */}
      <button
        onClick={onLeave}
        className="rounded-xl border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary"
      >
        Leave game
      </button>
    </div>
  )
}

// ─── Finished screen ────────────────────────────────────────────────────────

interface FinishedScreenProps {
  gameState: GameState
  playerId: string
  onPlayAgain: () => void
  onLeave: () => void
}

function FinishedScreen({ gameState, playerId, onPlayAgain, onLeave }: FinishedScreenProps) {
  const winner = gameState.players.find((p) => p.id === gameState.winnerId)
  const isWinner = gameState.winnerId === playerId
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const [showConfetti, setShowConfetti] = useState(true)

  // Sort players by score
  const ranked = [...gameState.players].sort(
    (a, b) => (gameState.scores[b.id] ?? 0) - (gameState.scores[a.id] ?? 0)
  )

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="animate-cah-fade-in flex flex-col items-center gap-6">
      {isWinner && showConfetti && <ConfettiEffect />}
      <div className="text-6xl">{isWinner ? '\uD83C\uDFC6' : '\uD83C\uDFAE'}</div>
      <div className="text-center">
        <h2 className="text-2xl font-black">
          {isWinner ? 'You win!' : `${winner?.name ?? '?'} wins!`}
        </h2>
        <p className="text-muted-foreground">
          {isWinner ? 'The most horrible person!' : 'Better luck next time!'}
        </p>
      </div>

      {/* Final scoreboard */}
      <div className="flex w-72 flex-col gap-1">
        {ranked.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
              i === 0 ? 'bg-amber-100 font-bold dark:bg-amber-500/20' : 'bg-secondary'
            )}
          >
            <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
            <span className="flex-1">{p.name}</span>
            <span className="font-black tabular-nums">{gameState.scores[p.id] ?? 0}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        {isHost && (
          <button
            onClick={onPlayAgain}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all active:scale-95"
          >
            Play Again
          </button>
        )}
        {!isHost && (
          <p className="text-sm text-muted-foreground">
            Waiting for host to start another game&hellip;
          </p>
        )}
        <button
          onClick={onLeave}
          className="rounded-lg border px-5 py-2.5 text-sm font-semibold hover:bg-secondary"
        >
          Leave
        </button>
      </div>
    </div>
  )
}

function ConfettiEffect() {
  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.5 + Math.random() * 1.5,
        color: ['#000', '#fff', '#6b7280', '#d1d5db'][i % 4],
        size: 4 + Math.random() * 6,
      })),
    []
  )

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function CardsAgainstHumanityGame() {
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
  } = useCAHRoom()

  if (!isSupabaseConfigured) return <SetupRequired />

  const isLoading = status === 'creating' || status === 'joining' || status === 'restoring'

  if (!gameState || !playerId || !roomCode) {
    return (
      <>
        <CAHStyles />
        <EntryScreen
          onCreate={createRoom}
          onJoin={joinRoom}
          onRestore={savedSession ? restoreSession : undefined}
          savedSession={savedSession}
          loading={isLoading}
          error={error}
          initialCode={inviteCode}
        />
      </>
    )
  }

  if (gameState.phase === 'finished') {
    return (
      <>
        <CAHStyles />
        <FinishedScreen
          gameState={gameState}
          playerId={playerId}
          onPlayAgain={() => dispatch({ type: 'PLAY_AGAIN', playerId })}
          onLeave={leaveRoom}
        />
      </>
    )
  }

  if (gameState.phase === 'lobby') {
    return (
      <>
        <CAHStyles />
        <LobbyScreen
          gameState={gameState}
          playerId={playerId}
          roomCode={roomCode}
          onStart={() => dispatch({ type: 'START_GAME', playerId })}
          onLeave={leaveRoom}
        />
      </>
    )
  }

  return (
    <>
      <CAHStyles />
      <GameBoard
        gameState={gameState}
        playerId={playerId}
        onSubmit={(cardIndices) => dispatch({ type: 'SUBMIT_CARDS', playerId, cardIndices })}
        onRevealNext={() => dispatch({ type: 'REVEAL_NEXT', playerId })}
        onPickWinner={(winnerId) => dispatch({ type: 'PICK_WINNER', playerId, winnerId })}
        onNextRound={() => dispatch({ type: 'NEXT_ROUND', playerId })}
        onLeave={leaveRoom}
      />
    </>
  )
}
