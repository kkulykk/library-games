'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { getSavedPlayerName, savePlayerName } from '@/lib/player-name'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useInviteCode, getInviteLink } from '@/hooks/useInviteCode'
import { useUnoRoom } from './useUnoRoom'
import {
  canPlayCard,
  getPlayableCards,
  getCurrentPlayer,
  getTopCard,
  redactForPlayer,
  type Card,
  type CardColor,
  type GameState,
} from './logic'

// ─── Animations (injected once) ─────────────────────────────────────────────

function UnoStyles() {
  return (
    <style>{`
      @keyframes uno-fade-in {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes uno-slide-up {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes uno-card-deal {
        from { opacity: 0; transform: translateY(-30px) rotate(-5deg); }
        to { opacity: 1; transform: translateY(0) rotate(0deg); }
      }
      @keyframes uno-pulse-ring {
        0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
        50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
      }
      @keyframes uno-bounce-sm {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      @keyframes uno-discard-pop {
        0% { transform: scale(0.8) rotate(-8deg); opacity: 0.5; }
        60% { transform: scale(1.05) rotate(1deg); }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
      }
      .animate-uno-fade-in { animation: uno-fade-in 0.3s ease-out; }
      .animate-uno-slide-up { animation: uno-slide-up 0.35s ease-out; }
      .animate-uno-card-deal { animation: uno-card-deal 0.3s ease-out both; }
      .animate-uno-pulse-ring { animation: uno-pulse-ring 1.5s ease-in-out infinite; }
      .animate-uno-bounce-sm { animation: uno-bounce-sm 0.6s ease-in-out infinite; }
      .animate-uno-discard-pop { animation: uno-discard-pop 0.35s ease-out; }
      .uno-hand-scroll { overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none; }
      .uno-hand-scroll::-webkit-scrollbar { display: none; }
    `}</style>
  )
}

// ─── Card rendering (sprite-based) ──────────────────────────────────────────

const SPRITE_URL = '/library-games/uno-cards-deck.svg'

const ACTIVE_COLOR_BG: Record<CardColor, string> = {
  red: 'bg-red-500',
  yellow: 'bg-yellow-400',
  green: 'bg-emerald-500',
  blue: 'bg-blue-500',
}

const ACTIVE_COLOR_RING: Record<CardColor, string> = {
  red: 'ring-red-400',
  yellow: 'ring-yellow-300',
  green: 'ring-emerald-400',
  blue: 'ring-blue-400',
}

/** Map a card to its {row, col} in the sprite grid (14 cols × 8 rows). */
function getCardSpritePos(card: Card): { row: number; col: number } {
  const colorRow: Record<string, number> = { red: 0, yellow: 1, green: 2, blue: 3 }

  // Wild cards: row 0, col 13; Wild Draw 4: row 4, col 13
  if (card.value === 'wild') return { row: 0, col: 13 }
  if (card.value === 'wild4') return { row: 4, col: 13 }

  const row = colorRow[card.color] ?? 0
  if (typeof card.value === 'number') {
    return { row, col: card.value }
  }
  const actionCol: Record<string, number> = { skip: 10, reverse: 11, draw2: 12 }
  return { row, col: actionCol[card.value] ?? 0 }
}

/** CSS background properties to show a single card from the sprite sheet. */
function spriteStyle(card: Card): React.CSSProperties {
  const { row, col } = getCardSpritePos(card)
  // percentage-based positioning: x = col/(cols-1)*100, y = row/(rows-1)*100
  const x = (col / 13) * 100
  const y = (row / 7) * 100
  return {
    backgroundImage: `url(${SPRITE_URL})`,
    backgroundSize: '1400% 800%',
    backgroundPosition: `${x}% ${y}%`,
    backgroundRepeat: 'no-repeat',
  }
}

interface UnoCardProps {
  card: Card
  size?: 'sm' | 'md' | 'lg'
  playable?: boolean
  selected?: boolean
  faceDown?: boolean
  onClick?: () => void
  className?: string
  style?: React.CSSProperties
}

