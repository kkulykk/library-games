'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { copyText } from '@/lib/clipboard'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useInviteCode, getInviteLink } from '@/hooks/useInviteCode'
import {
  ResumeSessionButton,
  type SavedSessionSummary,
} from '@/components/multiplayer/ResumeSessionButton'
import { RoomEntry } from '@/components/multiplayer/RoomEntry'
import { DesyncIndicator } from '@/components/multiplayer/DesyncIndicator'
import { SupabaseSetupNotice } from '@/components/multiplayer/SupabaseSetupNotice'
import { useGlobetrotterRoom } from './useGlobetrotterRoom'
import { fetchRandomWorldDeck } from './randomWorld'
import { PanoViewer } from './PanoViewer'
import { WorldMap } from './WorldMap'
import {
  createSoloGame,
  currentSoloLocation,
  formatKm,
  getLeaderboard,
  getWinners,
  hasPlayerGuessed,
  MAX_ROUND_SCORE,
  MIN_PLAYERS,
  nextSoloRound,
  redactForPlayer,
  submitSoloGuess,
  TOTAL_ROUNDS,
  type GameState,
  type GeoLocation,
  type Guess,
  type Player,
  type SoloGame,
} from './logic'

const PIN_COLORS = [
  '#34d399',
  '#60a5fa',
  '#f472b6',
  '#fbbf24',
  '#a78bfa',
  '#f87171',
  '#2dd4bf',
  '#fb923c',
]

function playerColor(state: GameState, playerId: string): string {
  const index = state.players.findIndex((p) => p.id === playerId)
  return PIN_COLORS[(index + PIN_COLORS.length) % PIN_COLORS.length]
}

function GlobetrotterStyles() {
  return (
    <style>{`
      @keyframes globetrotter-fade-up {
        from { opacity: 0; transform: translateY(18px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes globetrotter-float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-6px); }
      }
      .animate-globetrotter-fade-up { animation: globetrotter-fade-up 0.35s ease-out; }
      .animate-globetrotter-float { animation: globetrotter-float 4s ease-in-out infinite; }
    `}</style>
  )
}

// ─── Clues panel (shared by solo and online) ─────────────────────────────────

