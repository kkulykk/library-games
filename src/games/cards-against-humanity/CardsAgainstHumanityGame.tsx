'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useCardsAgainstHumanityRoom } from './useCardsAgainstHumanityRoom'
import { getCzar, getNonCzarPlayers, type BlackCard, type GameState, type WhiteCard } from './logic'

// ─── Styles ───────────────────────────────────────────────────────────────────

function CahStyles() {
  return (
    <style>{`
      @keyframes cah-fade-in {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes cah-card-flip {
        0% { opacity: 0; transform: rotateY(-90deg) scale(0.9); }
        100% { opacity: 1; transform: rotateY(0deg) scale(1); }
      }
      @keyframes cah-pop {
        0% { transform: scale(0.85); opacity: 0; }
        60% { transform: scale(1.04); }
        100% { transform: scale(1); opacity: 1; }
      }
      .animate-cah-fade-in { animation: cah-fade-in 0.35s ease-out both; }
      .animate-cah-card-flip { animation: cah-card-flip 0.4s ease-out both; }
      .animate-cah-pop { animation: cah-pop 0.35s ease-out both; }
      .cah-hand-scroll { overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none; }
      .cah-hand-scroll::-webkit-scrollbar { display: none; }
    `}</style>
  )
}

// ─── Black card display ───────────────────────────────────────────────────────

function BlackCardDisplay({ card, className }: { card: BlackCard; className?: string }) {
  // Render blanks as underlines
  const parts = card.text.split('_')
  return (
    <div
      className={cn(
        'rounded-2xl bg-black p-6 text-white shadow-xl',
        'flex min-h-[180px] flex-col justify-between',
        className
      )}
    >
      <p className="text-xl font-bold leading-relaxed">
        {parts.length > 1
          ? parts.map((part, i) => (
              <span key={i}>
                {part}
                {i < parts.length - 1 && (
                  <span className="mx-1 inline-block min-w-[80px] border-b-2 border-white align-bottom" />
                )}
              </span>
            ))
          : card.text}
      </p>
      {card.pick > 1 && (
        <p className="mt-3 text-sm font-semibold text-gray-400">PICK {card.pick}</p>
      )}
    </div>
  )
}

// ─── White card ───────────────────────────────────────────────────────────────

function WhiteCardTile({
  card,
  selected,
  selectionIndex,
  onClick,
  disabled,
  className,
}: {
  card: WhiteCard
  selected: boolean
  selectionIndex?: number
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative rounded-xl border-2 bg-white p-4 text-left text-black shadow-md transition-all duration-150',
        'min-h-[120px] min-w-[140px] flex-shrink-0',
        selected
          ? 'scale-[1.03] border-black ring-2 ring-black ring-offset-2'
          : 'border-gray-200 hover:border-gray-400 hover:shadow-lg',
        disabled && !selected && 'cursor-not-allowed opacity-50',
        !disabled && 'cursor-pointer active:scale-[0.98]',
        className
      )}
    >
      {selected && selectionIndex !== undefined && (
        <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
          {selectionIndex + 1}
        </span>
      )}
      <p className="text-sm font-semibold leading-snug">{card.text}</p>
    </button>
  )
}

// ─── Submission pile (czar view) ──────────────────────────────────────────────

function SubmissionPile({
  cards,
  onPick,
  canPick,
  picked,
}: {
  cards: WhiteCard[]
  onPick: () => void
  canPick: boolean
  picked: boolean
}) {
  return (
    <button
      onClick={canPick ? onPick : undefined}
      disabled={!canPick || picked}
      className={cn(
        'rounded-xl border-2 bg-white p-5 text-left text-black shadow-md transition-all duration-150',
        'min-w-[160px]',
        canPick &&
          !picked &&
          'cursor-pointer hover:scale-[1.03] hover:border-black hover:shadow-xl',
        picked && 'border-green-500 ring-2 ring-green-400 ring-offset-2',
        !canPick && 'cursor-default',
        'animate-cah-pop'
      )}
    >
      <div className="space-y-2">
        {cards.map((c, i) => (
          <p key={i} className="text-sm font-semibold leading-snug">
            {c.text}
          </p>
        ))}
      </div>
    </button>
  )
}

// ─── Lobby / join screen ──────────────────────────────────────────────────────