function UnoCard({
  card,
  size = 'md',
  playable,
  selected,
  faceDown,
  onClick,
  className,
  style,
}: UnoCardProps) {
  // 2:3 aspect ratio sizes matching actual card proportions
  const sizeClasses = {
    sm: 'w-9 h-[3.375rem] rounded-md',
    md: 'w-[3.25rem] h-[4.875rem] sm:w-14 sm:h-[5.25rem] rounded-lg',
    lg: 'w-16 h-24 sm:w-[4.75rem] sm:h-[7.125rem] rounded-xl',
  }

  return (
    <button
      onClick={onClick}
      disabled={!playable && !faceDown && onClick !== undefined}
      className={cn(
        'relative select-none overflow-hidden shadow-md transition-all duration-200',
        sizeClasses[size],
        playable &&
          !selected &&
          'cursor-pointer hover:-translate-y-2 hover:shadow-xl hover:brightness-110 active:scale-95',
        selected &&
          '-translate-y-3 scale-105 cursor-pointer shadow-xl ring-2 ring-white ring-offset-2 ring-offset-black/50',
        !playable && !faceDown && onClick !== undefined && 'cursor-not-allowed opacity-40',
        faceDown && 'cursor-default',
        className
      )}
      style={faceDown ? style : { ...spriteStyle(card), ...style }}
      title={faceDown ? 'Draw pile' : `${card.color} ${card.value}`}
    >
      {faceDown && (
        <div className="flex h-full w-full items-center justify-center rounded-[inherit] border-2 border-gray-800 bg-gray-900">
          <div className="absolute inset-[3px] rounded-[inherit] border border-gray-700" />
          <div className="relative flex h-[55%] w-[65%] items-center justify-center rounded-[50%] bg-red-600 shadow-inner">
            <span
              className="text-xs font-black tracking-tight text-yellow-300 sm:text-sm"
              style={{
                transform: 'rotate(-15deg)',
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
              }}
            >
              UNO
            </span>
          </div>
        </div>
      )}
    </button>
  )
}

// ─── Color picker ────────────────────────────────────────────────────────────

const COLORS: CardColor[] = ['red', 'yellow', 'green', 'blue']

const COLOR_PICKER_STYLES: Record<CardColor, string> = {
  red: 'bg-red-500 hover:bg-red-400',
  yellow: 'bg-yellow-400 hover:bg-yellow-300',
  green: 'bg-emerald-500 hover:bg-emerald-400',
  blue: 'bg-blue-500 hover:bg-blue-400',
}

interface ColorPickerProps {
  onPick: (color: CardColor) => void
}