function CluesCard({ clues, roundLabel }: { clues: string[]; roundLabel: string }) {
  return (
    <div
      data-testid="globetrotter-clues"
      className="rounded-[1.75rem] border bg-[linear-gradient(145deg,rgba(52,211,153,0.12),rgba(56,189,248,0.06))] p-5 shadow-sm"
    >
      <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
        {roundLabel} · Field notes
      </div>
      <ol className="mt-3 space-y-3">
        {clues.map((clue, index) => (
          <li key={clue} className="flex gap-3 text-sm leading-6">
            <span className="bg-background text-muted-foreground mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold">
              {index + 1}
            </span>
            <span>{clue}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function RandomDropCard() {
  return (
    <div
      data-testid="globetrotter-random-drop"
      className="rounded-[1.75rem] border bg-[linear-gradient(145deg,rgba(52,211,153,0.12),rgba(56,189,248,0.06))] p-5 shadow-sm"
    >
      <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
        Random world drop
      </div>
      <p className="mt-3 text-sm leading-6">
        No field notes out here — you could be anywhere on Earth. Scan the panorama for road signs,
        language, driving side, vegetation, and architecture, then trust your gut.
      </p>
    </div>
  )
}

// ─── Entry screen: solo card + online room entry ─────────────────────────────

interface EntryScreenProps {
  onSolo: () => void
  onSoloRandom: () => void
  soloLoading: boolean
  soloError: string | null
  onCreate: (name: string) => void
  onJoin: (code: string, name: string) => void
  onRestore?: () => void
  savedSession: SavedSessionSummary | null
  loading: boolean
  error: string | null
  initialCode?: string | null
}

function EntryScreen({
  onSolo,
  onSoloRandom,
  soloLoading,
  soloError,
  onCreate,
  onJoin,
  onRestore,
  savedSession,
  loading,
  error,
  initialCode,
}: EntryScreenProps) {
  return (
    <div className="animate-globetrotter-fade-up flex w-full max-w-2xl flex-col gap-5">
      <div className="overflow-hidden rounded-[2rem] border border-emerald-500/25 bg-[radial-gradient(circle_at_top_right,_rgba(52,211,153,0.22),_transparent_45%),linear-gradient(165deg,rgba(9,9,11,0.97),rgba(19,38,33,0.95))] p-6 text-left text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.28em] text-emerald-200/90 uppercase">
              Solo expedition
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Play instantly, no room</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/68">
              Five mystery locations. Look around the 360° view, read the field notes, and pin your
              guess on the map — the closer you land, the more of the 5,000 points you keep.
            </p>
          </div>
          <div className="animate-globetrotter-float text-4xl">🌍</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="globetrotter-solo-button"
            onClick={onSolo}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-xs font-semibold transition hover:bg-white/14"
          >
            🗺️ Landmark tour →
          </button>
          <button
            type="button"
            data-testid="globetrotter-solo-random-button"
            onClick={onSoloRandom}
            disabled={soloLoading}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold transition hover:bg-emerald-400/20 disabled:opacity-50"
          >
            {soloLoading ? 'Scouting the planet…' : '🌐 Random world →'}
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-white/50">
          Random world drops you at one of a million+ real 360° spots on Earth — no clues, just your
          eyes.
        </p>
        {soloError && (
          <p data-testid="globetrotter-solo-error" className="mt-2 text-xs text-rose-300">
            {soloError}
          </p>
        )}
      </div>

      <div className="text-muted-foreground flex items-center gap-3 text-[11px] font-semibold tracking-[0.24em] uppercase">
        <span className="h-px flex-1 bg-current opacity-20" />
        or travel with friends
        <span className="h-px flex-1 bg-current opacity-20" />
      </div>

      {isSupabaseConfigured ? (
        <RoomEntry
          loading={loading}
          error={error}
          initialCode={initialCode}
          onCreate={(name) => onCreate(name)}
          onJoin={(code, name) => onJoin(code, name)}
          copy={{
            chooseTitle: 'Ready to explore?',
            chooseSubtitle: 'Host a private expedition or join with a room code.',
            createTitle: 'Create Room',
            createHint: 'Host an expedition',
            joinTitle: 'Join Room',
            joinHint: 'Enter a 6-char code',
            createFormTitle: 'Create a room',
            createFormSubtitle: "You'll be the expedition leader.",
            joinFormTitle: 'Join a room',
            joinFormSubtitle: 'Ask the host for the room code.',
            namePlaceholder: 'Enter your name',
          }}
          resume={
            savedSession ? (
              <ResumeSessionButton session={savedSession} onClick={() => onRestore?.()} />
            ) : null
          }
        />
      ) : (
        <SupabaseSetupNotice />
      )}
    </div>
  )
}

// ─── Solo mode ───────────────────────────────────────────────────────────────

interface SoloScreenProps {
  game: SoloGame
  onGuess: (guess: Guess) => void
  onNext: () => void
  onRestart: () => void
  onExit: () => void
}

function SoloScreen({ game, onGuess, onNext, onRestart, onExit }: SoloScreenProps) {
  const [pending, setPending] = useState<Guess | null>(null)

  useEffect(() => {
    setPending(null)
  }, [game.roundNumber, game.phase])

  if (game.phase === 'finished') {
    return (
      <div className="animate-globetrotter-fade-up flex w-full max-w-3xl flex-col gap-5">
        <div
          data-testid="globetrotter-finished"
          className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.2),_transparent_35%),linear-gradient(160deg,rgba(24,24,27,0.96),rgba(39,39,42,0.92))] p-8 text-white shadow-2xl"
        >
          <div className="text-5xl">🧭</div>
          <h2 className="mt-4 text-4xl font-black tracking-tight">Expedition complete</h2>
          <p className="mt-3 text-sm leading-6 text-white/70">
            You scored{' '}
            <span data-testid="globetrotter-solo-total" className="font-black text-emerald-300">
              {game.totalScore.toLocaleString('en-US')}
            </span>{' '}
            of {(MAX_ROUND_SCORE * game.rounds.length).toLocaleString('en-US')} possible points.
          </p>
        </div>

        <div className="bg-background/95 rounded-[1.75rem] border p-5 shadow-sm">
          <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
            Round by round
          </div>
          <div className="mt-4 space-y-2">
            {game.rounds.map((location, index) => (
              <div
                key={location.name}
                className="bg-secondary/35 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
              >
                <span className="min-w-0 truncate font-semibold">
                  {location.emoji} {location.name}, {location.country}
                </span>
                <span className="text-muted-foreground shrink-0 text-sm">
                  {game.results[index] ? formatKm(game.results[index].distanceKm) : '—'}
                  <span className="text-foreground ml-3 font-bold">
                    +{game.results[index]?.points.toLocaleString('en-US') ?? 0}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            data-testid="globetrotter-play-again"
            onClick={onRestart}
            className="bg-foreground text-background flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
          >
            New expedition
          </button>
          <button
            data-testid="globetrotter-exit-solo"
            onClick={onExit}
            className="hover:bg-secondary rounded-xl border px-4 py-3 text-sm font-semibold transition"
          >
            Back to menu
          </button>
        </div>
      </div>
    )
  }

  const location = currentSoloLocation(game)
  const revealing = game.phase === 'reveal'
  const result = revealing ? game.results[game.roundNumber - 1] : null
  const pins = revealing
    ? [{ ...result!.guess, color: PIN_COLORS[0], label: 'You' }]
    : pending
      ? [{ ...pending, color: PIN_COLORS[0], label: 'You' }]
      : []

  return (
    <div className="animate-globetrotter-fade-up flex w-full max-w-6xl flex-col gap-5">
      <div className="bg-background/95 flex flex-col gap-3 rounded-[1.75rem] border p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
            Solo expedition
          </div>
          <h2 data-testid="globetrotter-status" className="mt-1 text-2xl font-black tracking-tight">
            Round {game.roundNumber} of {game.rounds.length}
          </h2>
        </div>
        <span className="bg-secondary/45 rounded-full border px-4 py-1.5 text-sm font-semibold tabular-nums">
          Score {game.totalScore.toLocaleString('en-US')}
        </span>
      </div>

      {location.pano && (
        <div className="overflow-hidden rounded-[2rem] border bg-[linear-gradient(180deg,rgba(24,24,27,1),rgba(10,10,12,0.98))] p-4 shadow-2xl">
          <PanoViewer pano={location.pano} className="aspect-[21/9] w-full" />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
        <div className="overflow-hidden rounded-[2rem] border bg-[linear-gradient(180deg,rgba(24,24,27,1),rgba(10,10,12,0.98))] p-4 shadow-2xl">
          <WorldMap
            pins={pins}
            target={revealing ? { lat: location.lat, lng: location.lng } : null}
            interactive={!revealing}
            onSelect={setPending}
            ariaLabel="World map — click to place your guess"
          />
          <div className="mt-3 flex items-center justify-between gap-3 px-1 text-xs text-white/55">
            <span>
              {revealing ? 'The gold marker is the answer.' : 'Click the map to drop your pin.'}
            </span>
            {!revealing && (
              <span className="tabular-nums">
                {pending ? `${pending.lat.toFixed(1)}°, ${pending.lng.toFixed(1)}°` : 'No pin yet'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {location.clues.length > 0 ? (
            <CluesCard clues={location.clues} roundLabel={`Round ${game.roundNumber}`} />
          ) : (
            <RandomDropCard />
          )}

          {!revealing && (
            <button
              data-testid="globetrotter-lock-guess"
              disabled={!pending}
              onClick={() => pending && onGuess(pending)}
              className="bg-foreground text-background w-full rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
            >
              {pending ? 'Lock in guess' : 'Place a pin first'}
            </button>
          )}

          {revealing && result && (
            <div
              data-testid="globetrotter-reveal"
              className="bg-background/95 rounded-[1.75rem] border p-5 shadow-sm"
            >
              <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
                Reveal
              </div>
              <div className="mt-3 text-2xl font-black tracking-tight">
                {location.emoji} {location.name}
              </div>
              <div className="text-muted-foreground text-sm">{location.country}</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-secondary/45 rounded-2xl border px-4 py-3">
                  <div className="text-muted-foreground text-xs">Distance</div>
                  <div className="mt-1 text-xl font-black tabular-nums">
                    {formatKm(result.distanceKm)}
                  </div>
                </div>
                <div className="bg-secondary/45 rounded-2xl border px-4 py-3">
                  <div className="text-muted-foreground text-xs">Points</div>
                  <div
                    data-testid="globetrotter-round-score"
                    className="mt-1 text-xl font-black text-emerald-500 tabular-nums"
                  >
                    +{result.points.toLocaleString('en-US')}
                  </div>
                </div>
              </div>
              <button
                data-testid="globetrotter-next-round"
                onClick={onNext}
                className="bg-foreground text-background mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
              >
                {game.roundNumber >= game.rounds.length ? 'See results' : 'Next round'}
              </button>
            </div>
          )}

          <button
            data-testid="globetrotter-exit-solo"
            onClick={onExit}
            className="hover:bg-secondary rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
          >
            Quit expedition
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Online: lobby ───────────────────────────────────────────────────────────

interface LobbyScreenProps {
  gameState: GameState
  playerId: string
  roomCode: string
  onStart: (deck?: GeoLocation[]) => void
  onLeave: () => void
}

function LobbyScreen({ gameState, playerId, roomCode, onStart, onLeave }: LobbyScreenProps) {
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const ready = gameState.players.length >= MIN_PLAYERS
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [mode, setMode] = useState<'landmarks' | 'random'>('landmarks')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  async function handleStart() {
    if (mode === 'landmarks') {
      onStart()
      return
    }
    setStarting(true)
    setStartError(null)
    try {
      onStart(await fetchRandomWorldDeck(TOTAL_ROUNDS))
    } catch {
      setStartError(
        'Could not fetch random panoramas — check your connection or start a landmark tour.'
      )
    } finally {
      setStarting(false)
    }
  }

  function handleCopy(value: string, type: 'code' | 'link') {
    copyText(value).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 1800)
    })
  }

  return (
    <div className="animate-globetrotter-fade-up flex w-full max-w-4xl flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.2),_transparent_40%),linear-gradient(165deg,rgba(9,9,11,0.97),rgba(39,39,42,0.95))] p-6 text-white shadow-2xl">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold tracking-[0.28em] text-emerald-200/90 uppercase">
                Expedition lobby
              </div>
              <h2 data-testid="room-code" className="mt-2 text-3xl font-black tracking-tight">
                Room {roomCode}
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-white/68">
                Everyone gets the same clues and the same map. Pin your guess in secret — closest to
                the mystery location banks the most points.
              </p>
            </div>
            <div className="animate-globetrotter-float text-4xl">🌍</div>
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
              data-invite-link={getInviteLink('globetrotter', roomCode)}
              onClick={() => handleCopy(getInviteLink('globetrotter', roomCode), 'link')}
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
            <p>1. Each round shows a 360° view and three clues for a mystery location.</p>
            <p>2. Everyone drops a pin on the world map and locks it in.</p>
            <p>3. When all pins are down, the answer is revealed.</p>
            <p>4. Closer pins score more — up to 5,000 points a round.</p>
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
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: playerColor(gameState, player.id) }}
                />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{player.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {player.isHost ? 'Host' : 'Explorer'}
                  </div>
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

      {isHost && (
        <div className="bg-background/95 rounded-[1.75rem] border p-4 shadow-sm">
          <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
            Expedition type
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="globetrotter-mode-landmarks"
              onClick={() => setMode('landmarks')}
              className={cn(
                'rounded-full border px-4 py-2 text-xs font-semibold transition',
                mode === 'landmarks' ? 'border-primary/50 bg-primary/10' : 'hover:bg-secondary'
              )}
            >
              🗺️ Landmark tour · clues + 360° views
            </button>
            <button
              type="button"
              data-testid="globetrotter-mode-random"
              onClick={() => setMode('random')}
              className={cn(
                'rounded-full border px-4 py-2 text-xs font-semibold transition',
                mode === 'random' ? 'border-primary/50 bg-primary/10' : 'hover:bg-secondary'
              )}
            >
              🌐 Random world · anywhere on Earth
            </button>
          </div>
          {startError && (
            <p data-testid="globetrotter-start-error" className="mt-2 text-xs text-rose-500">
              {startError}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {isHost ? (
          <button
            data-testid="start-game-button"
            disabled={!ready || starting}
            onClick={handleStart}
            className="bg-foreground text-background flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
          >
            {starting ? 'Scouting the planet…' : 'Start Expedition'}
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

// ─── Online: playing ─────────────────────────────────────────────────────────

interface PlayingScreenProps {
  gameState: GameState
  playerId: string
  onSubmitGuess: (guess: Guess) => void
  onNextRound: () => void
  onLeave: () => void
}

function PlayingScreen({
  gameState,
  playerId,
  onSubmitGuess,
  onNextRound,
  onLeave,
}: PlayingScreenProps) {
  const round = gameState.currentRound!
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const youGuessed = hasPlayerGuessed(gameState, playerId)
  const revealing = round.phase === 'reveal'
  const [pending, setPending] = useState<Guess | null>(null)

  useEffect(() => {
    setPending(null)
  }, [round.number, round.phase])

  const lockedCount = gameState.players.filter((p) => round.guesses[p.id] !== undefined).length

  const pins = revealing
    ? gameState.players
        .filter((p) => round.guesses[p.id])
        .map((p) => ({
          ...round.guesses[p.id],
          color: playerColor(gameState, p.id),
          label: p.id === playerId ? 'You' : p.name,
        }))
    : youGuessed
      ? [{ ...round.guesses[playerId], color: playerColor(gameState, playerId), label: 'You' }]
      : pending
        ? [{ ...pending, color: playerColor(gameState, playerId), label: 'You' }]
        : []

  return (
    <div className="animate-globetrotter-fade-up flex w-full max-w-6xl flex-col gap-5">
      <div className="bg-background/95 flex flex-col gap-3 rounded-[1.75rem] border p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
            Round {round.number} of {gameState.totalRounds}
          </div>
          <h2 data-testid="globetrotter-status" className="mt-1 text-2xl font-black tracking-tight">
            {revealing
              ? `It was ${round.location.name}!`
              : `Pins locked: ${lockedCount} of ${gameState.players.length}`}
          </h2>
        </div>
        <div data-testid="globetrotter-leaderboard" className="flex flex-wrap gap-2">
          {getLeaderboard(gameState).map((player) => (
            <span
              key={player.id}
              className={cn(
                'bg-secondary/45 rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums',
                player.id === playerId && 'border-primary/40'
              )}
            >
              {player.name} · {player.score.toLocaleString('en-US')}
            </span>
          ))}
        </div>
      </div>

      {round.location.pano && (
        <div className="overflow-hidden rounded-[2rem] border bg-[linear-gradient(180deg,rgba(24,24,27,1),rgba(10,10,12,0.98))] p-4 shadow-2xl">
          <PanoViewer pano={round.location.pano} className="aspect-[21/9] w-full" />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
        <div className="overflow-hidden rounded-[2rem] border bg-[linear-gradient(180deg,rgba(24,24,27,1),rgba(10,10,12,0.98))] p-4 shadow-2xl">
          <WorldMap
            pins={pins}
            target={revealing ? { lat: round.location.lat, lng: round.location.lng } : null}
            interactive={!revealing && !youGuessed}
            onSelect={setPending}
            ariaLabel="World map — click to place your guess"
          />
          <div className="mt-3 flex items-center justify-between gap-3 px-1 text-xs text-white/55">
            <span>
              {revealing
                ? 'The gold marker is the answer.'
                : youGuessed
                  ? 'Pin locked — waiting for the others.'
                  : 'Click the map to drop your pin. Nobody sees it until the reveal.'}
            </span>
            {!revealing && !youGuessed && (
              <span className="tabular-nums">
                {pending ? `${pending.lat.toFixed(1)}°, ${pending.lng.toFixed(1)}°` : 'No pin yet'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {round.location.clues.length > 0 ? (
            <CluesCard clues={round.location.clues} roundLabel={`Round ${round.number}`} />
          ) : (
            <RandomDropCard />
          )}

          {!revealing && !youGuessed && (
            <button
              data-testid="globetrotter-lock-guess"
              disabled={!pending}
              onClick={() => pending && onSubmitGuess(pending)}
              className="bg-foreground text-background w-full rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
            >
              {pending ? 'Lock in guess' : 'Place a pin first'}
            </button>
          )}

          {!revealing && youGuessed && (
            <div
              data-testid="globetrotter-waiting"
              className="bg-secondary/35 rounded-[1.75rem] border p-5 text-center shadow-sm"
            >
              <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
                Pin locked
              </div>
              <div className="mt-3 text-xl font-black">
                Waiting for {gameState.players.length - lockedCount} more…
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {gameState.players.map((player) => (
                  <span
                    key={player.id}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold',
                      round.guesses[player.id]
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'bg-secondary/45 opacity-60'
                    )}
                  >
                    {round.guesses[player.id] ? '📍' : '…'} {player.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {revealing && (
            <div
              data-testid="globetrotter-reveal"
              className="bg-background/95 rounded-[1.75rem] border p-5 shadow-sm"
            >
              <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
                Reveal
              </div>
              <div className="mt-3 text-2xl font-black tracking-tight">
                {round.location.emoji} {round.location.name}
              </div>
              <div className="text-muted-foreground text-sm">{round.location.country}</div>

              <div className="mt-4 space-y-2">
                {[...gameState.players]
                  .sort((a, b) => (round.roundScores[b.id] ?? -1) - (round.roundScores[a.id] ?? -1))
                  .map((player) => (
                    <div
                      key={player.id}
                      className="bg-secondary/35 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: playerColor(gameState, player.id) }}
                        />
                        <span className="truncate font-semibold">
                          {player.name}
                          {player.id === playerId && ' · you'}
                        </span>
                      </span>
                      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {round.distances[player.id] !== undefined
                          ? formatKm(round.distances[player.id])
                          : '—'}
                        <span
                          className="text-foreground ml-3 font-bold"
                          data-testid={
                            player.id === playerId ? 'globetrotter-round-score' : undefined
                          }
                        >
                          +{(round.roundScores[player.id] ?? 0).toLocaleString('en-US')}
                        </span>
                      </span>
                    </div>
                  ))}
              </div>

              {isHost ? (
                <button
                  data-testid="globetrotter-next-round"
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
          data-testid="leave-room-button"
          onClick={onLeave}
          className="hover:bg-secondary rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
        >
          Leave
        </button>
      </div>
    </div>
  )
}

// ─── Online: finished ────────────────────────────────────────────────────────

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
    <div className="animate-globetrotter-fade-up flex w-full max-w-3xl flex-col gap-5">
      <div
        data-testid="globetrotter-finished"
        className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.2),_transparent_35%),linear-gradient(160deg,rgba(24,24,27,0.96),rgba(39,39,42,0.92))] p-8 text-white shadow-2xl"
      >
        <div className="text-5xl">{youWon ? '🏆' : '🧭'}</div>
        <h2 className="mt-4 text-4xl font-black tracking-tight">
          {winnerNames ? `${winnerNames} win!` : 'Expedition over'}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
          {youWon
            ? 'Your inner compass is terrifyingly good.'
            : 'Some pins landed on the wrong continent. It happens to the best explorers.'}
        </p>
      </div>

      <div
        data-testid="globetrotter-final-leaderboard"
        className="bg-background/95 rounded-[1.75rem] border p-5 shadow-sm"
      >
        <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
          Final leaderboard
        </div>
        <div className="mt-4 space-y-2">
          {leaderboard.map((player, index) => (
            <div
              key={player.id}
              className={cn(
                'flex items-center justify-between rounded-2xl border px-4 py-3',
                index === 0 ? 'bg-emerald-500/10' : 'bg-secondary/35'
              )}
            >
              <span className="font-semibold">
                {index + 1}. {player.name}
                {player.id === playerId && ' · you'}
              </span>
              <span className="text-lg font-black tabular-nums">
                {player.score.toLocaleString('en-US')}
              </span>
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

// ─── Root component ──────────────────────────────────────────────────────────

export function GlobetrotterGame() {
  const inviteCode = useInviteCode()
  const [soloGame, setSoloGame] = useState<SoloGame | null>(null)
  const [soloMode, setSoloMode] = useState<'landmarks' | 'random'>('landmarks')
  const [soloLoading, setSoloLoading] = useState(false)
  const [soloError, setSoloError] = useState<string | null>(null)

  function startLandmarkSolo() {
    setSoloMode('landmarks')
    setSoloError(null)
    setSoloGame(createSoloGame())
  }

  async function startRandomSolo() {
    setSoloLoading(true)
    setSoloError(null)
    try {
      const deck = await fetchRandomWorldDeck(TOTAL_ROUNDS)
      setSoloMode('random')
      setSoloGame(createSoloGame(Math.random, TOTAL_ROUNDS, deck))
    } catch {
      setSoloError('Could not reach the panorama archive — try the landmark tour instead.')
    } finally {
      setSoloLoading(false)
    }
  }
  const {
    gameState,
    playerId,
    roomCode,
    status,
    error,
    connectionStatus,
    savedSession,
    createRoom,
    joinRoom,
    restoreSession,
    dispatch,
    leaveRoom,
  } = useGlobetrotterRoom()

  const redactedState = useMemo(
    () => (gameState && playerId ? redactForPlayer(gameState, playerId) : gameState),
    [gameState, playerId]
  )

  const isLoading = status === 'creating' || status === 'joining' || status === 'restoring'

  if (soloGame) {
    return (
      <>
        <GlobetrotterStyles />
        <SoloScreen
          game={soloGame}
          onGuess={(guess) =>
            setSoloGame((g) => (g ? submitSoloGuess(g, guess.lat, guess.lng) : g))
          }
          onNext={() => setSoloGame((g) => (g ? nextSoloRound(g) : g))}
          onRestart={() => {
            if (soloMode === 'random') {
              setSoloGame(null)
              void startRandomSolo()
            } else {
              startLandmarkSolo()
            }
          }}
          onExit={() => setSoloGame(null)}
        />
      </>
    )
  }

  if (!redactedState || !playerId || !roomCode) {
    return (
      <>
        <GlobetrotterStyles />
        <EntryScreen
          onSolo={startLandmarkSolo}
          onSoloRandom={() => void startRandomSolo()}
          soloLoading={soloLoading}
          soloError={soloError}
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
        <GlobetrotterStyles />
        <LobbyScreen
          gameState={redactedState}
          playerId={playerId}
          roomCode={roomCode}
          onStart={(deck) => dispatch({ type: 'START_GAME', playerId, deck })}
          onLeave={leaveRoom}
        />
      </>
    )
  }

  if (redactedState.phase === 'finished') {
    return (
      <>
        <GlobetrotterStyles />
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
      <GlobetrotterStyles />
      <DesyncIndicator active={connectionStatus === 'desynced'} />
      <PlayingScreen
        gameState={redactedState}
        playerId={playerId}
        onSubmitGuess={(guess) =>
          dispatch({ type: 'SUBMIT_GUESS', playerId, lat: guess.lat, lng: guess.lng })
        }
        onNextRound={() => dispatch({ type: 'NEXT_ROUND', playerId })}
        onLeave={leaveRoom}
      />
    </>
  )
}