function LobbyScreen({
  onCreateRoom,
  onJoinRoom,
  onRestoreSession,
  savedSession,
  status,
  error,
}: {
  onCreateRoom: (name: string) => void
  onJoinRoom: (code: string, name: string) => void
  onRestoreSession: () => void
  savedSession: { roomCode: string; playerName: string } | null
  status: string
  error: string | null
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu')
  const busy = status === 'creating' || status === 'joining' || status === 'restoring'

  if (mode === 'create') {
    return (
      <div className="animate-cah-fade-in flex flex-col items-center gap-6">
        <h2 className="text-2xl font-bold">Create Room</h2>
        <input
          className="w-64 rounded-lg border-2 border-gray-300 px-4 py-2 text-center text-lg focus:border-black focus:outline-none"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onCreateRoom(name.trim())}
          autoFocus
        />
        <div className="flex gap-3">
          <button
            onClick={() => setMode('menu')}
            className="rounded-lg border-2 border-gray-300 px-5 py-2 font-semibold transition-colors hover:border-gray-500"
          >
            Back
          </button>
          <button
            disabled={!name.trim() || busy}
            onClick={() => onCreateRoom(name.trim())}
            className="rounded-lg bg-black px-6 py-2 font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  if (mode === 'join') {
    return (
      <div className="animate-cah-fade-in flex flex-col items-center gap-6">
        <h2 className="text-2xl font-bold">Join Room</h2>
        <input
          className="w-64 rounded-lg border-2 border-gray-300 px-4 py-2 text-center text-lg uppercase tracking-widest focus:border-black focus:outline-none"
          placeholder="Room code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
          maxLength={4}
          autoFocus
        />
        <input
          className="w-64 rounded-lg border-2 border-gray-300 px-4 py-2 text-center text-lg focus:border-black focus:outline-none"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          onKeyDown={(e) =>
            e.key === 'Enter' && code.length === 4 && name.trim() && onJoinRoom(code, name.trim())
          }
        />
        <div className="flex gap-3">
          <button
            onClick={() => setMode('menu')}
            className="rounded-lg border-2 border-gray-300 px-5 py-2 font-semibold transition-colors hover:border-gray-500"
          >
            Back
          </button>
          <button
            disabled={code.length !== 4 || !name.trim() || busy}
            onClick={() => onJoinRoom(code, name.trim())}
            className="rounded-lg bg-black px-6 py-2 font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? 'Joining…' : 'Join'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="animate-cah-fade-in flex flex-col items-center gap-6">
      <div className="text-center">
        <p className="mb-1 text-lg text-gray-600">A party game for horrible people.</p>
        <p className="text-sm text-gray-400">3–10 players · Requires Supabase</p>
      </div>

      {savedSession && (
        <div className="w-full max-w-xs rounded-xl border-2 border-dashed border-gray-300 p-4 text-center">
          <p className="text-sm text-gray-600">
            Rejoin as <strong>{savedSession.playerName}</strong> in room{' '}
            <strong className="tracking-widest">{savedSession.roomCode}</strong>?
          </p>
          <button
            onClick={onRestoreSession}
            disabled={busy}
            className="mt-2 rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            {busy ? 'Restoring…' : 'Rejoin'}
          </button>
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={() => setMode('create')}
          className="rounded-xl bg-black px-8 py-3 text-lg font-bold text-white shadow-lg transition-colors hover:bg-gray-800"
        >
          Create Room
        </button>
        <button
          onClick={() => setMode('join')}
          className="rounded-xl border-2 border-black px-8 py-3 text-lg font-bold text-black transition-colors hover:bg-gray-100"
        >
          Join Room
        </button>
      </div>
    </div>
  )
}

// ─── Waiting room ─────────────────────────────────────────────────────────────

function WaitingRoom({
  gameState,
  playerId,
  roomCode,
  onStart,
  onLeave,
}: {
  gameState: GameState
  playerId: string
  roomCode: string
  onStart: (pointsToWin: number) => void
  onLeave: () => void
}) {
  const [pointsToWin, setPointsToWin] = useState(5)
  const me = gameState.players.find((p) => p.id === playerId)
  const isHost = me?.isHost ?? false
  const canStart = gameState.players.length >= 3

  return (
    <div className="animate-cah-fade-in flex w-full max-w-sm flex-col items-center gap-6">
      <div className="text-center">
        <p className="mb-1 text-sm text-gray-500">Room Code</p>
        <p className="font-mono text-4xl font-black tracking-[0.25em]">{roomCode}</p>
        <p className="mt-1 text-xs text-gray-400">Share this with friends</p>
      </div>

      <div className="w-full rounded-2xl border-2 border-gray-200 p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
          Players ({gameState.players.length}/10)
        </h3>
        <ul className="space-y-2">
          {gameState.players.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span
                className={cn(
                  'size-2 rounded-full',
                  p.id === playerId ? 'bg-green-500' : 'bg-gray-300'
                )}
              />
              <span className="font-medium">{p.name}</span>
              {p.isHost && (
                <span className="ml-auto text-xs font-semibold text-gray-400">HOST</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {!canStart && (
        <p className="text-center text-sm text-gray-500">Waiting for at least 3 players to join…</p>
      )}

      {isHost && (
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center gap-3">
            <label className="whitespace-nowrap text-sm font-semibold text-gray-600">
              Points to win:
            </label>
            <select
              value={pointsToWin}
              onChange={(e) => setPointsToWin(Number(e.target.value))}
              className="rounded-lg border-2 border-gray-200 px-3 py-1.5 font-semibold focus:border-black focus:outline-none"
            >
              {[3, 5, 7, 10, 15].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            disabled={!canStart}
            onClick={() => onStart(pointsToWin)}
            className="w-full rounded-xl bg-black py-3 text-lg font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
          >
            Start Game
          </button>
        </div>
      )}

      <button
        onClick={onLeave}
        className="text-sm text-gray-400 transition-colors hover:text-gray-700"
      >
        Leave room
      </button>
    </div>
  )
}

// ─── Scoreboard strip ──────────────────────────────────────────────────────────

function Scoreboard({ gameState, playerId }: { gameState: GameState; playerId: string }) {
  const sorted = [...gameState.players].sort((a, b) => b.score - a.score)
  return (
    <div className="flex w-full flex-wrap justify-center gap-2">
      {sorted.map((p) => (
        <div
          key={p.id}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold',
            p.id === playerId ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
          )}
        >
          <span>{p.name}</span>
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-xs font-black',
              p.id === playerId ? 'bg-white text-black' : 'bg-gray-300 text-gray-700'
            )}
          >
            {p.score}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Playing phase ────────────────────────────────────────────────────────────

function PlayingPhase({
  gameState,
  playerId,
  onSubmit,
}: {
  gameState: GameState
  playerId: string
  onSubmit: (cards: WhiteCard[]) => void
}) {
  const [selected, setSelected] = useState<WhiteCard[]>([])
  const czar = getCzar(gameState)
  const isCzar = czar?.id === playerId
  const hasSubmitted = playerId in gameState.submissions
  const pick = gameState.currentBlackCard?.pick ?? 1
  const hand = gameState.hands[playerId] ?? []
  const submittedCount = Object.keys(gameState.submissions).length
  const nonCzarCount = getNonCzarPlayers(gameState).length

  function toggleCard(card: WhiteCard) {
    setSelected((prev) => {
      const exists = prev.findIndex((c) => c.text === card.text)
      if (exists !== -1) return prev.filter((_, i) => i !== exists)
      if (prev.length >= pick) return [...prev.slice(1), card]
      return [...prev, card]
    })
  }

  function handleSubmit() {
    if (selected.length === pick) {
      onSubmit(selected)
      setSelected([])
    }
  }

  return (
    <div className="animate-cah-fade-in flex w-full max-w-2xl flex-col items-center gap-6">
      {/* Black card */}
      {gameState.currentBlackCard && (
        <BlackCardDisplay card={gameState.currentBlackCard} className="w-full max-w-sm" />
      )}

      {isCzar ? (
        <div className="space-y-2 text-center">
          <p className="text-2xl font-bold">You are the Card Czar 👑</p>
          <p className="text-gray-500">Sit back and wait while others play their cards…</p>
          <p className="text-sm text-gray-400">
            {submittedCount} / {nonCzarCount} submitted
          </p>
        </div>
      ) : hasSubmitted ? (
        <div className="space-y-2 text-center">
          <p className="text-xl font-bold text-green-600">Cards submitted! ✓</p>
          <p className="text-gray-500">
            Waiting for others… ({submittedCount} / {nonCzarCount})
          </p>
        </div>
      ) : (
        <>
          <p className="font-semibold text-gray-600">
            Pick {pick} card{pick > 1 ? 's' : ''} from your hand
          </p>
          {selected.length > 0 && (
            <div className="w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Your pick
              </p>
              <div className="flex flex-wrap gap-2">
                {selected.map((c, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-black px-3 py-1 text-sm font-semibold text-white"
                  >
                    {c.text}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="cah-hand-scroll w-full pb-2">
            <div className="flex w-max gap-3 px-1">
              {hand.map((card, i) => {
                const selIdx = selected.findIndex((c) => c.text === card.text)
                return (
                  <WhiteCardTile
                    key={i}
                    card={card}
                    selected={selIdx !== -1}
                    selectionIndex={selIdx !== -1 ? selIdx : undefined}
                    onClick={() => toggleCard(card)}
                    className="animate-cah-card-flip"
                  />
                )
              })}
            </div>
          </div>

          <button
            disabled={selected.length !== pick}
            onClick={handleSubmit}
            className="rounded-xl bg-black px-8 py-3 text-lg font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
          >
            Submit {pick > 1 ? `${pick} Cards` : 'Card'}
          </button>
        </>
      )}
    </div>
  )
}

// ─── Judging phase ────────────────────────────────────────────────────────────

function JudgingPhase({
  gameState,
  playerId,
  onJudge,
}: {
  gameState: GameState
  playerId: string
  onJudge: (winnerId: string) => void
}) {
  const [pickedId, setPickedId] = useState<string | null>(null)
  const czar = getCzar(gameState)
  const isCzar = czar?.id === playerId

  function handlePick(winnerId: string) {
    setPickedId(winnerId)
    onJudge(winnerId)
  }

  return (
    <div className="animate-cah-fade-in flex w-full max-w-2xl flex-col items-center gap-6">
      {gameState.currentBlackCard && (
        <BlackCardDisplay card={gameState.currentBlackCard} className="w-full max-w-sm" />
      )}

      {isCzar ? (
        <>
          <p className="text-center text-xl font-bold">Pick the funniest answer, Card Czar! 👑</p>
          <div className="flex w-full flex-wrap justify-center gap-4">
            {gameState.judgeOrder.map((submitterId) => {
              const cards = gameState.submissions[submitterId] ?? []
              return (
                <SubmissionPile
                  key={submitterId}
                  cards={cards}
                  onPick={() => handlePick(submitterId)}
                  canPick={pickedId === null}
                  picked={pickedId === submitterId}
                />
              )
            })}
          </div>
        </>
      ) : (
        <>
          <p className="text-center text-xl font-bold">The Card Czar is choosing… 🤔</p>
          <div className="flex w-full flex-wrap justify-center gap-4">
            {gameState.judgeOrder.map((submitterId) => {
              const cards = gameState.submissions[submitterId] ?? []
              const isMe = submitterId === playerId
              return (
                <div
                  key={submitterId}
                  className={cn(
                    'animate-cah-pop min-w-[160px] rounded-xl border-2 bg-white p-5 text-left text-black shadow-md',
                    isMe && 'border-blue-400 ring-2 ring-blue-300'
                  )}
                >
                  {isMe && <p className="mb-2 text-xs font-bold uppercase text-blue-500">Yours</p>}
                  <div className="space-y-2">
                    {cards.map((c, i) => (
                      <p key={i} className="text-sm font-semibold leading-snug">
                        {c.text}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Round end ────────────────────────────────────────────────────────────────

function RoundEndPhase({
  gameState,
  playerId,
  onNextRound,
}: {
  gameState: GameState
  playerId: string
  onNextRound: () => void
}) {
  const winner = gameState.players.find((p) => p.id === gameState.roundWinnerId)
  const winningCards = gameState.roundWinnerId
    ? (gameState.submissions[gameState.roundWinnerId] ?? [])
    : []
  const isMe = gameState.roundWinnerId === playerId

  return (
    <div className="animate-cah-fade-in flex w-full max-w-lg flex-col items-center gap-6 text-center">
      <p className="text-4xl">{isMe ? '🎉' : '🏆'}</p>
      <p className="text-2xl font-black">
        {isMe ? 'You won this round!' : `${winner?.name} wins this round!`}
      </p>

      {gameState.currentBlackCard && (
        <BlackCardDisplay card={gameState.currentBlackCard} className="w-full" />
      )}

      <div className="flex w-full flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Winning answer{winningCards.length > 1 ? 's' : ''}
        </p>
        {winningCards.map((c, i) => (
          <div key={i} className="rounded-xl border-2 border-green-400 bg-white p-4 shadow-md">
            <p className="font-bold text-gray-800">{c.text}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onNextRound}
        className="rounded-xl bg-black px-8 py-3 text-lg font-bold text-white transition-colors hover:bg-gray-800"
      >
        Next Round →
      </button>
    </div>
  )
}

// ─── Finished ─────────────────────────────────────────────────────────────────

function FinishedPhase({
  gameState,
  playerId,
  onPlayAgain,
  onLeave,
}: {
  gameState: GameState
  playerId: string
  onPlayAgain: () => void
  onLeave: () => void
}) {
  const winner = gameState.players.find((p) => p.id === gameState.winnerId)
  const isMe = gameState.winnerId === playerId
  const me = gameState.players.find((p) => p.id === playerId)
  const sorted = [...gameState.players].sort((a, b) => b.score - a.score)

  return (
    <div className="animate-cah-fade-in flex w-full max-w-sm flex-col items-center gap-6 text-center">
      <p className="text-5xl">{isMe ? '👑' : '🎊'}</p>
      <p className="text-3xl font-black">{isMe ? 'You win!' : `${winner?.name} wins!`}</p>
      <p className="text-gray-500">With {winner?.score} awesome points</p>

      <div className="w-full rounded-2xl border-2 border-gray-200 p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
          Final Scores
        </h3>
        <ol className="space-y-2 text-left">
          {sorted.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3">
              <span className="w-6 text-lg font-black text-gray-400">{i + 1}</span>
              <span className={cn('flex-1 font-semibold', p.id === playerId && 'text-black')}>
                {p.name} {p.id === playerId && '(you)'}
              </span>
              <span className="text-lg font-black">{p.score}</span>
            </li>
          ))}
        </ol>
      </div>

      {me?.isHost && (
        <button
          onClick={onPlayAgain}
          className="w-full rounded-xl bg-black py-3 text-lg font-bold text-white transition-colors hover:bg-gray-800"
        >
          Play Again
        </button>
      )}
      <button
        onClick={onLeave}
        className="text-sm text-gray-400 transition-colors hover:text-gray-700"
      >
        Leave room
      </button>
    </div>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────

export function CardsAgainstHumanityGame() {
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
  } = useCardsAgainstHumanityRoom()

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
        <p className="text-4xl">🃏</p>
        <p className="text-xl font-bold">Cards Against Humanity</p>
        <p className="text-gray-500">
          This game requires Supabase for real-time multiplayer. Configure{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
          and{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{' '}
          in your environment to play.
        </p>
      </div>
    )
  }

  return (
    <>
      <CahStyles />
      <div className="flex min-h-[60vh] flex-col items-center gap-6 px-4 py-6">
        {/* Not connected yet */}
        {status !== 'connected' && (
          <div className="flex flex-col items-center gap-6">
            <div className="text-center">
              <p className="mb-1 text-4xl">🃏</p>
              <h1 className="text-3xl font-black">Cards Against Humanity</h1>
            </div>
            <LobbyScreen
              onCreateRoom={createRoom}
              onJoinRoom={joinRoom}
              onRestoreSession={restoreSession}
              savedSession={savedSession}
              status={status}
              error={error}
            />
          </div>
        )}

        {/* Connected */}
        {status === 'connected' && gameState && playerId && roomCode && (
          <>
            {/* Header with scores */}
            {gameState.phase !== 'lobby' && (
              <div className="w-full max-w-2xl space-y-3">
                <Scoreboard gameState={gameState} playerId={playerId} />
                <p className="text-center text-xs text-gray-400">
                  Room <span className="font-mono font-bold tracking-widest">{roomCode}</span>
                  {' · '}First to {gameState.pointsToWin} wins
                </p>
              </div>
            )}

            {gameState.phase === 'lobby' && (
              <WaitingRoom
                gameState={gameState}
                playerId={playerId}
                roomCode={roomCode}
                onStart={(pts) => dispatch({ type: 'START_GAME', playerId, pointsToWin: pts })}
                onLeave={leaveRoom}
              />
            )}

            {gameState.phase === 'playing' && (
              <PlayingPhase
                gameState={gameState}
                playerId={playerId}
                onSubmit={(cards) => dispatch({ type: 'SUBMIT_CARDS', playerId, cards })}
              />
            )}

            {gameState.phase === 'judging' && (
              <JudgingPhase
                gameState={gameState}
                playerId={playerId}
                onJudge={(winnerId) => dispatch({ type: 'JUDGE_WINNER', playerId, winnerId })}
              />
            )}

            {gameState.phase === 'round_end' && (
              <RoundEndPhase
                gameState={gameState}
                playerId={playerId}
                onNextRound={() => dispatch({ type: 'NEXT_ROUND', playerId })}
              />
            )}

            {gameState.phase === 'finished' && (
              <FinishedPhase
                gameState={gameState}
                playerId={playerId}
                onPlayAgain={() => dispatch({ type: 'PLAY_AGAIN', playerId })}
                onLeave={leaveRoom}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
