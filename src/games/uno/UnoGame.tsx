'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useUnoRoom } from './useUnoRoom'
import {
  canPlayCard,
  getPlayableCards,
  getCurrentPlayer,
  getTopCard,
  type Card,
  type CardColor,
  type GameState,
} from './logic'

// ─── Card rendering ───────────────────────────────────────────────────────────

const COLOR_BG: Record<string, string> = {
  red: 'bg-red-500',
  yellow: 'bg-yellow-400',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  wild: 'bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500',
}

const COLOR_BORDER: Record<string, string> = {
  red: 'border-red-700',
  yellow: 'border-yellow-600',
  green: 'border-green-700',
  blue: 'border-blue-700',
  wild: 'border-purple-700',
}

const ACTIVE_COLOR_BG: Record<CardColor, string> = {
  red: 'bg-red-500',
  yellow: 'bg-yellow-400',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
}

const VALUE_LABEL: Record<string, string> = {
  skip: '⊘',
  reverse: '↩',
  draw2: '+2',
  wild: 'W',
  wild4: '+4',
}

function cardLabel(card: Card): string {
  if (typeof card.value === 'number') return String(card.value)
  return VALUE_LABEL[card.value] ?? card.value
}

interface UnoCardProps {
  card: Card
  size?: 'sm' | 'md' | 'lg'
  playable?: boolean
  selected?: boolean
  faceDown?: boolean
  onClick?: () => void
  currentColor?: CardColor
}

function UnoCard({
  card,
  size = 'md',
  playable,
  selected,
  faceDown,
  onClick,
  currentColor,
}: UnoCardProps) {
  const colorKey = faceDown ? 'wild' : card.color
  const displayColor = card.color === 'wild' && currentColor ? currentColor : card.color

  const sizeClasses = {
    sm: 'w-8 h-12 text-xs rounded',
    md: 'w-14 h-20 text-base rounded-lg',
    lg: 'w-20 h-28 text-2xl rounded-xl',
  }

  return (
    <button
      onClick={onClick}
      disabled={!playable && !faceDown && onClick !== undefined}
      className={cn(
        'relative flex select-none flex-col items-center justify-center border-2 font-bold text-white shadow transition-all duration-150',
        sizeClasses[size],
        faceDown
          ? 'cursor-default border-indigo-900 bg-indigo-700'
          : (COLOR_BG[displayColor] ?? COLOR_BG[colorKey]),
        faceDown ? '' : COLOR_BORDER[colorKey],
        playable &&
          !selected &&
          'cursor-pointer hover:-translate-y-2 hover:scale-105 hover:shadow-lg',
        selected && '-translate-y-3 scale-105 cursor-pointer ring-2 ring-white ring-offset-1',
        !playable && !faceDown && onClick !== undefined && 'cursor-not-allowed opacity-40'
      )}
      title={faceDown ? 'Draw pile' : `${card.color} ${card.value}`}
    >
      {faceDown ? (
        <span className="text-lg font-black tracking-tight">UNO</span>
      ) : (
        <>
          <span className="absolute left-1 top-0.5 text-xs leading-none opacity-90">
            {cardLabel(card)}
          </span>
          <span className={cn(sizeClasses[size] === sizeClasses.lg ? 'text-3xl' : 'text-base')}>
            {cardLabel(card)}
          </span>
          <span className="absolute bottom-0.5 right-1 rotate-180 text-xs leading-none opacity-90">
            {cardLabel(card)}
          </span>
        </>
      )}
    </button>
  )
}

// ─── Color picker ─────────────────────────────────────────────────────────────

const COLORS: CardColor[] = ['red', 'yellow', 'green', 'blue']

interface ColorPickerProps {
  onPick: (color: CardColor) => void
}

function ColorPicker({ onPick }: ColorPickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-background p-6 shadow-xl">
        <p className="text-sm font-semibold">Choose a color</p>
        <div className="grid grid-cols-2 gap-3">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onPick(color)}
              className={cn(
                'h-16 w-16 rounded-xl border-2 border-white/20 font-bold capitalize text-white shadow transition-transform hover:scale-110',
                ACTIVE_COLOR_BG[color]
              )}
            >
              {color}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Screens ──────────────────────────────────────────────────────────────────

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
}

