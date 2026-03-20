'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { getSavedPlayerName, savePlayerName } from '@/lib/player-name'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useInviteCode, getInviteLink } from '@/hooks/useInviteCode'
import { useCodenamesRoom } from './useCodenamesRoom'
import {
  canStartGame,
  getSpymaster,
  getOperatives,
  isSpymaster as checkIsSpymaster,
  getPlayerTeam,
  redactForPlayer,
  type GameState,
  type Team,
  type PlayerRole,
} from './logic'

// ─── Animations ─────────────────────────────────────────────────────────────

function CodenamesStyles() {
  return (
    <style>{`
      @keyframes cn-fade-in {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes cn-slide-up {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes cn-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      .animate-cn-fade-in { animation: cn-fade-in 0.3s ease-out; }
      .animate-cn-slide-up { animation: cn-slide-up 0.3s ease-out; }
      .animate-cn-pulse { animation: cn-pulse 1.5s ease-in-out infinite; }
    `}</style>
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
      <div className="animate-cn-fade-in flex flex-col items-center gap-6">
        <div className="text-center">
          <div className="mb-3 text-5xl">🕵️</div>
          <h2 className="text-xl font-black tracking-tight">Codenames</h2>
          <p className="text-sm text-muted-foreground">4-10 players</p>
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
    <div className="animate-cn-slide-up flex w-72 flex-col gap-4">
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

// ─── Lobby ──────────────────────────────────────────────────────────────────

interface LobbyScreenProps {
  gameState: GameState
  playerId: string
  roomCode: string
  onJoinTeam: (team: Team, role: PlayerRole) => void
  onStart: () => void
  onLeave: () => void
}

function LobbyScreen({
  gameState,
  playerId,
  roomCode,
  onJoinTeam,
  onStart,
  onLeave,
}: LobbyScreenProps) {
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const ready = canStartGame(gameState)

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
    navigator.clipboard.writeText(getInviteLink('codenames', roomCode)).then(
      () => {
        setCopied('link')
        setTimeout(() => setCopied(null), 2000)
      },
      () => {}
    )
  }

  function TeamPanel({ team }: { team: Team }) {
    const spymaster = getSpymaster(gameState.players, team)
    const operatives = getOperatives(gameState.players, team)
    const myTeam = getPlayerTeam(gameState.players, playerId)
    const myRole = gameState.players.find((p) => p.id === playerId)?.role
    const isOnThisTeam = myTeam === team

    const teamColor = team === 'red' ? 'border-red-500/50' : 'border-blue-500/50'
    const teamBg = team === 'red' ? 'bg-red-500/10' : 'bg-blue-500/10'
    const teamText = team === 'red' ? 'text-red-500' : 'text-blue-500'
    const btnBg =
      team === 'red'
        ? 'bg-red-500 hover:bg-red-400 text-white'
        : 'bg-blue-500 hover:bg-blue-400 text-white'

    return (
      <div className={cn('flex-1 rounded-xl border-2 p-3', teamColor, teamBg)}>
        <h3 className={cn('mb-2 text-center text-sm font-bold uppercase', teamText)}>
          {team} team
        </h3>

        {/* Spymaster slot */}
        <div className="mb-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Spymaster</p>
          {spymaster ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1.5 text-xs">
              <span className={cn('h-2 w-2 rounded-full', teamText, 'bg-current')} />
              <span className="font-medium">{spymaster.name}</span>
              {spymaster.id === playerId && (
                <span className="ml-auto text-muted-foreground">you</span>
              )}
            </div>
          ) : (
            <button
              onClick={() => onJoinTeam(team, 'spymaster')}
              disabled={isOnThisTeam && myRole === 'spymaster'}
              className={cn(
                'w-full rounded-lg px-2 py-1.5 text-xs font-semibold transition-all active:scale-95',
                btnBg
              )}
            >
              Join as Spymaster
            </button>
          )}
        </div>

        {/* Operatives */}
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Operatives</p>
          <div className="flex flex-col gap-1">
            {operatives.map((op) => (
              <div
                key={op.id}
                className="flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1.5 text-xs"
              >
                <span className={cn('h-2 w-2 rounded-full', teamText, 'bg-current')} />
                <span className="font-medium">{op.name}</span>
                {op.id === playerId && <span className="ml-auto text-muted-foreground">you</span>}
              </div>
            ))}
            <button
              onClick={() => onJoinTeam(team, 'operative')}
              disabled={isOnThisTeam && myRole === 'operative'}
              className={cn(
                'w-full rounded-lg px-2 py-1.5 text-xs font-semibold transition-all active:scale-95',
                btnBg
              )}
            >
              Join as Operative
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-cn-fade-in flex w-full max-w-md flex-col gap-4">
      <div className="rounded-2xl bg-secondary p-4 text-center">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Room code &mdash; share with friends
        </p>
        <p className="mb-2 text-3xl font-black tracking-widest">{roomCode}</p>
        <div className="flex justify-center gap-2">
          <button
            onClick={copyCode}
            className="rounded-lg border px-3 py-1 text-xs font-medium transition-colors hover:bg-background"
          >
            {copied === 'code' ? 'Copied!' : 'Copy code'}
          </button>
          <button
            onClick={copyInviteLink}
            className="rounded-lg border px-3 py-1 text-xs font-medium transition-colors hover:bg-background"
          >
            {copied === 'link' ? 'Copied!' : 'Copy invite link'}
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Pick your team and role ({gameState.players.length} player
        {gameState.players.length !== 1 ? 's' : ''} in room)
      </p>

      <div className="flex gap-3">
        <TeamPanel team="red" />
        <TeamPanel team="blue" />
      </div>

      {!ready && (
        <p className="text-center text-xs text-muted-foreground">
          Each team needs a Spymaster and at least one Operative to start
        </p>
      )}

      <div className="flex gap-3">
        {isHost && (
          <button
            disabled={!ready}
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

const CARD_TYPE_COLORS = {
  red: 'bg-red-500 text-white border-red-600',
  blue: 'bg-blue-500 text-white border-blue-600',
  neutral:
    'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700',
  assassin: 'bg-gray-900 text-white border-gray-700 dark:bg-black dark:border-gray-600',
}

const CARD_TYPE_HINT = {
  red: 'ring-red-400/40',
  blue: 'ring-blue-400/40',
  neutral: 'ring-amber-300/40',
  assassin: 'ring-gray-600/40',
}

interface GameBoardProps {
  gameState: GameState
  playerId: string
  onGuess: (cardIndex: number) => void
  onEndGuessing: () => void
  onGiveClue: (word: string, count: number) => void
  onLeave: () => void
}

function GameBoard({
  gameState,
  playerId,
  onGuess,
  onEndGuessing,
  onGiveClue,
  onLeave,
}: GameBoardProps) {
  const [clueWord, setClueWord] = useState('')
  const [clueCount, setClueCount] = useState(1)

  const player = gameState.players.find((p) => p.id === playerId)
  const myTeam = player?.team
  const myRole = player?.role
  const isMyTeamTurn = myTeam === gameState.currentTeam
  const iAmSpymaster = myRole === 'spymaster'
  const iAmOperative = myRole === 'operative'
  const isCluePhase = gameState.turnPhase === 'giving_clue'
  const isGuessPhase = gameState.turnPhase === 'guessing'

  const canGiveClue = isCluePhase && isMyTeamTurn && iAmSpymaster
  const canGuess = isGuessPhase && isMyTeamTurn && iAmOperative
  const canEndGuessing = isGuessPhase && isMyTeamTurn && iAmOperative

  const teamBg =
    gameState.currentTeam === 'red'
      ? 'bg-red-100 text-red-800 ring-1 ring-red-300 dark:bg-red-500/20 dark:text-red-300 dark:ring-red-500/30'
      : 'bg-blue-100 text-blue-800 ring-1 ring-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500/30'

  const statusText = () => {
    if (isCluePhase) {
      if (canGiveClue) return 'Your turn — give a clue!'
      return `Waiting for ${gameState.currentTeam.toUpperCase()} Spymaster to give a clue...`
    }
    if (isGuessPhase && gameState.currentClue) {
      const { word, count, guessesUsed } = gameState.currentClue
      const maxGuesses = count === 0 ? '∞' : count + 1
      if (canGuess)
        return `Clue: "${word}" for ${count} — guess! (${guessesUsed}/${maxGuesses} used)`
      return `${gameState.currentTeam.toUpperCase()} team guessing: "${word}" for ${count} (${guessesUsed}/${maxGuesses})`
    }
    return ''
  }

  function handleGiveClue() {
    if (!clueWord.trim()) return
    onGiveClue(clueWord.trim(), clueCount)
    setClueWord('')
    setClueCount(1)
  }

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-3 px-2">
      {/* Score bar */}
      <div className="flex w-full items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="text-sm font-bold text-red-500">{gameState.redRemaining}</span>
          <span className="text-xs text-muted-foreground">left</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {myTeam && myRole && (
            <span>
              You:{' '}
              <span className={myTeam === 'red' ? 'text-red-500' : 'text-blue-500'}>{myTeam}</span>{' '}
              {myRole}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">left</span>
          <span className="text-sm font-bold text-blue-500">{gameState.blueRemaining}</span>
          <span className="h-3 w-3 rounded-full bg-blue-500" />
        </div>
      </div>

      {/* Status */}
      <div className={cn('w-full rounded-xl px-4 py-2 text-center text-sm font-semibold', teamBg)}>
        {isMyTeamTurn && (
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
        )}
        {statusText()}
      </div>

      {/* Board */}
      <div className="grid w-full grid-cols-5 gap-1.5 sm:gap-2">
        {gameState.board.map((card, i) => {
          const revealed = card.revealed

          return (
            <button
              key={i}
              disabled={!canGuess || revealed}
              onClick={() => canGuess && !revealed && onGuess(i)}
              className={cn(
                'relative flex min-h-[3rem] items-center justify-center rounded-lg border-2 p-1 text-center text-[10px] font-bold leading-tight transition-all sm:min-h-[3.5rem] sm:rounded-xl sm:p-2 sm:text-xs',
                revealed
                  ? cn(CARD_TYPE_COLORS[card.type], 'opacity-80')
                  : iAmSpymaster
                    ? cn('bg-secondary/80', 'ring-2', CARD_TYPE_HINT[card.type], 'border-secondary')
                    : cn(
                        'border-secondary bg-secondary/60',
                        canGuess &&
                          'cursor-pointer hover:bg-secondary hover:shadow-md active:scale-95'
                      )
              )}
            >
              <span className={cn(revealed && 'drop-shadow-sm')}>{card.word}</span>
            </button>
          )
        })}
      </div>

      {/* Clue input */}
      {canGiveClue && (
        <div className="animate-cn-slide-up flex w-full max-w-sm flex-col gap-2 rounded-xl bg-secondary p-3">
          <p className="text-center text-xs font-medium text-muted-foreground">Give a clue</p>
          <div className="flex gap-2">
            <input
              value={clueWord}
              onChange={(e) => setClueWord(e.target.value.replace(/\s/g, ''))}
              placeholder="One word..."
              maxLength={30}
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-primary/40"
              onKeyDown={(e) => e.key === 'Enter' && handleGiveClue()}
            />
            <select
              value={clueCount}
              onChange={(e) => setClueCount(Number(e.target.value))}
              className="w-16 rounded-lg border bg-background px-2 py-2 text-center text-sm outline-none"
            >
              <option value={0}>0</option>
              {Array.from({ length: 9 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <button
              onClick={handleGiveClue}
              disabled={!clueWord.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {canEndGuessing && (
          <button
            onClick={onEndGuessing}
            className="rounded-xl bg-secondary px-4 py-2 text-sm font-semibold shadow transition-all hover:bg-secondary/80 active:scale-95"
          >
            End Guessing
          </button>
        )}
        <button
          onClick={onLeave}
          className="rounded-xl border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary sm:text-sm"
        >
          Leave
        </button>
      </div>

      {/* Log */}
      {gameState.log.length > 0 && (
        <div className="w-full max-w-sm rounded-xl bg-secondary/50 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Game log</p>
          <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground">
            {[...gameState.log].reverse().map((entry, i) => (
              <p key={i} className={cn(i === 0 && 'font-medium text-foreground')}>
                {entry}
              </p>
            ))}
          </div>
        </div>
      )}
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
  const myTeam = getPlayerTeam(gameState.players, playerId)
  const isWinner = myTeam === gameState.winningTeam

  return (
    <div className="animate-cn-fade-in flex flex-col items-center gap-6">
      <div className="text-6xl">{isWinner ? '🏆' : '🎭'}</div>
      <div className="text-center">
        <h2 className="text-2xl font-black">{gameState.winningTeam?.toUpperCase()} team wins!</h2>
        <p className="text-muted-foreground">
          {isWinner ? 'Great teamwork!' : 'Better luck next time!'}
        </p>
      </div>

      {/* Reveal full board */}
      <div className="grid w-full max-w-lg grid-cols-5 gap-1">
        {gameState.board.map((card, i) => (
          <div
            key={i}
            className={cn(
              'flex min-h-[2.5rem] items-center justify-center rounded-lg border p-1 text-center text-[9px] font-bold leading-tight sm:text-[10px]',
              CARD_TYPE_COLORS[card.type],
              !card.revealed && 'opacity-50'
            )}
          >
            {card.word}
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

// ─── Main component ─────────────────────────────────────────────────────────

export function CodenamesGame() {
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
  } = useCodenamesRoom()

  const redactedState = useMemo(
    () => (gameState && playerId ? redactForPlayer(gameState, playerId) : gameState),
    [gameState, playerId]
  )

  if (!isSupabaseConfigured) return <SetupRequired />

  const isLoading = status === 'creating' || status === 'joining' || status === 'restoring'

  if (!gameState || !playerId || !roomCode) {
    return (
      <>
        <CodenamesStyles />
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
        <CodenamesStyles />
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
        <CodenamesStyles />
        <LobbyScreen
          gameState={gameState}
          playerId={playerId}
          roomCode={roomCode}
          onJoinTeam={(team, role) => dispatch({ type: 'JOIN_TEAM', playerId, team, role })}
          onStart={() => dispatch({ type: 'START_GAME', playerId })}
          onLeave={leaveRoom}
        />
      </>
    )
  }

  return (
    <>
      <CodenamesStyles />
      <GameBoard
        gameState={redactedState!}
        playerId={playerId}
        onGuess={(cardIndex) => dispatch({ type: 'GUESS_CARD', playerId, cardIndex })}
        onEndGuessing={() => dispatch({ type: 'END_GUESSING', playerId })}
        onGiveClue={(word, count) => dispatch({ type: 'GIVE_CLUE', playerId, word, count })}
        onLeave={leaveRoom}
      />
    </>
  )
}

// Re-export to avoid unused import warnings
export { checkIsSpymaster }
