'use client'

import { useState, useEffect, useCallback } from 'react'
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

// ─── Animations & Styles ───────────────────────────────────────────────────

function CAHStyles() {
  return (
    <style>{`
      @keyframes cah-fade-in {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes cah-slide-up {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes cah-slide-down {
        from { opacity: 0; transform: translateY(-12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes cah-card-flip {
        0% { transform: rotateY(90deg) scale(0.9); opacity: 0; }
        60% { transform: rotateY(-5deg) scale(1.02); opacity: 1; }
        100% { transform: rotateY(0deg) scale(1); opacity: 1; }
      }
      @keyframes cah-card-deal {
        0% { opacity: 0; transform: translateY(-40px) rotate(-5deg) scale(0.8); }
        70% { opacity: 1; transform: translateY(4px) rotate(1deg) scale(1.02); }
        100% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
      }
      @keyframes cah-pulse-glow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(0,0,0,0.15); }
        50% { box-shadow: 0 0 20px 4px rgba(0,0,0,0.1); }
      }
      @keyframes cah-winner-glow {
        0%, 100% { box-shadow: 0 0 15px rgba(251, 191, 36, 0.3); }
        50% { box-shadow: 0 0 35px rgba(251, 191, 36, 0.6); }
      }
      @keyframes cah-stamp {
        0% { transform: scale(2) rotate(-15deg); opacity: 0; }
        60% { transform: scale(0.95) rotate(2deg); opacity: 1; }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
      }
      @keyframes cah-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      @keyframes cah-confetti-fall {
        0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
      .animate-cah-fade-in { animation: cah-fade-in 0.35s ease-out; }
      .animate-cah-slide-up { animation: cah-slide-up 0.35s ease-out both; }
      .animate-cah-slide-down { animation: cah-slide-down 0.3s ease-out both; }
      .animate-cah-card-flip { animation: cah-card-flip 0.5s ease-out both; }
      .animate-cah-card-deal { animation: cah-card-deal 0.4s ease-out both; }
      .animate-cah-pulse-glow { animation: cah-pulse-glow 2s ease-in-out infinite; }
      .animate-cah-winner-glow { animation: cah-winner-glow 1.5s ease-in-out infinite; }
      .animate-cah-stamp { animation: cah-stamp 0.4s ease-out both; }
      .animate-cah-float { animation: cah-float 2.5s ease-in-out infinite; }

      .cah-card-shadow {
        box-shadow:
          0 1px 2px rgba(0,0,0,0.08),
          0 4px 12px rgba(0,0,0,0.08),
          0 8px 24px rgba(0,0,0,0.06);
      }
      .cah-card-shadow-lg {
        box-shadow:
          0 2px 4px rgba(0,0,0,0.1),
          0 8px 20px rgba(0,0,0,0.12),
          0 16px 40px rgba(0,0,0,0.08);
      }
      .cah-black-card {
        background: linear-gradient(145deg, #1a1a1a 0%, #000 100%);
        box-shadow:
          0 2px 4px rgba(0,0,0,0.2),
          0 8px 24px rgba(0,0,0,0.25),
          inset 0 1px 0 rgba(255,255,255,0.06);
      }
      .cah-white-card {
        background: linear-gradient(165deg, #fff 0%, #f8f8f8 100%);
        box-shadow:
          0 1px 2px rgba(0,0,0,0.06),
          0 4px 12px rgba(0,0,0,0.06),
          0 1px 0 rgba(0,0,0,0.04);
      }
      .dark .cah-white-card {
        background: linear-gradient(165deg, #1e1e24 0%, #18181b 100%);
        box-shadow:
          0 1px 2px rgba(0,0,0,0.2),
          0 4px 12px rgba(0,0,0,0.15),
          inset 0 1px 0 rgba(255,255,255,0.05);
      }
    `}</style>
  )
}

// ─── Card components ────────────────────────────────────────────────────────

interface BlackCardDisplayProps {
  text: string
  pick: number
  className?: string
}