function EntryScreen({
  onCreate,
  onJoin,
  onRestore,
  savedSession,
  loading,
  error,
}: EntryScreenProps) {
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')

  if (mode === 'choose') {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <div className="mb-2 text-5xl">🎴</div>
          <h2 className="text-xl font-bold">UNO Online</h2>
          <p className="text-sm text-muted-foreground">2–10 players</p>
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
            className="flex flex-col items-center gap-1 rounded-2xl bg-secondary px-8 py-5 text-center font-semibold transition-colors hover:bg-secondary/70"
          >
            <span className="text-3xl">🏠</span>
            <span>Create Room</span>
            <span className="text-xs font-normal text-muted-foreground">Host a game</span>
          </button>
          <button
            onClick={() => setMode('join')}
            className="flex flex-col items-center gap-1 rounded-2xl bg-secondary px-8 py-5 text-center font-semibold transition-colors hover:bg-secondary/70"
          >
            <span className="text-3xl">🚪</span>
            <span>Join Room</span>
            <span className="text-xs font-normal text-muted-foreground">Enter a code</span>
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
        className="self-start text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
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
          if (isCreate) onCreate(name.trim())
          else onJoin(joinCode, name.trim())
        }}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
      >
        {loading ? 'Connecting…' : isCreate ? 'Create Room' : 'Join Room'}
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
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex w-80 flex-col gap-5">
      <div className="rounded-2xl bg-secondary p-5 text-center">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Room code — share with friends
        </p>
        <p className="mb-3 text-4xl font-black tracking-widest">{roomCode}</p>
        <button
          onClick={copyCode}
          className="rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors hover:bg-background"
        >
          {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Players ({gameState.players.length}/10)
        </p>
        {gameState.players.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
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
          Waiting for at least one more player…
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
            Waiting for host to start…
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

interface GameBoardProps {
  gameState: GameState
  playerId: string
  onDispatch: (cardId: string, chosenColor?: CardColor) => void
  onDraw: () => void
  onSayUno: () => void
  onLeave: () => void
}

function GameBoard({ gameState, playerId, onDispatch, onDraw, onSayUno, onLeave }: GameBoardProps) {
  const [pendingWild, setPendingWild] = useState<string | null>(null)

  const currentPlayer = getCurrentPlayer(gameState)
  const isMyTurn = currentPlayer?.id === playerId
  const myHand = gameState.hands[playerId] ?? []
  const topCard = getTopCard(gameState)
  const otherPlayers = gameState.players.filter((p) => p.id !== playerId)

  const playableIds =
    isMyTurn && topCard
      ? getPlayableCards(myHand, topCard, gameState.currentColor, gameState.pendingDrawCount)
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
    if (gameState.pendingDrawCount > 0) return `Draw ${gameState.pendingDrawCount} or stack!`
    return 'Your turn'
  }

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-4">
      {pendingWild && <ColorPicker onPick={handleColorPick} />}

      {/* Status */}
      <div
        className={cn(
          'rounded-xl px-5 py-2 text-center text-sm font-semibold',
          isMyTurn
            ? gameState.pendingDrawCount > 0
              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
            : 'bg-secondary text-secondary-foreground'
        )}
      >
        {statusText()}
      </div>

      {/* Other players */}
      <div className="flex flex-wrap justify-center gap-3">
        {otherPlayers.map((p) => {
          const hand = gameState.hands[p.id] ?? []
          const isTurn = currentPlayer?.id === p.id
          const calledUno = gameState.calledUno.includes(p.id)
          return (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium',
                isTurn ? 'bg-primary text-primary-foreground' : 'bg-secondary'
              )}
            >
              <span>{p.name}</span>
              <span className="rounded bg-black/20 px-1.5 py-0.5 font-bold">🃏 {hand.length}</span>
              {calledUno && (
                <span className="rounded bg-red-500 px-1.5 py-0.5 font-black text-white">UNO</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Play area */}
      <div className="flex items-center gap-6">
        {/* Draw pile */}
        <div className="flex flex-col items-center gap-1">
          <UnoCard
            card={{ id: 'draw', color: 'wild', value: 'wild' }}
            size="lg"
            faceDown
            playable={isMyTurn}
            onClick={isMyTurn ? onDraw : undefined}
          />
          <span className="text-xs text-muted-foreground">{gameState.drawPile.length} left</span>
        </div>

        {/* Active color indicator */}
        <div className="flex flex-col items-center gap-1">
          <div
            className={cn(
              'h-6 w-6 rounded-full border-2 border-white/30 shadow',
              ACTIVE_COLOR_BG[gameState.currentColor]
            )}
          />
          <span className="text-xs capitalize text-muted-foreground">{gameState.currentColor}</span>
        </div>

        {/* Discard pile */}
        {topCard && (
          <div className="flex flex-col items-center gap-1">
            <UnoCard card={topCard} size="lg" currentColor={gameState.currentColor} />
            <span className="text-xs text-muted-foreground">discard</span>
          </div>
        )}
      </div>

      {/* My hand */}
      <div className="w-full">
        <p className="mb-2 text-center text-xs text-muted-foreground">
          Your hand ({myHand.length} cards)
          {myHand.length === 1 && !gameState.calledUno.includes(playerId) && (
            <span className="ml-2 font-semibold text-orange-500">— say UNO!</span>
          )}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <div className="mx-auto flex gap-2 px-2">
            {myHand.map((card) => (
              <UnoCard
                key={card.id}
                card={card}
                size="md"
                playable={isMyTurn && playableIds.has(card.id)}
                onClick={() => handleCardClick(card)}
                currentColor={gameState.currentColor}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap justify-center gap-2">
        {isMyTurn && (
          <button
            onClick={onDraw}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold hover:bg-secondary/80"
          >
            {gameState.pendingDrawCount > 0 ? `Draw ${gameState.pendingDrawCount}` : 'Draw card'}
          </button>
        )}
        {myHand.length === 1 && !gameState.calledUno.includes(playerId) && (
          <button
            onClick={onSayUno}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600"
          >
            UNO!
          </button>
        )}
        <button
          onClick={onLeave}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-secondary"
        >
          Leave
        </button>
      </div>

      {/* Direction indicator */}
      <p className="text-xs text-muted-foreground">
        Turn order: {gameState.direction === 1 ? 'clockwise →' : '← counter-clockwise'}
      </p>
    </div>
  )
}

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

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-6xl">{isWinner ? '🏆' : '🎮'}</div>
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
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Play Again
          </button>
        )}
        {!isHost && (
          <p className="text-sm text-muted-foreground">Waiting for host to start another game…</p>
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

// ─── Main component ───────────────────────────────────────────────────────────

export function UnoGame() {
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

  if (!isSupabaseConfigured) return <SetupRequired />

  const isLoading = status === 'creating' || status === 'joining' || status === 'restoring'

  if (!gameState || !playerId || !roomCode) {
    return (
      <EntryScreen
        onCreate={createRoom}
        onJoin={joinRoom}
        onRestore={savedSession ? restoreSession : undefined}
        savedSession={savedSession}
        loading={isLoading}
        error={error}
      />
    )
  }

  if (gameState.phase === 'finished') {
    return (
      <FinishedScreen
        gameState={gameState}
        playerId={playerId}
        onPlayAgain={() => dispatch({ type: 'PLAY_AGAIN', playerId })}
        onLeave={leaveRoom}
      />
    )
  }

  if (gameState.phase === 'lobby') {
    return (
      <LobbyScreen
        gameState={gameState}
        playerId={playerId}
        roomCode={roomCode}
        onStart={() => dispatch({ type: 'START_GAME', playerId })}
        onLeave={leaveRoom}
      />
    )
  }

  return (
    <GameBoard
      gameState={gameState}
      playerId={playerId}
      onDispatch={(cardId, chosenColor) =>
        dispatch({ type: 'PLAY_CARD', playerId, cardId, chosenColor })
      }
      onDraw={() => dispatch({ type: 'DRAW_CARD', playerId })}
      onSayUno={() => dispatch({ type: 'SAY_UNO', playerId })}
      onLeave={leaveRoom}
    />
  )
}

// Re-export canPlayCard to avoid unused import warning
export { canPlayCard }