function ColorPicker({ onPick }: ColorPickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-uno-fade-in flex flex-col items-center gap-5 rounded-3xl bg-gray-900/95 p-7 shadow-2xl ring-1 ring-white/10">
        <p className="text-base font-bold text-white">Choose a color</p>
        <div className="grid grid-cols-2 gap-4">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onPick(color)}
              className={cn(
                'h-16 w-16 rounded-full border-[3px] border-white/30 shadow-lg sm:h-20 sm:w-20',
                'transition-all duration-150 hover:scale-110 hover:border-white/60 active:scale-95',
                COLOR_PICKER_STYLES[color]
              )}
              title={color}
            >
              <span className="text-sm font-bold capitalize text-white drop-shadow sm:text-base">
                {color}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Screens ─────────────────────────────────────────────────────────────────

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
      <div className="animate-uno-fade-in flex flex-col items-center gap-6">
        <div className="text-center">
          <div className="mb-3 flex justify-center gap-1">
            {['red', 'yellow', 'green', 'blue'].map((c) => (
              <div
                key={c}
                className={cn('h-10 w-7 rounded-md shadow-md', {
                  'bg-red-500': c === 'red',
                  '-ml-1 -rotate-6 bg-yellow-400': c === 'yellow',
                  '-ml-1 rotate-3 bg-emerald-500': c === 'green',
                  '-ml-1 rotate-6 bg-blue-500': c === 'blue',
                })}
              />
            ))}
          </div>
          <h2 className="text-xl font-black tracking-tight">UNO Online</h2>
          <p className="text-sm text-muted-foreground">2-10 players</p>
        </div>
        {savedSession && (
          <button
            onClick={onRestore}
            className="w-64 rounded-xl border-2 border-dashed border-primary/40 px-6 py-3 text-center text-sm transition-colors hover:bg-secondary"
          >
            <div className="font-semibold">Resume session</div>
            <div className="text-xs text-muted-foreground">
              {savedSession.playerName} · Room {savedSession.roomCode}
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
    <div className="animate-uno-slide-up flex w-72 flex-col gap-4">
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
    navigator.clipboard.writeText(getInviteLink('uno', roomCode)).then(
      () => {
        setCopied('link')
        setTimeout(() => setCopied(null), 2000)
      },
      () => {}
    )
  }

  return (
    <div className="animate-uno-fade-in flex w-80 flex-col gap-5">
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
            className="animate-uno-slide-up flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
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

      {isHost && gameState.players.length < 2 && (
        <p className="text-center text-xs text-muted-foreground">
          Waiting for at least one more player&hellip;
        </p>
      )}

      <div className="flex gap-3">
        {isHost && (
          <button
            disabled={gameState.players.length < 2}
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

// ─── Game Board ──────────────────────────────────────────────────────────────

interface GameBoardProps {
  gameState: GameState
  playerId: string
  onDispatch: (cardId: string, chosenColor?: CardColor) => void
  onDraw: () => void
  onPassAfterDraw: () => void
  onSayUno: () => void
  onCatchUno: (targetId: string) => void
  onLeave: () => void
}

function GameBoard({
  gameState,
  playerId,
  onDispatch,
  onDraw,
  onPassAfterDraw,
  onSayUno,
  onCatchUno,
  onLeave,
}: GameBoardProps) {
  const [pendingWild, setPendingWild] = useState<string | null>(null)
  const [discardKey, setDiscardKey] = useState(0)
  const prevTopCardRef = useRef<string | null>(null)

  const currentPlayer = getCurrentPlayer(gameState)
  const isMyTurn = currentPlayer?.id === playerId
  const myHand = gameState.hands[playerId] ?? []
  const topCard = getTopCard(gameState)
  const otherPlayers = gameState.players.filter((p) => p.id !== playerId)
  const hasDrawnCard = gameState.drawnCardId !== null && isMyTurn
  const mustDraw = isMyTurn && gameState.pendingDrawCount > 0

  // Track discard pile changes for animation
  const topCardId = topCard?.id ?? null
  useEffect(() => {
    if (topCardId !== prevTopCardRef.current) {
      setDiscardKey((k) => k + 1)
      prevTopCardRef.current = topCardId
    }
  }, [topCardId])

  const playableIds =
    isMyTurn && topCard
      ? getPlayableCards(
          myHand,
          topCard,
          gameState.currentColor,
          gameState.pendingDrawCount,
          gameState.drawnCardId
        )
      : new Set<string>()

  function handleCardClick(card: Card) {
    if (!isMyTurn || !playableIds.has(card.id)) return
    if (card.color === 'wild') {
      setPendingWild(card.id)
    } else {
      onDispatch(card.id)
    }
  }

  function handleColorPick(color: CardColor) {
    if (pendingWild) {
      onDispatch(pendingWild, color)
      setPendingWild(null)
    }
  }

  const statusText = () => {
    if (!isMyTurn) return `${currentPlayer?.name ?? '?'}'s turn`
    if (mustDraw) return `You must draw ${gameState.pendingDrawCount} cards`
    if (hasDrawnCard) return 'Play the drawn card or pass'
    return 'Your turn — play a card or draw'
  }

  // Track current time so we can hide the Catch button during the grace window
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const windows = Object.values(gameState.unoWindow)
    const nextExpiry = windows.filter((w) => w > Date.now()).sort((a, b) => a - b)[0]
    if (!nextExpiry) return
    const delay = nextExpiry - Date.now()
    const timer = setTimeout(() => setNow(Date.now()), delay + 50)
    return () => clearTimeout(timer)
  }, [gameState.unoWindow])

  // Check if any opponent can be caught (has 1 card, didn't call UNO, grace window expired)
  const catchableTargets = otherPlayers.filter((p) => {
    const hand = gameState.hands[p.id] ?? []
    const windowUntil = gameState.unoWindow[p.id] ?? 0
    return hand.length === 1 && !gameState.calledUno.includes(p.id) && now >= windowUntil
  })

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-3 px-2 sm:gap-4 sm:px-0">
      {pendingWild && <ColorPicker onPick={handleColorPick} />}

      {/* Status bar */}
      <div
        className={cn(
          'animate-uno-fade-in w-full rounded-xl px-4 py-2 text-center text-sm font-semibold transition-colors duration-300 sm:px-5',
          isMyTurn
            ? mustDraw
              ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-300 dark:bg-orange-500/20 dark:text-orange-300 dark:ring-orange-500/30'
              : hasDrawnCard
                ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/30'
                : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/30'
            : 'bg-secondary text-secondary-foreground'
        )}
      >
        {isMyTurn && (
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
        )}
        {statusText()}
      </div>

      {/* Other players */}
      <div className="flex w-full flex-wrap justify-center gap-2">
        {otherPlayers.map((p) => {
          const hand = gameState.hands[p.id] ?? []
          const isTurn = currentPlayer?.id === p.id
          const calledUno = gameState.calledUno.includes(p.id)
          const isCatchable = catchableTargets.includes(p)

          return (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-300 sm:gap-2',
                isTurn
                  ? 'bg-primary/90 text-primary-foreground shadow-md'
                  : 'bg-secondary/80 text-secondary-foreground'
              )}
            >
              {isTurn && (
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              )}
              <span className="max-w-[5rem] truncate">{p.name}</span>
              {/* Mini card count */}
              <span className="rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                {hand.length}
              </span>
              {calledUno && (
                <span className="rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                  UNO
                </span>
              )}
              {isCatchable && (
                <button
                  onClick={() => onCatchUno(p.id)}
                  className="animate-uno-bounce-sm rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white transition-transform hover:scale-110 active:scale-95"
                >
                  Catch!
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Play area */}
      <div className="relative flex w-full items-center justify-center gap-4 rounded-2xl bg-emerald-100 px-4 py-6 shadow-inner sm:gap-8 sm:px-8 sm:py-8 dark:bg-emerald-950/40">
        {/* Direction indicator */}
        <div className="absolute right-3 top-2 flex items-center gap-1 text-xs text-emerald-600/60 sm:right-4 sm:top-3 dark:text-emerald-400/60">
          <span
            className="inline-block transition-transform duration-500"
            style={{
              transform: gameState.direction === 1 ? 'scaleX(1)' : 'scaleX(-1)',
            }}
          >
            &rarr;
          </span>
          <span className="hidden sm:inline">
            {gameState.direction === 1 ? 'clockwise' : 'counter-clockwise'}
          </span>
        </div>

        {/* Draw pile */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative">
            {/* Stacked card effect */}
            <div className="absolute -right-0.5 -top-0.5 h-full w-full rounded-xl border-2 border-gray-300 bg-gray-200 dark:border-gray-800 dark:bg-gray-900/50" />
            <div className="relative">
              <UnoCard
                card={{ id: 'draw', color: 'wild', value: 'wild' }}
                size="lg"
                faceDown
                playable={isMyTurn && !hasDrawnCard}
                onClick={isMyTurn && !hasDrawnCard ? onDraw : undefined}
                className={cn(
                  isMyTurn && !hasDrawnCard && 'hover:shadow-lg hover:shadow-yellow-500/20'
                )}
              />
            </div>
          </div>
          <span className="text-[10px] tabular-nums text-emerald-700/70 sm:text-xs dark:text-emerald-400/50">
            {gameState.drawPile.length}
          </span>
        </div>

        {/* Active color indicator */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className={cn(
              'h-7 w-7 rounded-full border-2 border-white/20 shadow-lg ring-2 transition-all duration-300 sm:h-8 sm:w-8',
              ACTIVE_COLOR_BG[gameState.currentColor],
              ACTIVE_COLOR_RING[gameState.currentColor]
            )}
          />
          <span className="text-[10px] capitalize text-emerald-700/70 sm:text-xs dark:text-emerald-400/50">
            {gameState.currentColor}
          </span>
        </div>

        {/* Discard pile */}
        <div className="flex flex-col items-center gap-1.5">
          {topCard && (
            <div key={discardKey} className="animate-uno-discard-pop">
              <UnoCard card={topCard} size="lg" />
            </div>
          )}
          <span className="text-[10px] text-emerald-700/70 sm:text-xs dark:text-emerald-400/50">
            discard
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {isMyTurn && !hasDrawnCard && (
          <button
            onClick={onDraw}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-semibold shadow transition-all active:scale-95',
              mustDraw
                ? 'animate-uno-bounce-sm bg-orange-500 text-white hover:bg-orange-400'
                : 'bg-secondary hover:bg-secondary/80'
            )}
          >
            {mustDraw ? `Draw ${gameState.pendingDrawCount}` : 'Draw card'}
          </button>
        )}

        {hasDrawnCard && (
          <button
            onClick={onPassAfterDraw}
            className="rounded-xl bg-secondary px-4 py-2 text-sm font-semibold shadow transition-all hover:bg-secondary/80 active:scale-95"
          >
            Pass
          </button>
        )}

        {myHand.length === 1 && !gameState.calledUno.includes(playerId) && (
          <button
            onClick={onSayUno}
            className="animate-uno-pulse-ring rounded-xl bg-red-500 px-5 py-2 text-sm font-black text-white shadow-lg transition-all hover:bg-red-400 active:scale-95"
          >
            UNO!
          </button>
        )}

        <button
          onClick={onLeave}
          className="rounded-xl border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary sm:text-sm"
        >
          Leave
        </button>
      </div>

      {/* Player's hand */}
      <div className="w-full">
        <p className="mb-1.5 text-center text-xs text-muted-foreground">
          Your hand ({myHand.length})
          {hasDrawnCard && (
            <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">
              &mdash; play drawn card or pass
            </span>
          )}
        </p>
        <div className="uno-hand-scroll p-4 pt-5">
          <div className="mx-auto flex w-fit items-end justify-center">
            {myHand.map((card, i) => {
              const isDrawn = card.id === gameState.drawnCardId
              return (
                <div
                  key={card.id}
                  className={cn(
                    'transition-all duration-200',
                    i > 0 && '-ml-2 sm:-ml-3',
                    isDrawn && 'relative z-10'
                  )}
                  style={{
                    animationDelay: `${i * 30}ms`,
                  }}
                >
                  <UnoCard
                    card={card}
                    size="md"
                    playable={isMyTurn && playableIds.has(card.id)}
                    onClick={() => handleCardClick(card)}
                    className={cn(
                      isDrawn && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-black/50'
                    )}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Finished screen ─────────────────────────────────────────────────────────

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

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="animate-uno-fade-in flex flex-col items-center gap-6">
      {isWinner && showConfetti && <ConfettiEffect />}
      <div className="text-6xl">{isWinner ? '\uD83C\uDFC6' : '\uD83C\uDFAE'}</div>
      <div className="text-center">
        <h2 className="text-2xl font-black">
          {isWinner ? 'You win!' : `${winner?.name ?? '?'} wins!`}
        </h2>
        <p className="text-muted-foreground">
          {isWinner ? 'Nicely played!' : 'Better luck next time!'}
        </p>
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
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.5 + Math.random() * 1.5,
    color: ['#ef4444', '#eab308', '#22c55e', '#3b82f6'][i % 4],
    size: 4 + Math.random() * 6,
  }))

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

// ─── Main component ──────────────────────────────────────────────────────────

export function UnoGame() {
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
  } = useUnoRoom()

  // Redact opponent hands from client state to prevent devtools inspection.
  // Must be called unconditionally (React hooks rules).
  const redactedState = useMemo(
    () => (gameState && playerId ? redactForPlayer(gameState, playerId) : gameState),
    [gameState, playerId]
  )

  if (!isSupabaseConfigured) return <SetupRequired />

  const isLoading = status === 'creating' || status === 'joining' || status === 'restoring'

  if (!gameState || !playerId || !roomCode) {
    return (
      <>
        <UnoStyles />
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
        <UnoStyles />
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
        <UnoStyles />
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
      <UnoStyles />
      <GameBoard
        gameState={redactedState!}
        playerId={playerId}
        onDispatch={(cardId, chosenColor) =>
          dispatch({ type: 'PLAY_CARD', playerId, cardId, chosenColor, now: Date.now() })
        }
        onDraw={() => dispatch({ type: 'DRAW_CARD', playerId })}
        onPassAfterDraw={() => dispatch({ type: 'PASS_AFTER_DRAW', playerId })}
        onSayUno={() => dispatch({ type: 'SAY_UNO', playerId })}
        onCatchUno={(targetId) =>
          dispatch({ type: 'CATCH_UNO', playerId, targetId, now: Date.now() })
        }
        onLeave={leaveRoom}
      />
    </>
  )
}

// Re-export to avoid unused import warning
export { canPlayCard }
