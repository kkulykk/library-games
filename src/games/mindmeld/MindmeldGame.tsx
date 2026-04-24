'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { getSavedPlayerName, savePlayerName } from '@/lib/player-name'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useInviteCode, getInviteLink } from '@/hooks/useInviteCode'
import {
  ResumeSessionButton,
  type SavedSessionSummary,
} from '@/components/multiplayer/ResumeSessionButton'
import { useMindmeldRoom } from './useMindmeldRoom'
import {
  BULLSEYE_RADIUS,
  CLOSE_RADIUS,
  HIDDEN_TARGET,
  MAX_CLUE_LENGTH,
  MEDIUM_RADIUS,
  MIN_PLAYERS,
  distanceFromTarget,
  getLeaderboard,
  getPsychic,
  getSpectra,
  getWinners,
  isPsychic,
  redactForPlayer,
  type GameState,
  type Player,
} from './logic'

function MindmeldStyles() {
  return (
    <style>{`
      @keyframes mindmeld-float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-6px); }
      }
      @keyframes mindmeld-fade-up {
        from { opacity: 0; transform: translateY(18px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes mindmeld-glow {
        0%, 100% { box-shadow: 0 0 0 rgba(250, 204, 21, 0); }
        50% { box-shadow: 0 0 28px rgba(250, 204, 21, 0.18); }
      }
      .animate-mindmeld-float { animation: mindmeld-float 4s ease-in-out infinite; }
      .animate-mindmeld-fade-up { animation: mindmeld-fade-up 0.35s ease-out; }
      .animate-mindmeld-glow { animation: mindmeld-glow 2.8s ease-in-out infinite; }
    `}</style>
  )
}

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
  savedSession: SavedSessionSummary | null
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
      <div className="animate-mindmeld-fade-up flex max-w-3xl flex-col gap-8">
        <div className="overflow-hidden rounded-[2rem] border border-amber-500/20 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.2),_transparent_35%),linear-gradient(160deg,rgba(24,24,27,0.96),rgba(39,39,42,0.92))] p-8 text-white shadow-2xl">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold tracking-[0.28em] text-amber-200 uppercase">
                <span className="animate-mindmeld-float">●</span>
                Wavelength style
              </div>
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Mindmeld</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
                One player sees the secret position. They give a clue. Everyone else talks it out
                and locks a single shared guess on the dial.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
              {MIN_PLAYERS}-10 players
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              data-testid="create-room-button"
              onClick={() => setMode('create')}
              className="rounded-[1.5rem] border border-white/10 bg-white/8 px-6 py-6 text-left transition hover:-translate-y-0.5 hover:bg-white/12"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300/18 text-2xl">
                +
              </div>
              <div className="text-lg font-semibold">Create room</div>
              <div className="mt-1 text-sm text-white/65">Host the psychic signal.</div>
            </button>
            <button
              data-testid="join-room-button"
              onClick={() => setMode('join')}
              className="rounded-[1.5rem] border border-white/10 bg-white/8 px-6 py-6 text-left transition hover:-translate-y-0.5 hover:bg-white/12"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-300/18 text-2xl">
                →
              </div>
              <div className="text-lg font-semibold">Join room</div>
              <div className="mt-1 text-sm text-white/65">Tune into an existing table.</div>
            </button>
          </div>
        </div>

        {savedSession && onRestore && (
          <ResumeSessionButton
            session={savedSession}
            onClick={onRestore}
            className="mx-auto w-full max-w-md rounded-2xl px-6 py-4"
          />
        )}
      </div>
    )
  }

  const isCreate = mode === 'create'
  return (
    <div className="animate-mindmeld-fade-up bg-background/95 flex w-full max-w-sm flex-col gap-4 rounded-[1.75rem] border p-6 shadow-xl">
      <button
        onClick={() => setMode('choose')}
        className="text-muted-foreground hover:text-foreground self-start text-sm"
      >
        ← Back
      </button>
      <div>
        <h2 className="text-xl font-black">{isCreate ? 'Create Room' : 'Join Room'}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {isCreate ? 'Start a new psychic dial.' : 'Enter the room code to jump in.'}
        </p>
      </div>
      {error && (
        <p
          data-testid="room-error"
          className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">Your name</span>
        <input
          data-testid="player-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          maxLength={16}
          className="bg-background focus:ring-primary/40 rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
        />
      </label>
      {!isCreate && (
        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">Room code</span>
          <input
            data-testid="room-code-input"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. AB12"
            maxLength={4}
            className="bg-background focus:ring-primary/40 rounded-xl border px-3 py-2.5 text-sm tracking-[0.35em] uppercase outline-none focus:ring-2"
          />
        </label>
      )}
      <button
        data-testid={isCreate ? 'create-room-button' : 'join-room-button'}
        disabled={loading || !name.trim() || (!isCreate && joinCode.length < 4)}
        onClick={() => {
          savePlayerName(name.trim())
          if (isCreate) onCreate(name.trim())
          else onJoin(joinCode, name.trim())
        }}
        className="bg-foreground text-background rounded-xl px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
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
  const ready = gameState.players.length >= MIN_PLAYERS
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  function handleCopy(value: string, type: 'code' | 'link') {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 1800)
    })
  }

  return (
    <div className="animate-mindmeld-fade-up flex w-full max-w-4xl flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-[2rem] border border-amber-500/20 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.2),_transparent_40%),linear-gradient(165deg,rgba(9,9,11,0.97),rgba(39,39,42,0.95))] p-6 text-white shadow-2xl">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold tracking-[0.28em] text-amber-200/90 uppercase">
                Lobby frequency
              </div>
              <h2 data-testid="room-code" className="mt-2 text-3xl font-black tracking-tight">
                Room {roomCode}
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-white/68">
                Psychic gives the clue. The rest of the table discusses and submits one shared dial
                position, then the target is revealed.
              </p>
            </div>
            <div className="animate-mindmeld-float text-4xl">🧠</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleCopy(roomCode, 'code')}
              className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/12"
            >
              {copied === 'code' ? 'Copied code' : 'Copy code'}
            </button>
            <button
              data-testid="invite-link"
              onClick={() => handleCopy(getInviteLink('mindmeld', roomCode), 'link')}
              className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/12"
            >
              {copied === 'link' ? 'Copied invite link' : 'Copy invite link'}
            </button>
          </div>
        </div>

        <div className="bg-secondary/35 rounded-[2rem] border p-6">
          <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
            How it plays
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6">
            <p>
              1. The <span className="font-semibold">Psychic</span> sees the hidden sweet spot.
            </p>
            <p>2. They send one clue for the whole scale.</p>
            <p>3. Everyone else debates and locks one final guess.</p>
            <p>4. The closer the guess, the more points the whole table earns.</p>
          </div>
        </div>
      </div>

      <div className="bg-background/95 rounded-[1.75rem] border p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Players ({gameState.players.length})</p>
          {!ready && (
            <span className="text-muted-foreground text-xs">
              Need {MIN_PLAYERS - gameState.players.length} more to start
            </span>
          )}
        </div>
        <div data-testid="player-roster" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {gameState.players.map((player) => (
            <div
              key={player.id}
              className="bg-secondary/45 flex items-center justify-between rounded-2xl border px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold">{player.name}</div>
                <div className="text-muted-foreground text-xs">
                  {player.isHost ? 'Host' : 'Player'}
                </div>
              </div>
              {player.id === playerId && (
                <span className="bg-primary/10 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase">
                  You
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        {isHost ? (
          <button
            data-testid="start-game-button"
            disabled={!ready}
            onClick={onStart}
            className="bg-foreground text-background flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
          >
            Start Game
          </button>
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-xl border px-4 py-3 text-sm">
            Waiting for host to start…
          </div>
        )}
        <button
          data-testid="leave-room-button"
          onClick={onLeave}
          className="hover:bg-secondary rounded-xl border px-4 py-3 text-sm font-semibold transition"
        >
          Leave
        </button>
      </div>
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function percentageToAngle(value: number) {
  // Map 0..100 from left-to-right across the TOP arc of the dial.
  // 0 -> 270° (left), 50 -> 360° (top), 100 -> 450° (right)
  return 270 + value * 1.8
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
}

interface PsychicDialProps {
  leftLabel: string
  rightLabel: string
  previewGuess: number | null
  finalGuess: number | null
  targetVisible: boolean
  target: number
}

function PsychicDial({
  leftLabel,
  rightLabel,
  previewGuess,
  finalGuess,
  targetVisible,
  target,
}: PsychicDialProps) {
  const centerX = 160
  const centerY = 186
  const radius = 126

  const activeGuess = finalGuess ?? previewGuess
  const targetAngle = percentageToAngle(clamp(target, 0, 100))
  const guessAngle = activeGuess === null ? null : percentageToAngle(activeGuess)

  function arcForWindow(radiusOffset: number, spread: number) {
    const start = percentageToAngle(clamp(target - spread, 0, 100))
    const end = percentageToAngle(clamp(target + spread, 0, 100))
    return describeArc(centerX, centerY, radius + radiusOffset, start, end)
  }

  function needle(angle: number, color: string, length: number, width: number) {
    const tip = polarToCartesian(centerX, centerY, length, angle)
    return (
      <g>
        <line
          x1={centerX}
          y1={centerY}
          x2={tip.x}
          y2={tip.y}
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
        />
        <circle cx={centerX} cy={centerY} r="8" fill={color} />
      </g>
    )
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border bg-[linear-gradient(180deg,rgba(24,24,27,1),rgba(10,10,12,0.98))] p-6 text-white shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[11px] font-semibold tracking-[0.28em] text-white/55 uppercase">
          Psychic dial
        </div>
        <div className="rounded-full border border-white/12 bg-white/7 px-3 py-1 text-xs text-white/70">
          {targetVisible ? 'Target visible' : 'Target hidden'}
        </div>
      </div>

      <svg viewBox="0 0 320 220" className="w-full">
        <defs>
          <linearGradient id="mindmeld-track" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
        </defs>

        <path
          d={describeArc(centerX, centerY, radius, 270, 450)}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="28"
          strokeLinecap="round"
        />
        <path
          d={describeArc(centerX, centerY, radius, 270, 450)}
          fill="none"
          stroke="url(#mindmeld-track)"
          strokeOpacity="0.28"
          strokeWidth="24"
          strokeLinecap="round"
        />

        {targetVisible && (
          <>
            <path
              d={arcForWindow(0, MEDIUM_RADIUS)}
              fill="none"
              stroke="rgba(250,204,21,0.62)"
              strokeWidth="24"
              strokeLinecap="round"
            />
            <path
              d={arcForWindow(0, CLOSE_RADIUS)}
              fill="none"
              stroke="rgba(251,146,60,0.82)"
              strokeWidth="24"
              strokeLinecap="round"
            />
            <path
              d={arcForWindow(0, BULLSEYE_RADIUS)}
              fill="none"
              stroke="rgba(74,222,128,0.95)"
              strokeWidth="24"
              strokeLinecap="round"
            />
            {needle(targetAngle, '#fef3c7', radius - 8, 4)}
          </>
        )}

        {guessAngle !== null &&
          needle(
            guessAngle,
            finalGuess !== null ? '#ffffff' : 'rgba(255,255,255,0.78)',
            radius - 2,
            6
          )}

        <circle cx={centerX} cy={centerY} r="22" fill="#111827" stroke="rgba(255,255,255,0.14)" />
      </svg>

      <div className="mt-3 flex items-start justify-between gap-4 text-sm font-semibold">
        <span className="max-w-[42%] text-sky-200">← {leftLabel}</span>
        <span className="max-w-[42%] text-right text-rose-200">{rightLabel} →</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2">
          <div className="text-white/50">Left</div>
          <div className="mt-1 font-semibold">0</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2">
          <div className="text-white/50">Center</div>
          <div className="mt-1 font-semibold">50</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2">
          <div className="text-white/50">Right</div>
          <div className="mt-1 font-semibold">100</div>
        </div>
      </div>
    </div>
  )
}

interface PlayingScreenProps {
  gameState: GameState
  playerId: string
  onSubmitClue: (clue: string) => void
  onSubmitGuess: (guess: number) => void
  onNextRound: () => void
  onLeave: () => void
}

function PlayingScreen({
  gameState,
  playerId,
  onSubmitClue,
  onSubmitGuess,
  onNextRound,
  onLeave,
}: PlayingScreenProps) {
  const round = gameState.currentRound!
  const psychic = getPsychic(gameState)
  const youArePsychic = isPsychic(gameState, playerId)
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const [clueInput, setClueInput] = useState('')
  const [guess, setGuess] = useState(50)

  useEffect(() => {
    setClueInput('')
  }, [round.number, round.phase, round.psychicId])

  useEffect(() => {
    setGuess(round.teamGuess ?? 50)
  }, [round.number, round.phase, round.teamGuess])

  const targetVisible = round.phase === 'reveal' || youArePsychic
  const spectrumHints = getSpectra().find(
    (s) => s.left === round.spectrum.left && s.right === round.spectrum.right
  )?.hints

  const roundPoints = round.phase === 'reveal' ? (round.roundScores[playerId] ?? 0) : null
  const lockedBy = round.guessLockedBy
    ? (gameState.players.find((player) => player.id === round.guessLockedBy)?.name ?? 'A player')
    : null

  return (
    <div className="animate-mindmeld-fade-up flex w-full max-w-6xl flex-col gap-5">
      <div className="bg-background/95 flex flex-col gap-3 rounded-[1.75rem] border p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
            Round {round.number} of {gameState.totalRounds}
          </div>
          <h2 className="mt-1 text-2xl font-black tracking-tight">
            {psychic?.name ?? 'Psychic'}
            {youArePsychic ? ' · you are up' : ' is the Psychic'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {getLeaderboard(gameState).map((player) => (
            <span
              key={player.id}
              className={cn(
                'bg-secondary/45 rounded-full border px-3 py-1.5 text-xs font-semibold',
                player.id === playerId && 'border-primary/40'
              )}
            >
              {player.name} · {player.score}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <PsychicDial
          leftLabel={round.spectrum.left}
          rightLabel={round.spectrum.right}
          previewGuess={round.phase === 'guessing' && !youArePsychic ? guess : null}
          finalGuess={round.phase === 'reveal' ? round.teamGuess : null}
          targetVisible={targetVisible}
          target={targetVisible && round.target !== HIDDEN_TARGET ? round.target : 50}
        />

        <div className="flex flex-col gap-4">
          {round.phase === 'clue' && youArePsychic && (
            <div className="animate-mindmeld-glow bg-secondary/35 rounded-[1.75rem] border p-5 shadow-sm">
              <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
                Private target
              </div>
              <div className="bg-background mt-3 rounded-2xl border px-4 py-3">
                <div className="text-muted-foreground text-xs">Secret position</div>
                <div className="mt-1 text-4xl font-black text-amber-500 tabular-nums">
                  {round.target}
                </div>
              </div>
              <p className="mt-4 text-sm leading-6">
                Give one clue that makes your table place the shared dial in the right zone.
              </p>
              {spectrumHints && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {spectrumHints.slice(0, 4).map((hint) => (
                    <span
                      key={hint}
                      className="bg-background text-muted-foreground rounded-full border px-3 py-1 text-xs"
                    >
                      {hint}
                    </span>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (clueInput.trim()) onSubmitClue(clueInput.trim())
                }}
                className="mt-5 flex flex-col gap-3"
              >
                <input
                  value={clueInput}
                  onChange={(e) => setClueInput(e.target.value)}
                  placeholder="Transmit your clue…"
                  maxLength={MAX_CLUE_LENGTH}
                  autoFocus
                  className="bg-background focus:ring-primary/40 rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2"
                />
                <button
                  type="submit"
                  disabled={!clueInput.trim()}
                  className="bg-foreground text-background rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
                >
                  Send clue
                </button>
              </form>
            </div>
          )}

          {round.phase === 'clue' && !youArePsychic && (
            <div className="bg-secondary/35 rounded-[1.75rem] border p-6 text-center shadow-sm">
              <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
                Stand by
              </div>
              <div className="mt-4 text-2xl font-black">Waiting for the clue…</div>
              <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-6">
                {psychic?.name ?? 'The Psychic'} can see the target. As soon as the clue arrives,
                talk it through and agree on one final guess.
              </p>
            </div>
          )}

          {round.phase !== 'clue' && round.clue && (
            <div className="rounded-[1.75rem] border bg-[linear-gradient(145deg,rgba(250,204,21,0.12),rgba(14,165,233,0.06))] p-5 shadow-sm">
              <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
                Current clue
              </div>
              <div className="mt-3 text-4xl font-black tracking-tight">{round.clue}</div>
            </div>
          )}

          {round.phase === 'guessing' && !youArePsychic && (
            <div className="bg-background/95 rounded-[1.75rem] border p-5 shadow-sm">
              <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
                Team guess
              </div>
              <p className="text-muted-foreground mt-3 text-sm leading-6">
                Match original Wavelength style: talk it out first, then one person locks the final
                dial.
              </p>
              <div className="bg-secondary/45 mt-5 rounded-2xl border p-4">
                <div className="text-muted-foreground flex items-center justify-between text-xs font-semibold uppercase">
                  <span>{round.spectrum.left}</span>
                  <span className="text-foreground text-base tabular-nums">{guess}</span>
                  <span>{round.spectrum.right}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={guess}
                  onChange={(e) => setGuess(Number(e.target.value))}
                  aria-label="Team guess"
                  className="mt-4 w-full accent-amber-500"
                />
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setGuess((current) => clamp(current - 5, 0, 100))}
                    className="hover:bg-secondary flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition"
                  >
                    Nudge left
                  </button>
                  <button
                    onClick={() => setGuess((current) => clamp(current + 5, 0, 100))}
                    className="hover:bg-secondary flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition"
                  >
                    Nudge right
                  </button>
                </div>
              </div>
              <button
                onClick={() => onSubmitGuess(guess)}
                className="bg-foreground text-background mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
              >
                Lock team guess
              </button>
            </div>
          )}

          {round.phase === 'guessing' && youArePsychic && (
            <div className="bg-secondary/35 rounded-[1.75rem] border p-6 text-center shadow-sm">
              <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
                Reading the room
              </div>
              <div className="mt-4 text-2xl font-black">Your table is lining up the dial</div>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                Stay mysterious. They only get one team guess before the reveal.
              </p>
            </div>
          )}

          {round.phase === 'reveal' && (
            <div className="bg-background/95 rounded-[1.75rem] border p-5 shadow-sm">
              <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
                Reveal
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="bg-secondary/45 rounded-2xl border px-4 py-3">
                  <div className="text-muted-foreground text-xs">Target</div>
                  <div className="mt-1 text-2xl font-black tabular-nums">{round.target}</div>
                </div>
                <div className="bg-secondary/45 rounded-2xl border px-4 py-3">
                  <div className="text-muted-foreground text-xs">Team guess</div>
                  <div className="mt-1 text-2xl font-black tabular-nums">{round.teamGuess}</div>
                </div>
                <div className="bg-secondary/45 rounded-2xl border px-4 py-3">
                  <div className="text-muted-foreground text-xs">Distance</div>
                  <div className="mt-1 text-2xl font-black tabular-nums">
                    {round.teamGuess === null
                      ? '—'
                      : distanceFromTarget(round.teamGuess, round.target)}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border bg-[linear-gradient(145deg,rgba(250,204,21,0.12),rgba(74,222,128,0.08))] px-4 py-4">
                <div className="text-muted-foreground text-sm">
                  {lockedBy ? `${lockedBy} locked the dial.` : 'The team locked the dial.'}
                </div>
                <div className="mt-1 text-3xl font-black">+{roundPoints ?? 0} for everyone</div>
              </div>

              <div className="mt-4 space-y-2">
                {gameState.players.map((player) => (
                  <div
                    key={player.id}
                    className="bg-secondary/35 flex items-center justify-between rounded-2xl border px-4 py-3"
                  >
                    <span className="font-semibold">
                      {player.name}
                      {player.id === round.psychicId && ' · Psychic'}
                    </span>
                    <span className="text-sm font-semibold">
                      +{round.roundScores[player.id] ?? 0}
                    </span>
                  </div>
                ))}
              </div>

              {isHost ? (
                <button
                  onClick={onNextRound}
                  className="bg-foreground text-background mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
                >
                  {round.number >= gameState.totalRounds ? 'See results' : 'Next round'}
                </button>
              ) : (
                <div className="text-muted-foreground mt-4 text-center text-sm">
                  Waiting for the host to continue…
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onLeave}
          className="hover:bg-secondary rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
        >
          Leave
        </button>
      </div>
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
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const leaderboard = getLeaderboard(gameState)
  const winners = getWinners(gameState)
  const winnerNames = winners.map((winner) => winner.name).join(' & ')
  const youWon = winners.some((winner: Player) => winner.id === playerId)

  return (
    <div className="animate-mindmeld-fade-up flex w-full max-w-3xl flex-col gap-5">
      <div className="overflow-hidden rounded-[2rem] border border-amber-500/20 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.2),_transparent_35%),linear-gradient(160deg,rgba(24,24,27,0.96),rgba(39,39,42,0.92))] p-8 text-white shadow-2xl">
        <div className="text-5xl">{youWon ? '🏆' : '🧠'}</div>
        <h2 className="mt-4 text-4xl font-black tracking-tight">{winnerNames} win!</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
          {youWon
            ? 'The dial was on your wavelength.'
            : 'Close calls, strange clues, and at least one truly unhinged interpretation.'}
        </p>
      </div>

      <div className="bg-background/95 rounded-[1.75rem] border p-5 shadow-sm">
        <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
          Final leaderboard
        </div>
        <div className="mt-4 space-y-2">
          {leaderboard.map((player, index) => (
            <div
              key={player.id}
              className={cn(
                'flex items-center justify-between rounded-2xl border px-4 py-3',
                index === 0 ? 'bg-amber-500/10' : 'bg-secondary/35'
              )}
            >
              <span className="font-semibold">
                {index + 1}. {player.name}
                {player.id === playerId && ' · you'}
              </span>
              <span className="text-lg font-black tabular-nums">{player.score}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        {isHost ? (
          <button
            onClick={onPlayAgain}
            className="bg-foreground text-background flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
          >
            Play again
          </button>
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-xl border px-4 py-3 text-sm">
            Waiting for host to restart…
          </div>
        )}
        <button
          data-testid="leave-room-button"
          onClick={onLeave}
          className="hover:bg-secondary rounded-xl border px-4 py-3 text-sm font-semibold transition"
        >
          Leave
        </button>
      </div>
    </div>
  )
}

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

  const redactedState = useMemo(
    () => (gameState && playerId ? redactForPlayer(gameState, playerId) : gameState),
    [gameState, playerId]
  )

  if (!isSupabaseConfigured) return <SetupRequired />

  const isLoading = status === 'creating' || status === 'joining' || status === 'restoring'

  if (!redactedState || !playerId || !roomCode) {
    return (
      <>
        <MindmeldStyles />
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

  if (redactedState.phase === 'lobby') {
    return (
      <>
        <MindmeldStyles />
        <LobbyScreen
          gameState={redactedState}
          playerId={playerId}
          roomCode={roomCode}
          onStart={() => dispatch({ type: 'START_GAME', playerId })}
          onLeave={leaveRoom}
        />
      </>
    )
  }

  if (redactedState.phase === 'finished') {
    return (
      <>
        <MindmeldStyles />
        <FinishedScreen
          gameState={redactedState}
          playerId={playerId}
          onPlayAgain={() => dispatch({ type: 'PLAY_AGAIN', playerId })}
          onLeave={leaveRoom}
        />
      </>
    )
  }

  return (
    <>
      <MindmeldStyles />
      <PlayingScreen
        gameState={redactedState}
        playerId={playerId}
        onSubmitClue={(clue) => dispatch({ type: 'SUBMIT_CLUE', playerId, clue })}
        onSubmitGuess={(guess) => dispatch({ type: 'SUBMIT_GUESS', playerId, guess })}
        onNextRound={() => dispatch({ type: 'NEXT_ROUND', playerId })}
        onLeave={leaveRoom}
      />
    </>
  )
}