function BlackCardDisplay({ text, pick, className }: BlackCardDisplayProps) {
  return (
    <div
      className={cn(
        'cah-black-card relative flex min-h-[200px] w-full max-w-sm flex-col justify-between rounded-2xl p-6 text-white sm:min-h-[220px] sm:p-7',
        className
      )}
    >
      {/* CAH-style corner flourish */}
      <div className="absolute right-4 top-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
        CAH
      </div>
      <p className="text-lg font-extrabold leading-relaxed tracking-tight sm:text-xl">
        {text.split('___').map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 && (
              <span className="relative mx-1 inline-block w-20 sm:w-24">
                <span className="absolute bottom-0.5 left-0 right-0 border-b-[3px] border-white/60" />
              </span>
            )}
          </span>
        ))}
      </p>
      {pick > 1 && (
        <div className="mt-4 self-end">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-black tracking-wide text-black">
            PICK
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] text-white">
              {pick}
            </span>
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
  isWinner?: boolean
}

function WhiteCard({
  text,
  selected,
  selectionIndex,
  disabled,
  onClick,
  className,
  isWinner,
}: WhiteCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled && !selected}
      className={cn(
        'cah-white-card group relative flex min-h-[130px] w-full flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 sm:min-h-[140px] sm:rounded-2xl sm:p-5',
        selected
          ? 'z-10 -translate-y-2 border-black/80 ring-2 ring-black/60 dark:border-white/80 dark:ring-white/60'
          : disabled
            ? 'cursor-not-allowed border-transparent opacity-40'
            : 'cursor-pointer border-transparent hover:-translate-y-2 hover:border-black/20 active:translate-y-0 active:scale-[0.98] dark:hover:border-white/20',
        isWinner && 'animate-cah-winner-glow border-amber-400 dark:border-amber-400',
        className
      )}
    >
      <span className="text-sm font-bold leading-snug text-foreground sm:text-base">{text}</span>
      {/* Card bottom edge detail */}
      <div className="mt-3 flex items-end justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/30">
          Cards Against Humanity
        </span>
      </div>
      {selected && selectionIndex !== undefined && (
        <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black text-xs font-black text-white shadow-md dark:bg-white dark:text-black">
          {selectionIndex + 1}
        </span>
      )}
    </button>
  )
}

// Face-down card for unrevealed submissions
function FaceDownCard({ onClick, clickable }: { onClick?: () => void; clickable?: boolean }) {
  return (
    <button
      onClick={clickable ? onClick : undefined}
      className={cn(
        'flex min-h-[80px] items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-secondary/40 transition-all sm:rounded-2xl',
        clickable ? 'cursor-pointer hover:border-border hover:bg-secondary/60' : 'cursor-default'
      )}
    >
      <div className="flex flex-col items-center gap-1 py-4">
        <div className="flex gap-0.5">
          <div className="h-6 w-4 rounded-sm bg-muted-foreground/15" />
          <div className="h-6 w-4 -rotate-3 rounded-sm bg-muted-foreground/10" />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground/50">Hidden</span>
      </div>
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
      <div className="animate-cah-fade-in flex flex-col items-center gap-8">
        {/* Logo / branding */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="cah-black-card flex h-20 w-14 items-center justify-center rounded-xl text-2xl font-black text-white shadow-xl">
              ?
            </div>
            <div className="cah-white-card absolute -right-3 top-1 flex h-20 w-14 -rotate-6 items-center justify-center rounded-xl border text-2xl font-black shadow-xl">
              !
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black tracking-tight">Cards Against Humanity</h2>
            <p className="mt-1 text-sm text-muted-foreground">A party game for horrible people</p>
            <p className="text-xs text-muted-foreground/60">3–10 players</p>
          </div>
        </div>

        {savedSession && (
          <button
            onClick={onRestore}
            className="w-72 rounded-xl border-2 border-dashed border-primary/30 px-6 py-3.5 text-center transition-all hover:border-primary/50 hover:bg-secondary/50"
          >
            <div className="text-sm font-semibold">Resume session</div>
            <div className="text-xs text-muted-foreground">
              {savedSession.playerName} &middot; Room {savedSession.roomCode}
            </div>
          </button>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => setMode('create')}
            className="group flex w-40 flex-col items-center gap-3 rounded-2xl border border-border/50 bg-card px-6 py-6 text-center transition-all hover:-translate-y-1 hover:border-border hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white transition-transform group-hover:scale-110 dark:bg-white dark:text-black">
              <span className="text-2xl font-black">+</span>
            </div>
            <div>
              <span className="block font-bold">Create Room</span>
              <span className="text-xs text-muted-foreground">Host a game</span>
            </div>
          </button>
          <button
            onClick={() => setMode('join')}
            className="group flex w-40 flex-col items-center gap-3 rounded-2xl border border-border/50 bg-card px-6 py-6 text-center transition-all hover:-translate-y-1 hover:border-border hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white transition-transform group-hover:scale-110 dark:bg-white dark:text-black">
              <span className="text-2xl">&rarr;</span>
            </div>
            <div>
              <span className="block font-bold">Join Room</span>
              <span className="text-xs text-muted-foreground">Enter a code</span>
            </div>
          </button>
        </div>
      </div>
    )
  }

  const isCreate = mode === 'create'
  return (
    <div className="animate-cah-slide-up flex w-80 flex-col gap-5">
      <button
        onClick={() => setMode('choose')}
        className="group flex items-center gap-1 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="transition-transform group-hover:-translate-x-0.5">&larr;</span> Back
      </button>
      <h2 className="text-xl font-black">{isCreate ? 'Create Room' : 'Join Room'}</h2>
      {error && (
        <p className="animate-cah-slide-down rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          maxLength={16}
          className="rounded-xl border bg-background px-4 py-2.5 text-sm font-medium outline-none transition-shadow focus:ring-2 focus:ring-primary/30"
        />
      </label>
      {!isCreate && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Room code</span>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. AB12"
            maxLength={4}
            className="rounded-xl border bg-background px-4 py-2.5 text-center text-lg font-black uppercase tracking-[0.3em] outline-none transition-shadow focus:ring-2 focus:ring-primary/30"
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
        className="rounded-xl bg-black px-4 py-3 text-sm font-bold text-white transition-all hover:bg-gray-800 active:scale-[0.98] disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-gray-200"
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

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode).then(
      () => {
        setCopied('code')
        setTimeout(() => setCopied(null), 2000)
      },
      () => {}
    )
  }, [roomCode])

  const copyInviteLink = useCallback(() => {
    navigator.clipboard.writeText(getInviteLink('cards-against-humanity', roomCode)).then(
      () => {
        setCopied('link')
        setTimeout(() => setCopied(null), 2000)
      },
      () => {}
    )
  }, [roomCode])

  return (
    <div className="animate-cah-fade-in flex w-full max-w-sm flex-col gap-5">
      {/* Room code card */}
      <div className="cah-black-card rounded-2xl p-6 text-center text-white">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
          Room code
        </p>
        <p className="mb-4 text-5xl font-black tracking-[0.3em]">{roomCode}</p>
        <div className="flex justify-center gap-2">
          <button
            onClick={copyCode}
            className="rounded-lg bg-white/10 px-4 py-1.5 text-xs font-semibold transition-all hover:bg-white/20 active:scale-95"
          >
            {copied === 'code' ? '✓ Copied!' : 'Copy code'}
          </button>
          <button
            onClick={copyInviteLink}
            className="rounded-lg bg-white/10 px-4 py-1.5 text-xs font-semibold transition-all hover:bg-white/20 active:scale-95"
          >
            {copied === 'link' ? '✓ Copied!' : 'Share link'}
          </button>
        </div>
      </div>

      {/* Players list */}
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <span className="flex h-2 w-2 rounded-full bg-green-400">
            <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75" />
          </span>
          Players ({gameState.players.length}/10)
        </p>
        {gameState.players.map((p, i) => (
          <div
            key={p.id}
            className="animate-cah-slide-up flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 text-sm"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black',
                p.isHost
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                  : p.id === playerId
                    ? 'bg-primary/10 text-primary'
                    : 'bg-secondary text-secondary-foreground'
              )}
            >
              {p.name.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 font-semibold">{p.name}</span>
            {p.isHost && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                HOST
              </span>
            )}
            {p.id === playerId && !p.isHost && (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                YOU
              </span>
            )}
          </div>
        ))}
      </div>

      {isHost && gameState.players.length < 3 && (
        <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-3 text-center">
          <p className="text-xs text-muted-foreground">
            Need at least <span className="font-bold">3 players</span> to start
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground/60">
            Share the room code with friends
          </p>
        </div>
      )}

      <div className="flex gap-3">
        {isHost ? (
          <button
            disabled={gameState.players.length < 3}
            onClick={onStart}
            className="flex-1 rounded-xl bg-black px-4 py-3 text-sm font-bold text-white transition-all hover:bg-gray-800 active:scale-[0.98] disabled:opacity-30 dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            Start Game
          </button>
        ) : (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="animate-cah-float inline-block">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            </span>
            Waiting for host to start
          </div>
        )}
        <button
          onClick={onLeave}
          className="rounded-xl border px-5 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
  const currentPhase = gameState.phase
  const currentBlackCardText = gameState.blackCard?.text
  useEffect(() => {
    const id = requestAnimationFrame(() => setSelectedCards([]))
    return () => cancelAnimationFrame(id)
  }, [currentPhase, currentBlackCardText])

  function handleCardClick(cardIndex: number) {
    if (amCzar || submitted || gameState.phase !== 'playing') return

    setSelectedCards((prev) => {
      if (prev.includes(cardIndex)) {
        return prev.filter((c) => c !== cardIndex)
      }
      if (prev.length >= pick) {
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

  const allRevealed = gameState.revealIndex >= gameState.revealOrder.length - 1

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-5 px-2 sm:px-0">
      {/* Scoreboard */}
      <div className="flex w-full flex-wrap justify-center gap-1.5">
        {gameState.players.map((p) => (
          <div
            key={p.id}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
              czar?.id === p.id
                ? 'cah-black-card scale-105 text-white'
                : p.id === playerId
                  ? 'border border-primary/20 bg-primary/5 text-primary'
                  : 'bg-secondary/60 text-secondary-foreground'
            )}
          >
            <span className="max-w-[4.5rem] truncate">{p.name}</span>
            <span
              className={cn(
                'flex h-5 min-w-[20px] items-center justify-center rounded-md px-1 text-[10px] font-black tabular-nums',
                czar?.id === p.id ? 'bg-white/20' : 'bg-black/5 dark:bg-white/10'
              )}
            >
              {gameState.scores[p.id] ?? 0}
            </span>
            {czar?.id === p.id && (
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">czar</span>
            )}
            {gameState.phase === 'playing' && !amCzar && p.id !== playerId && czar?.id !== p.id && (
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors',
                  hasSubmitted(gameState, p.id) ? 'bg-emerald-400' : 'bg-gray-300 dark:bg-gray-600'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Status bar */}
      <StatusBar
        gameState={gameState}
        amCzar={amCzar}
        submitted={submitted}
        submittedCount={submittedCount}
        totalNeeded={totalNeeded}
        pick={pick}
        czarName={czar?.name}
      />

      {/* Black card */}
      {gameState.blackCard && (
        <div className="flex w-full justify-center">
          <BlackCardDisplay
            text={gameState.blackCard.text}
            pick={gameState.blackCard.pick}
            className="animate-cah-card-deal"
          />
        </div>
      )}

      {/* Judging phase: revealed submissions */}
      {gameState.phase === 'judging' && (
        <div className="flex w-full flex-col gap-3">
          {gameState.revealOrder.map((anonId, idx) => {
            const isRevealed = idx <= gameState.revealIndex
            const cards = gameState.shuffledSubmissions[idx] ?? []

            if (!isRevealed) {
              return <FaceDownCard key={anonId} />
            }

            const canPick = amCzar && allRevealed

            return (
              <button
                key={anonId}
                onClick={() => {
                  if (canPick) onPickWinner(anonId)
                }}
                disabled={!canPick}
                className={cn(
                  'animate-cah-card-flip cah-white-card flex gap-3 rounded-xl border p-4 text-left transition-all sm:rounded-2xl sm:p-5',
                  canPick
                    ? 'cursor-pointer border-transparent hover:-translate-y-1 hover:border-black/30 hover:shadow-xl active:translate-y-0 dark:hover:border-white/30'
                    : 'cursor-default border-transparent'
                )}
              >
                {cards.map((cardIdx) => (
                  <div key={cardIdx} className="flex-1 text-sm font-bold leading-snug sm:text-base">
                    {getWhiteCardText(cardIdx)}
                  </div>
                ))}
              </button>
            )
          })}

          {amCzar && !allRevealed && (
            <button
              onClick={onRevealNext}
              className="animate-cah-float mx-auto mt-1 rounded-xl bg-black px-8 py-3 text-sm font-bold text-white shadow-xl transition-all hover:bg-gray-800 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              Reveal next card
            </button>
          )}

          {amCzar && allRevealed && (
            <p className="animate-cah-slide-up text-center text-xs font-semibold text-muted-foreground">
              Tap the funniest answer to pick a winner!
            </p>
          )}
        </div>
      )}

      {/* Reveal phase: show winner */}
      {gameState.phase === 'reveal' && (
        <RevealPhase gameState={gameState} amCzar={amCzar} onNextRound={onNextRound} />
      )}

      {/* Player's hand (playing phase) */}
      {gameState.phase === 'playing' && !amCzar && !submitted && (
        <div className="w-full">
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              Your hand ({myHand.length})
            </span>
            {selectedCards.length > 0 && (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {selectedCards.length}/{pick} selected
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {myHand.map((cardIndex, i) => (
              <div
                key={cardIndex}
                className="animate-cah-card-deal"
                style={{ animationDelay: `${i * 40}ms` }}
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
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleSubmit}
                className="animate-cah-slide-up rounded-xl bg-black px-8 py-3 text-sm font-bold text-white shadow-xl transition-all hover:bg-gray-800 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                Submit answer{pick > 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Submitted / Czar waiting view */}
      {gameState.phase === 'playing' && (submitted || amCzar) && (
        <div className="w-full py-4 text-center">
          {submitted && (
            <div className="animate-cah-fade-in flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                <span className="text-lg">✓</span>
              </div>
              <p className="text-sm font-semibold text-muted-foreground">
                Answer submitted! Waiting for others&hellip;
              </p>
            </div>
          )}
          {amCzar && !submitted && (
            <div className="animate-cah-fade-in flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">
                You&apos;re the Card Czar this round. Sit back and wait for answers&hellip;
              </p>
            </div>
          )}
        </div>
      )}

      {/* Leave button */}
      <button
        onClick={onLeave}
        className="rounded-lg px-3 py-2 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
      >
        Leave game
      </button>
    </div>
  )
}

function StatusBar({
  gameState,
  amCzar,
  submitted,
  submittedCount,
  totalNeeded,
  pick,
  czarName,
}: {
  gameState: GameState
  amCzar: boolean
  submitted: boolean
  submittedCount: number
  totalNeeded: number
  pick: number
  czarName?: string
}) {
  const text = (() => {
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
      return `${czarName ?? 'Card Czar'} is judging\u2026`
    }
    if (gameState.phase === 'reveal') {
      const winner = gameState.players.find((p) => p.id === gameState.roundWinnerId)
      return `${winner?.name ?? '?'} wins the round!`
    }
    return ''
  })()

  return (
    <div
      className={cn(
        'animate-cah-slide-down w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold transition-colors duration-300',
        gameState.phase === 'reveal'
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
          : amCzar
            ? 'cah-black-card text-white'
            : submitted
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
      )}
    >
      {text}
    </div>
  )
}

function RevealPhase({
  gameState,
  amCzar,
  onNextRound,
}: {
  gameState: GameState
  amCzar: boolean
  onNextRound: () => void
}) {
  const winner = gameState.players.find((p) => p.id === gameState.roundWinnerId)

  return (
    <div className="animate-cah-fade-in flex w-full flex-col items-center gap-5">
      {/* Winning card(s) */}
      <div className="animate-cah-winner-glow w-full rounded-2xl border-2 border-amber-400 bg-card p-5 dark:border-amber-500/60">
        <div className="mb-3 flex items-center gap-2">
          <span className="animate-cah-stamp text-2xl">🏆</span>
          <span className="text-sm font-black">{winner?.name ?? '?'}</span>
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
            +1 POINT
          </span>
        </div>
        <div className="flex gap-3">
          {(gameState.roundWinnerCards ?? []).map((cardIdx) => (
            <div key={cardIdx} className="flex-1 text-base font-bold leading-snug">
              {getWhiteCardText(cardIdx)}
            </div>
          ))}
        </div>
      </div>

      {amCzar ? (
        <button
          onClick={onNextRound}
          className="animate-cah-slide-up rounded-xl bg-black px-8 py-3 text-sm font-bold text-white shadow-xl transition-all hover:bg-gray-800 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          Next round
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">Waiting for Card Czar to continue&hellip;</p>
      )}
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

  const ranked = [...gameState.players].sort(
    (a, b) => (gameState.scores[b.id] ?? 0) - (gameState.scores[a.id] ?? 0)
  )

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="animate-cah-fade-in flex flex-col items-center gap-6">
      {isWinner && showConfetti && <ConfettiEffect />}

      {/* Winner announcement */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="animate-cah-stamp text-6xl">{isWinner ? '🏆' : '🎮'}</div>
        <h2 className="text-3xl font-black tracking-tight">
          {isWinner ? 'You win!' : `${winner?.name ?? '?'} wins!`}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isWinner
            ? 'The most horrible person at the table!'
            : 'Better luck next time, you decent human being.'}
        </p>
      </div>

      {/* Final scoreboard */}
      <div className="flex w-80 flex-col gap-1.5">
        {ranked.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              'animate-cah-slide-up flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm',
              i === 0 ? 'cah-black-card text-white' : 'border border-border/50 bg-card'
            )}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black',
                i === 0 ? 'bg-white/20 text-white' : 'bg-secondary text-muted-foreground'
              )}
            >
              {i + 1}
            </span>
            <span className="flex-1 font-bold">{p.name}</span>
            <span className="text-lg font-black tabular-nums">{gameState.scores[p.id] ?? 0}</span>
            {p.id === playerId && i !== 0 && (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                YOU
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        {isHost ? (
          <button
            onClick={onPlayAgain}
            className="rounded-xl bg-black px-6 py-3 text-sm font-bold text-white shadow-xl transition-all hover:bg-gray-800 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            Play Again
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Waiting for host to start another game&hellip;
          </p>
        )}
        <button
          onClick={onLeave}
          className="rounded-xl border px-6 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          Leave
        </button>
      </div>
    </div>
  )
}

function makeConfettiParticles() {
  return Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 2,
    color: ['#000', '#fff', '#f59e0b', '#6b7280', '#d1d5db', '#1f2937'][i % 6],
    size: 4 + Math.random() * 8,
    rotation: Math.random() * 360,
  }))
}

function ConfettiEffect() {
  const [particles] = useState(makeConfettiParticles)

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: '2px',
            transform: `rotate(${p.rotation}deg)`,
            animation: `cah-confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
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
