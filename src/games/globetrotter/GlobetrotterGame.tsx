'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { copyText } from '@/lib/clipboard'
import { isSupabaseConfigured } from '@/lib/supabase'
import { getSavedPlayerName, savePlayerName } from '@/lib/player-name'
import { normalizeRoomCode } from '@/lib/room-code'
import { useInviteCode, getInviteLink } from '@/hooks/useInviteCode'
import { useDroppedPlayers } from '@/hooks/useDroppedPlayers'
import { DesyncIndicator } from '@/components/multiplayer/DesyncIndicator'
import { SupabaseSetupNotice } from '@/components/multiplayer/SupabaseSetupNotice'
import { useGlobetrotterRoom } from './useGlobetrotterRoom'
import { buildRandomWorldDeck, type DeckSource, type RandomWorldDeck } from './randomWorld'
import { reverseGeocode, type PlaceName } from './placeName'
import { easeInOut } from './mercator'
import { PanoViewer, warmPanorama } from './PanoViewer'
import { WorldMap, type MapPin } from './WorldMap'
import { AvatarSvg } from './avatars'
import {
  createSoloGame,
  currentSoloLocation,
  formatKm,
  getLeaderboard,
  isRandomDrop,
  MIN_PLAYERS,
  nextSoloRound,
  redactForPlayer,
  submitSoloGuess,
  TOTAL_ROUNDS,
  type GameAction,
  type GameState,
  type GeoLocation,
  type Guess,
  type SoloGame,
} from './logic'

type ExpeditionMode = 'landmarks' | 'random'

interface ScoutProgress {
  found: number
  total: number
}

// ─── Shared shell (design .sk-topbar) ────────────────────────────────────────

function Shell({
  crumb,
  roomCode,
  children,
}: {
  crumb: string
  roomCode?: string | null
  children: React.ReactNode
}) {
  return (
    <>
      <div className="sk-topbar">
        <Link className="sk-back" href="/">
          ← Library
        </Link>
        <div className="sk-logo">
          <span className="sk-logo-mark">G</span>
          <span>GLOBETROTTER</span>
        </div>
        <div className="sk-crumb">
          / <span className="cur">{crumb}</span>
          {roomCode && (
            <span style={{ marginLeft: 18 }}>
              · room <span className="cur">{roomCode}</span>
            </span>
          )}
        </div>
      </div>
      {children}
    </>
  )
}

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="sk-stage">
      <div className="sk-stage-grid" />
      <div className="sk-stage-inner">{children}</div>
    </div>
  )
}

/** Animated number — the reveal reads better when the score climbs to its value. */
function CountUp({
  value,
  duration = 1100,
  format = (n: number) => Math.round(n).toLocaleString('en-US'),
}: {
  value: number
  duration?: number
  format?: (n: number) => string
}) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setShown(value * easeInOut(t))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <>{format(shown)}</>
}

// ─── Dropped players ─────────────────────────────────────────────────────────

/**
 * A room waits on everybody: one guess missing and nobody sees the reveal, and
 * if the missing player is the host, nobody can advance the round either. This
 * is the way out — offered only for a player presence has not reported for a
 * while (see `useDroppedPlayers`), and to everybody rather than just the host,
 * because the host is the one whose disappearance strands a room hardest.
 */
function DropPlayerButton({ name, onDrop }: { name: string; onDrop: () => void }) {
  return (
    <button
      type="button"
      className="sk-player-tag drop"
      data-testid="globetrotter-drop-player"
      aria-label={`Drop ${name} from the expedition`}
      title={`${name} lost connection — drop them and carry on`}
      onClick={onDrop}
    >
      Drop
    </button>
  )
}

interface DropControls {
  /** Players presence has stopped reporting for long enough to call gone. */
  droppedIds: string[]
  onDrop: (playerId: string) => void
}

// ─── How to play (design GlobetrotterHowTo) ──────────────────────────────────

const HOWTO_ICON = {
  viewBox: '0 0 32 32',
  width: 24,
  height: 24,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function HowToScreen({ onStart }: { onStart: () => void }) {
  return (
    <Stage>
      <div className="sk-howto">
        <div className="sk-howto-left">
          <span className="sk-tag mono">Solo or multiplayer · 1–8 players</span>
          <h1>
            See it.
            <br />
            Place it.
            <br />
            <em>Nail it.</em>
          </h1>
          <p className="sk-howto-sub">
            A 360° drop into a real place, anywhere on Earth — look around for clues, then open the
            map and pin your best guess. Closer pins score more. No labels, no hints: just your eyes
            and a world map.
          </p>
          <div className="sk-howto-cta">
            <button className="sk-btn" data-testid="play-game-button" onClick={onStart}>
              Play now →
            </button>
            <span className="sk-howto-meta">5 rounds · solo or host a room</span>
          </div>
        </div>
        <div className="sk-steps">
          <div className="sk-step">
            <span className="sk-step-num">01 · LOOK</span>
            <div className="sk-step-icon">
              <svg {...HOWTO_ICON}>
                <circle cx="16" cy="16" r="11" />
                <path d="M 5 16 L 27 16 M 16 5 Q 22 16 16 27 Q 10 16 16 5" />
              </svg>
            </div>
            <div className="sk-step-title">Drag the scene</div>
            <div className="sk-step-desc">
              Every round drops you into a real 360° panorama — no labels. Pan around for clues.
            </div>
          </div>
          <div className="sk-step">
            <span className="sk-step-num">02 · PIN</span>
            <div className="sk-step-icon">
              <svg {...HOWTO_ICON}>
                <path d="M 16 4 C 10 4 6 8 6 13 C 6 20 16 28 16 28 C 16 28 26 20 26 13 C 26 8 22 4 16 4 Z" />
                <circle cx="16" cy="13" r="3" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div className="sk-step-title">Open the map</div>
            <div className="sk-step-desc">
              Pop the corner map out to full size, zoom into the streets, then drop your pin.
            </div>
          </div>
          <div className="sk-step">
            <span className="sk-step-num">03 · SCORE</span>
            <div className="sk-step-icon">
              <svg {...HOWTO_ICON}>
                <path d="M 6 26 L 6 18 M 14 26 L 14 12 M 22 26 L 22 6 M 26 26 L 26 20" />
              </svg>
            </div>
            <div className="sk-step-title">Distance decides</div>
            <div className="sk-step-desc">
              Every pin gets compared to the real spot. Bullseye is 5,000 points.
            </div>
          </div>
          <div className="sk-step">
            <span className="sk-step-num">04 · TRAVEL</span>
            <div className="sk-step-icon">
              <svg {...HOWTO_ICON}>
                <path d="M 4 16 L 28 16 M 20 8 L 28 16 L 20 24" />
              </svg>
            </div>
            <div className="sk-step-title">Five rounds, one trip</div>
            <div className="sk-step-desc">
              Play solo against your own best, or host a room and race friends round by round.
            </div>
          </div>
        </div>
      </div>
    </Stage>
  )
}

// ─── Scouting (deck fetch progress) ──────────────────────────────────────────

/**
 * @param onCancel Only the browser doing the scouting can call it off, so a
 *   room's other players get the same screen without the button — the point is
 *   that they can see the trip being assembled rather than an idle lobby.
 */
function ScoutingScreen({
  progress,
  onCancel,
}: {
  progress: ScoutProgress
  onCancel?: () => void
}) {
  const pct = Math.round((progress.found / Math.max(1, progress.total)) * 100)
  return (
    <Stage>
      <div className="gt-scouting" data-testid="globetrotter-scouting">
        <div className="gt-scout-globe" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="32" cy="32" r="24" />
            <path d="M 8 32 L 56 32 M 32 8 Q 46 32 32 56 Q 18 32 32 8" />
          </svg>
        </div>
        <span className="sk-tag mono">Scouting the planet</span>
        <h2>Dropping you somewhere real</h2>
        <p className="gt-scout-sub">
          Pulling {progress.total} random geotagged photospheres out of the Wikimedia Commons
          archive. Anywhere with a camera counts.
        </p>
        <div className="gt-scout-bar" role="progressbar" aria-label="Locations found">
          <span className="gt-scout-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="gt-scout-dots">
          {Array.from({ length: progress.total }, (_, index) => (
            <span
              key={index}
              className={cn('gt-scout-dot', index < progress.found && 'is-on')}
              style={{ animationDelay: `${index * 0.12}s` }}
            />
          ))}
        </div>
        <span className="mono gt-scout-count" data-testid="globetrotter-scout-count">
          {progress.found} of {progress.total} locations locked
        </span>
        {onCancel ? (
          <button className="sk-btn sk-btn-ghost sk-btn-sm" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <span className="mono gt-scout-wait">Your host is picking the places</span>
        )}
      </div>
    </Stage>
  )
}

// ─── Entry (design GlobetrotterEntry: solo / create / join) ──────────────────

interface EntryScreenProps {
  onSolo: () => void
  soloError: string | null
  onCreate: (name: string) => void
  onJoin: (code: string, name: string) => void
  onRestore?: () => void
  hasSavedSession: boolean
  loading: boolean
  error: string | null
  /** Drops a stale failure — see `switchMode`. */
  onClearError?: () => void
  initialCode?: string | null
}

function EntryScreen({
  onSolo,
  soloError,
  onCreate,
  onJoin,
  onRestore,
  hasSavedSession,
  loading,
  error,
  onClearError,
  initialCode,
}: EntryScreenProps) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(initialCode ? 'join' : 'choose')
  const [name, setName] = useState(getSavedPlayerName)
  const [code, setCode] = useState(initialCode ?? '')

  useEffect(() => {
    if (!initialCode) return
    setMode('join')
    setCode(initialCode)
  }, [initialCode])

  const isCreate = mode === 'create'
  const canSubmit = name.trim().length >= 2 && (isCreate || code.trim().length >= 6)

  /**
   * Moving between the create and join forms drops the last failure with it.
   * "This game has already started." belongs to the room you tried to join;
   * carrying it over to the create form (which cannot possibly hit it) reads as
   * the app refusing to make you a room.
   */
  function switchMode(next: 'choose' | 'create' | 'join') {
    onClearError?.()
    setMode(next)
  }

  function submit() {
    if (!canSubmit || loading) return
    const trimmed = name.trim()
    savePlayerName(trimmed)
    if (isCreate) onCreate(trimmed)
    else onJoin(code.trim().toUpperCase(), trimmed)
  }

  if (mode === 'choose') {
    return (
      <Stage>
        <div className="sk-entry wide">
          <div className="sk-entry-head">
            <h2>How are you playing?</h2>
            <p>Go it alone against your own best streak, or host a room and race friends.</p>
          </div>
          {soloError && (
            <div data-testid="globetrotter-solo-error" className="gt-form-error">
              {soloError}
            </div>
          )}
          <div className="sk-entry-choose">
            <button
              className="sk-entry-card alt"
              data-testid="globetrotter-solo-button"
              onClick={onSolo}
            >
              <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="20" cy="20" r="14" />
                <path d="M 6 20 L 34 20 M 20 6 Q 28 20 20 34 Q 12 20 20 6" />
              </svg>
              <div>
                <div className="big">Solo · Random World</div>
                <div className="small">Five random drops · no clues, just your eyes</div>
              </div>
            </button>
            <button
              className="sk-entry-card"
              data-testid="create-room-button"
              onClick={() => switchMode('create')}
            >
              <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M 20 8 L 20 32 M 8 20 L 32 20" />
              </svg>
              <div>
                <div className="big">Create Room</div>
                <div className="small">Host a private expedition</div>
              </div>
            </button>
            <button
              className="sk-entry-card"
              data-testid="join-room-button"
              onClick={() => switchMode('join')}
            >
              <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M 8 20 L 32 20 M 24 12 L 32 20 L 24 28" />
              </svg>
              <div>
                <div className="big">Join Room</div>
                <div className="small">Enter a 6-char room code</div>
              </div>
            </button>
          </div>
          {hasSavedSession && onRestore && (
            <div style={{ textAlign: 'center' }}>
              <button className="sk-back" onClick={onRestore}>
                Resume your last expedition →
              </button>
            </div>
          )}
        </div>
      </Stage>
    )
  }

  return (
    <Stage>
      <div className="sk-entry">
        <div className="sk-entry-head">
          <h2>{isCreate ? 'Create a room' : 'Join a room'}</h2>
          <p>{isCreate ? "You'll be the expedition leader." : 'Ask the host for the room code.'}</p>
        </div>
        <div className="sk-form">
          {error && (
            <div data-testid="room-error" className="gt-form-error">
              {error}
            </div>
          )}
          <div className="sk-field">
            <label>Your name</label>
            <input
              className="sk-input"
              data-testid="player-name-input"
              value={name}
              maxLength={16}
              placeholder="e.g. Marco"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {!isCreate && (
            <div className="sk-field">
              <label>Room code</label>
              <input
                className="sk-input code"
                data-testid="room-code-input"
                value={code}
                maxLength={6}
                placeholder="7H2K9F"
                onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button className="sk-back" onClick={() => switchMode('choose')}>
              ← Back
            </button>
            <button
              className="sk-btn"
              data-testid={isCreate ? 'create-room-button' : 'join-room-button'}
              disabled={!canSubmit || loading}
              onClick={submit}
            >
              {loading ? 'Connecting…' : isCreate ? 'Create room' : 'Join room'}
            </button>
          </div>
        </div>
      </div>
    </Stage>
  )
}

// ─── Lobby (design GlobetrotterLobby) ────────────────────────────────────────

interface LobbyScreenProps {
  gameState: GameState
  playerId: string
  roomCode: string
  drop: DropControls
  onStart: (mode: ExpeditionMode) => void
  onLeave: () => void
}

function LobbyScreen({ gameState, playerId, roomCode, drop, onStart, onLeave }: LobbyScreenProps) {
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const ready = gameState.players.length >= MIN_PLAYERS
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [mode, setMode] = useState<ExpeditionMode>('random')

  function copy(text: string, key: 'code' | 'link') {
    copyText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1800)
    })
  }

  return (
    <Stage>
      <div className="sk-lobby">
        <div className="sk-roomcard">
          <span className="sk-room-label mono">Room · share this code</span>
          <div className="sk-room-code" data-testid="room-code">
            {roomCode}
          </div>
          <div className="sk-room-actions">
            <button className="sk-room-action" onClick={() => copy(roomCode, 'code')}>
              {copied === 'code' ? '✓ Copied' : '⧉ Copy code'}
            </button>
            <button
              className="sk-room-action"
              data-testid="invite-link"
              data-invite-link={getInviteLink('globetrotter', roomCode)}
              onClick={() => copy(getInviteLink('globetrotter', roomCode), 'link')}
            >
              {copied === 'link' ? '✓ Copied' : '🔗 Copy link'}
            </button>
          </div>
          <div className="mono" style={{ marginTop: 'auto', opacity: 0.5 }}>
            / lobby · waiting for explorers
          </div>
        </div>

        <div className="sk-lobby-right">
          <div className="sk-players-panel" data-testid="player-roster">
            <div className="sk-panel-head">
              <span>Players</span>
              <span>{gameState.players.length} / 8</span>
            </div>
            {gameState.players.map((player, index) => {
              const isDropped = drop.droppedIds.includes(player.id) && player.id !== playerId
              return (
                <div
                  key={player.id}
                  className={cn(
                    'sk-player-row',
                    player.id === playerId && 'is-you',
                    isDropped && 'is-away'
                  )}
                >
                  <div className="sk-player-avatar">
                    <AvatarSvg idx={index} size={28} />
                  </div>
                  <span className="sk-player-name">
                    {player.name}
                    {player.id === playerId && (
                      <span style={{ color: 'var(--ink-mute)', fontWeight: 400, fontSize: 11 }}>
                        {' '}
                        (you)
                      </span>
                    )}
                  </span>
                  {player.isHost && <span className="sk-player-tag host">HOST</span>}
                  {isDropped && <span className="sk-player-tag away">AWAY</span>}
                  {isDropped && (
                    <DropPlayerButton name={player.name} onDrop={() => drop.onDrop(player.id)} />
                  )}
                </div>
              )
            })}
          </div>

          <div className="sk-settings">
            <div className="sk-settings-row">
              <label>Expedition</label>
              <div className="sk-pill-group">
                <button
                  className={cn('sk-pill', mode === 'random' && 'is-on')}
                  data-testid="globetrotter-mode-random"
                  onClick={() => setMode('random')}
                  disabled={!isHost}
                >
                  Random world
                </button>
                <button
                  className={cn('sk-pill', mode === 'landmarks' && 'is-on')}
                  data-testid="globetrotter-mode-landmarks"
                  onClick={() => setMode('landmarks')}
                  disabled={!isHost}
                >
                  Landmarks
                </button>
              </div>
            </div>
            <div className="sk-settings-row">
              <label>Rounds</label>
              <span className="mono" style={{ color: 'var(--ink-dim)' }}>
                {TOTAL_ROUNDS} · distance scored
              </span>
            </div>
          </div>
        </div>

        <div className="sk-lobby-footer">
          <span className="sk-waiting">
            {isHost
              ? ready
                ? "You're the host"
                : `Need ${MIN_PLAYERS - gameState.players.length} more to start`
              : 'Waiting for host to start'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="sk-btn sk-btn-ghost sk-btn-sm"
              data-testid="leave-room-button"
              onClick={onLeave}
            >
              Leave
            </button>
            {isHost && (
              <button
                className="sk-btn"
                data-testid="start-game-button"
                disabled={!ready}
                onClick={() => onStart(mode)}
              >
                Start trip →
              </button>
            )}
          </div>
        </div>
      </div>
    </Stage>
  )
}

// ─── Field notes (landmark rooms only) ───────────────────────────────────────

function FieldNotes({ clues }: { clues: string[] }) {
  return (
    <div data-testid="globetrotter-clues" className="gt-briefing aside">
      <span className="tx-panel-label">Field notes</span>
      <ol>
        {clues.map((clue, index) => (
          <li key={clue}>
            <span className="n">0{index + 1}</span>
            <span>{clue}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ─── Game board (design GtGameBoard) ─────────────────────────────────────────

interface BoardPlayer {
  id: string
  name: string
  score: number
  locked: boolean
  isYou: boolean
}

interface GameBoardProps {
  roundNumber: number
  totalRounds: number
  location: GeoLocation
  isSolo: boolean
  players: BoardPlayer[]
  youLocked: boolean
  crumbScore: number
  deckNote?: string | null
  drop?: DropControls
  onLockGuess: (guess: Guess) => void
  onLeave: () => void
  leaveTestId: string
}

function GameBoard({
  roundNumber,
  totalRounds,
  location,
  isSolo,
  players,
  youLocked,
  crumbScore,
  deckNote = null,
  drop,
  onLockGuess,
  onLeave,
  leaveTestId,
}: GameBoardProps) {
  const [pending, setPending] = useState<Guess | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setPending(null)
    setExpanded(false)
  }, [roundNumber])

  const lockedCount = players.filter((p) => p.locked).length
  const waitingFor = players.length - lockedCount
  const hasClues = location.clues.length > 0

  function lockIn() {
    if (!pending) return
    setExpanded(false)
    onLockGuess(pending)
  }

  return (
    <div className="gt-board">
      <div className="sk-hud gt-hud" data-testid="globetrotter-status">
        <div className="sk-hud-left">
          <div className="sk-round">
            <span className="sk-round-label">{isSolo ? 'Solo expedition' : 'Expedition'}</span>
            <span className="sk-round-val">
              Round {roundNumber} of {totalRounds}
            </span>
          </div>
        </div>
        <div className="sk-hud-center">
          <span className="mono gt-hud-mode">
            {isSolo
              ? 'No labels · trust your eyes'
              : `Pins locked: ${lockedCount} of ${players.length}`}
          </span>
        </div>
        <div className="sk-hud-right">
          <span className="sk-round-val" style={{ fontSize: 16 }}>
            {crumbScore.toLocaleString('en-US')} <span className="mono">pts</span>
          </span>
          <button className="sk-back" data-testid={leaveTestId} onClick={onLeave}>
            Leave
          </button>
        </div>
      </div>

      <div className="gt-board-main">
        <div className="gt-viewport">
          {location.pano ? (
            <PanoViewer pano={location.pano} />
          ) : (
            <div className="gt-pano gt-pano-empty">
              <span className="mono">No panorama for this round — go by the field notes.</span>
            </div>
          )}

          {!isSolo && (
            <div className="sk-players-panel gt-players-float" data-testid="globetrotter-roster">
              <div className="sk-panel-head">
                <span>Explorers</span>
                <span>
                  {lockedCount}/{players.length} locked
                </span>
              </div>
              {players.map((player, index) => {
                const isDropped = !player.isYou && (drop?.droppedIds.includes(player.id) ?? false)
                return (
                  <div
                    key={player.id}
                    className={cn(
                      'sk-player-row',
                      player.isYou && 'is-you',
                      isDropped && 'is-away'
                    )}
                  >
                    <div className="sk-player-avatar" style={{ width: 26, height: 26 }}>
                      <AvatarSvg idx={index} size={20} />
                    </div>
                    <span className="sk-player-name" style={{ fontSize: 12 }}>
                      {player.name}
                    </span>
                    {isDropped ? (
                      <DropPlayerButton name={player.name} onDrop={() => drop?.onDrop(player.id)} />
                    ) : (
                      <span className="sk-score-pts" style={{ fontSize: 11 }}>
                        {player.score.toLocaleString('en-US')}
                      </span>
                    )}
                    {player.locked && <span className="sk-player-tag locked">✓</span>}
                  </div>
                )
              })}
            </div>
          )}

          {/* The map starts as a corner minimap so the photo gets the room, and
              pops out to full size the moment you want to place a pin. */}
          <div
            className={cn('gt-mapdock', expanded ? 'is-expanded' : 'is-collapsed')}
            data-testid="globetrotter-mapdock"
          >
            <WorldMap
              interactive={expanded && !youLocked}
              pins={pending && !youLocked ? [{ ...pending, isYou: true, pending: true }] : []}
              onSelect={(guess) => setPending(guess)}
            />

            {!expanded && (
              <button
                type="button"
                className="gt-map-open"
                data-testid="globetrotter-map-expand"
                onClick={() => setExpanded(true)}
              >
                <span className="mono">{youLocked ? 'View map' : '⤢ Open map to guess'}</span>
              </button>
            )}

            {expanded && (
              <div className="gt-guess-actions">
                {youLocked ? (
                  <span className="mono gt-locked-msg" data-testid="globetrotter-waiting">
                    ✓ Locked — Waiting for {waitingFor} more…
                  </span>
                ) : (
                  <>
                    <span className="mono gt-guess-hint">
                      {pending ? 'Pin placed — lock it in' : 'Click the map to drop a pin'}
                    </span>
                    <button
                      className="sk-btn sk-btn-sm"
                      data-testid="globetrotter-lock-guess"
                      disabled={!pending}
                      onClick={lockIn}
                    >
                      Lock in guess →
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="gt-map-close"
                  data-testid="globetrotter-map-collapse"
                  aria-label="Shrink map"
                  onClick={() => setExpanded(false)}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {youLocked && !expanded && (
            <span className="mono gt-locked-badge" data-testid="globetrotter-waiting">
              ✓ Locked — Waiting for {waitingFor} more…
            </span>
          )}
        </div>

        {hasClues && <FieldNotes clues={location.clues} />}
        {deckNote && (
          <span className="mono gt-deck-note" data-testid="globetrotter-deck-source">
            {deckNote}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Round reveal (design RoundReveal) ───────────────────────────────────────

interface RevealRow {
  id: string
  name: string
  avatarIdx: number
  isYou: boolean
  guess: Guess | null
  distanceKm: number | null
  points: number
}

interface RevealScreenProps {
  roundNumber: number
  totalRounds: number
  location: GeoLocation
  rows: RevealRow[]
  isSolo: boolean
  canAdvance: boolean
  drop?: DropControls
  onNext: () => void
}

/**
 * Names the town a Random World drop landed in.
 *
 * In a room the host resolves it once and shares it through the game state
 * (`useHostPlaceLookup`), so `location.place` is already there and no lookup
 * happens here — the geocoder sees one request per round per room, not one per
 * player. Solo has no room to share through, so it looks the drop up locally,
 * which is a single user-triggered request per reveal.
 */
function usePlaceName(location: GeoLocation, allowLookup: boolean): PlaceName | null {
  const [place, setPlace] = useState<PlaceName | null>(null)
  const shared = location.place
  const wanted = allowLookup && !shared && isRandomDrop(location)
  const { lat, lng } = location

  useEffect(() => {
    setPlace(null)
    if (!wanted) return
    let cancelled = false
    void reverseGeocode(lat, lng).then((result) => {
      if (!cancelled) setPlace(result)
    })
    return () => {
      cancelled = true
    }
  }, [wanted, lat, lng])

  if (shared) return { place: shared.name, country: shared.country }
  return place?.place ? place : null
}

function RevealScreen({
  roundNumber,
  totalRounds,
  location,
  rows,
  isSolo,
  canAdvance,
  drop,
  onNext,
}: RevealScreenProps) {
  const sorted = [...rows].sort((a, b) => b.points - a.points)
  const geo = usePlaceName(location, isSolo)
  // Random World knows only the country from its own polygons; a resolved town
  // name is more specific, so it takes the headline and the country drops down.
  const headline = geo?.place ?? location.name
  const subline = [geo ? (geo.country ?? location.name) : null, location.country]
    .filter(Boolean)
    .join(' · ')
  const pins: MapPin[] = sorted
    .filter((row) => row.guess)
    .map((row) => ({
      lat: row.guess!.lat,
      lng: row.guess!.lng,
      isYou: row.isYou,
      hueIndex: rows.findIndex((r) => r.id === row.id),
    }))

  const you = rows.find((row) => row.isYou)
  const yourDistance = you?.distanceKm ?? null

  return (
    <Stage>
      <div className="gt-reveal" data-testid="globetrotter-reveal">
        <div className="gt-reveal-head">
          <span className="sk-pick-meta">
            Round {roundNumber} of {totalRounds}
          </span>
          <h2 key={headline} data-testid="globetrotter-reveal-place">
            {location.emoji} {headline}
          </h2>
          <span className="gt-reveal-sub">{subline}</span>
        </div>
        <div className="gt-reveal-body">
          <div className="gt-reveal-map">
            <WorldMap
              interactive={false}
              autoFit
              pins={pins}
              target={{ lat: location.lat, lng: location.lng }}
              distanceLabel={yourDistance !== null ? formatKm(yourDistance) : null}
            />
          </div>
          <div className="gt-reveal-side">
            {yourDistance !== null && (
              <div className="gt-reveal-verdict" data-testid="globetrotter-reveal-distance">
                <span className="tx-panel-label">You were off by</span>
                <strong>
                  <CountUp
                    value={yourDistance}
                    format={(n) => formatKm(Math.max(0, n))}
                    duration={1200}
                  />
                </strong>
                <span className="gt-reveal-verdict-pts">
                  +<CountUp value={you?.points ?? 0} /> pts
                </span>
              </div>
            )}
            <div className="gt-reveal-table">
              <div className="sk-panel-head">
                <span>{isSolo ? 'Your guess' : 'Round results'}</span>
                <span>the gold flag was the spot</span>
              </div>
              {sorted.map((row, index) => {
                const isDropped = !row.isYou && (drop?.droppedIds.includes(row.id) ?? false)
                return (
                  <div
                    key={row.id}
                    className={cn('gt-reveal-row', row.isYou && 'you', isDropped && 'is-away')}
                    style={{ animationDelay: `${0.5 + index * 0.09}s` }}
                  >
                    <span className="gt-reveal-rank">{index + 1}</span>
                    <div className="sk-player-avatar" style={{ width: 26, height: 26 }}>
                      <AvatarSvg idx={row.avatarIdx} size={20} />
                    </div>
                    <span className="gt-reveal-name">{row.name}</span>
                    {isDropped ? (
                      <DropPlayerButton name={row.name} onDrop={() => drop?.onDrop(row.id)} />
                    ) : (
                      <span className="gt-reveal-dist mono">
                        {row.distanceKm !== null ? formatKm(row.distanceKm) : 'no guess'}
                      </span>
                    )}
                    <span
                      className="gt-reveal-pts"
                      data-testid={row.isYou ? 'globetrotter-round-score' : undefined}
                    >
                      +{row.points.toLocaleString('en-US')}
                    </span>
                  </div>
                )
              })}
            </div>
            {/* The photosphere's source page, held back until now: its title
                names the location, so during the round it is the answer. */}
            {location.pano && (
              <a
                className="gt-reveal-credit mono"
                data-testid="globetrotter-photo-credit"
                href={location.pano.page}
                target="_blank"
                rel="noreferrer"
              >
                Photo © {location.pano.author} · {location.pano.license} ·{' '}
                {location.pano.source ?? 'Wikimedia Commons'} ↗
              </a>
            )}
          </div>
        </div>
        <div className="sk-end-cta">
          {canAdvance ? (
            <button className="sk-btn" data-testid="globetrotter-next-round" onClick={onNext}>
              {roundNumber >= totalRounds ? 'See results →' : 'Next round →'}
            </button>
          ) : (
            <span className="sk-end-meta">Waiting for the host to continue…</span>
          )}
        </div>
      </div>
    </Stage>
  )
}

// ─── Finished (design GtFinished) ────────────────────────────────────────────

interface FinishedRow {
  id: string
  name: string
  avatarIdx: number
  isYou: boolean
  total: number
  /** Closed their tab after the results — still on the board, just not around. */
  left?: boolean
}

interface FinishedScreenProps {
  rows: FinishedRow[]
  totalRounds: number
  isSolo: boolean
  canRestart: boolean
  onPlayAgain: () => void
  onLeave: () => void
  leaveLabel: string
  leaveTestId: string
}

function FinishedScreen({
  rows,
  totalRounds,
  isSolo,
  canRestart,
  onPlayAgain,
  onLeave,
  leaveLabel,
  leaveTestId,
}: FinishedScreenProps) {
  const sorted = [...rows].sort((a, b) => b.total - a.total)
  const winner = sorted[0]
  const winners = sorted.filter((row) => row.total === winner?.total)
  const youWon = winners.some((row) => row.isYou)
  const winnerNames = winners.map((row) => row.name).join(' & ')

  return (
    <Stage>
      <div className="sk-end" data-testid="globetrotter-finished">
        <span className="sk-end-meta">Trip over · {totalRounds} rounds</span>
        <h2>
          {isSolo
            ? `${(winner?.total ?? 0).toLocaleString('en-US')} points`
            : youWon
              ? 'You win the trip 🌍'
              : `${winnerNames} wins the trip`}
        </h2>
        <div className="sk-end-word">
          {isSolo ? (
            <>
              Total score{' '}
              <strong data-testid="globetrotter-solo-total">
                {(winner?.total ?? 0).toLocaleString('en-US')}
              </strong>
            </>
          ) : (
            <>
              with <strong>{(winner?.total ?? 0).toLocaleString('en-US')}</strong> points across{' '}
              {totalRounds} rounds
            </>
          )}
        </div>
        <div className="sk-end-table" data-testid="globetrotter-final-leaderboard">
          {sorted.map((row, index) => (
            <div
              key={row.id}
              className={cn('sk-end-row', index === 0 && !isSolo && 'win', row.left && 'is-away')}
            >
              <span className="sk-end-rank">{index === 0 && !isSolo ? '👑' : index + 1}</span>
              <span className="sk-end-name">
                <AvatarSvg idx={row.avatarIdx} size={22} />
                {row.name}
                {row.isYou && ' (you)'}
                {row.left && <span className="sk-end-left mono">left</span>}
              </span>
              <span className="sk-end-delta">
                {isSolo ? 'TOTAL' : index === 0 ? 'WINNER' : `−${winner.total - row.total}`}
              </span>
              <span className="sk-end-total">{row.total.toLocaleString('en-US')}</span>
            </div>
          ))}
        </div>
        <div className="sk-end-cta">
          {canRestart ? (
            <button className="sk-btn" data-testid="globetrotter-play-again" onClick={onPlayAgain}>
              Play again
            </button>
          ) : (
            <span className="sk-end-meta">Waiting for host to restart…</span>
          )}
          <button className="sk-btn sk-btn-ghost" data-testid={leaveTestId} onClick={onLeave}>
            {leaveLabel}
          </button>
        </div>
      </div>
    </Stage>
  )
}

// ─── Root component ──────────────────────────────────────────────────────────

/**
 * Host-only: resolve the current Random World round's town and write it into
 * the room, so every player reads one shared answer.
 *
 * It runs during the guessing phase rather than at the reveal, which spreads
 * the lookups across the round instead of firing one the instant every client
 * flips to the reveal — the room costs the geocoder one request per round.
 */
function useHostPlaceLookup(
  state: GameState | null,
  playerId: string | null,
  dispatch: (action: GameAction) => void
): void {
  const done = useRef<string | null>(null)
  const round = state?.phase === 'playing' ? state.currentRound : null
  const isHost = Boolean(playerId && state?.players.find((p) => p.id === playerId)?.isHost)
  const needed = Boolean(round && isRandomDrop(round.location) && !round.location.place)
  const key = round ? `${round.number}:${round.location.lat},${round.location.lng}` : null

  useEffect(() => {
    if (!needed || !isHost || !key || !round || !playerId) return
    if (done.current === key) return
    done.current = key
    let cancelled = false
    void reverseGeocode(round.location.lat, round.location.lng).then((result) => {
      if (cancelled || !result?.place) return
      dispatch({
        type: 'SET_PLACE',
        playerId,
        roundNumber: round.number,
        place: { name: result.place, country: result.country },
      })
    })
    return () => {
      cancelled = true
    }
    // `key` identifies the round and its coordinates; the rest is read through it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, needed, isHost, playerId])
}

/**
 * A deck being scouted, or one already in hand.
 *
 * Assembling a Random World deck means four-odd requests to two rate-limited
 * archives, which is most of the wait between pressing Solo and looking at a
 * photosphere. Nothing about it depends on the player, so it starts while they
 * are still choosing how to play; by the time they press the button the deck is
 * usually sitting here and the scouting screen never appears at all.
 */
interface DeckScout {
  promise: Promise<RandomWorldDeck>
  /** Latest progress, so a player who presses Solo mid-scout sees a real bar. */
  progress: ScoutProgress
  /** Set once the archives have answered — the "no wait at all" case. */
  result: RandomWorldDeck | null
  controller: AbortController
  cancelled: boolean
}

/**
 * How long a relayed scout is believed after its last progress message.
 *
 * Long enough to cover a slow archive sweep between two finds, short enough
 * that a host who closed the tab does not leave the room watching a bar that
 * will never move.
 */
const SCOUT_SILENCE_MS = 20_000

const DECK_NOTES: Record<DeckSource, string | null> = {
  live: null,
  mixed: 'The photo archives were stingy — some rounds come from the offline reserve.',
  reserve: 'The photo archives were unreachable — playing the offline reserve deck.',
}

export function GlobetrotterGame() {
  const inviteCode = useInviteCode()
  const [gateDismissed, setGateDismissed] = useState(false)
  const [soloGame, setSoloGame] = useState<SoloGame | null>(null)
  const [soloSource, setSoloSource] = useState<DeckSource>('live')
  const [scouting, setScouting] = useState<ScoutProgress | null>(null)
  const [soloError, setSoloError] = useState<string | null>(null)
  const scoutRef = useRef<DeckScout | null>(null)
  // The host's scouting progress, as reported to everybody else in the room.
  const [roomScout, setRoomScout] = useState<ScoutProgress | null>(null)
  // Set for as long as a scout is worth telling the room about — the entry
  // screen's background scout deliberately is not, or joining a room mid-scout
  // would show the others a trip nobody has started.
  const announceRef = useRef<((progress: ScoutProgress) => void) | null>(null)

  const {
    gameState,
    playerId,
    roomCode,
    status,
    error,
    clearError,
    connectionStatus,
    onlinePlayerIds,
    savedSession,
    createRoom,
    joinRoom,
    restoreSession,
    dispatch,
    leaveRoom,
    broadcast,
    onBroadcast: onBroadcastRef,
  } = useGlobetrotterRoom()

  // One reverse-geocode per round for the whole room, run by the host.
  useHostPlaceLookup(gameState, playerId, dispatch)

  // Who the room may offer to drop: presence has to have lost them for a while,
  // so a reconnect or a backgrounded phone never puts a kick button on screen.
  const droppedIds = useDroppedPlayers(
    gameState?.players.map((player) => player.id) ?? [],
    onlinePlayerIds
  )
  const drop: DropControls = {
    droppedIds,
    onDrop: (targetId) => {
      if (playerId) dispatch({ type: 'KICK_PLAYER', playerId, targetId })
    },
  }

  // An invite link should land the player straight on the join form.
  useEffect(() => {
    if (inviteCode) setGateDismissed(true)
  }, [inviteCode])

  useEffect(() => () => scoutRef.current?.controller.abort(), [])

  /** Start scouting a deck, or hand back the one already on its way. */
  const scoutDeck = useCallback((): DeckScout => {
    const existing = scoutRef.current
    if (existing) return existing
    const controller = new AbortController()
    const scout: DeckScout = {
      progress: { found: 0, total: TOTAL_ROUNDS },
      result: null,
      controller,
      cancelled: false,
      promise: buildRandomWorldDeck(TOTAL_ROUNDS, {
        signal: controller.signal,
        onProgress: (found, total) => {
          scout.progress = { found, total }
          // Only moves a bar that is actually on screen; a background scout has
          // nobody watching it.
          setScouting((current) => (current ? { found, total } : current))
          announceRef.current?.({ found, total })
        },
      }),
    }
    void scout.promise.then((result) => {
      scout.result = result
    })
    scoutRef.current = scout
    return scout
  }, [])

  async function startSolo() {
    setSoloError(null)
    const scout = scoutDeck()
    // A deck that is already in hand skips the scouting screen entirely.
    if (!scout.result) setScouting(scout.progress)
    const { deck, source } = await scout.promise
    if (scout.cancelled) return
    scoutRef.current = null
    setScouting(null)
    if (deck.length < TOTAL_ROUNDS) {
      setSoloError('Could not scout enough panoramas right now — give it another go in a moment.')
      return
    }
    setSoloSource(source)
    setSoloGame(createSoloGame(deck))
  }

  function cancelScouting() {
    const scout = scoutRef.current
    if (scout) {
      scout.cancelled = true
      scout.controller.abort()
    }
    scoutRef.current = null
    setScouting(null)
    if (announceRef.current) {
      announceRef.current = null
      broadcast({ type: 'scouting_done' })
    }
  }

  /**
   * Host: start the trip. A Random World room has to scout a deck first, which
   * is several seconds of archive requests during which there is no game to
   * write — so the room is told what is happening rather than left staring at
   * an unchanged lobby. The deck may well be scouted already, in which case
   * this is instant and nobody sees a thing.
   */
  async function startRoom(mode: ExpeditionMode) {
    if (!playerId) return
    if (mode === 'landmarks') {
      void dispatch({ type: 'START_GAME', playerId })
      return
    }
    const scout = scoutDeck()
    if (!scout.result) {
      setScouting(scout.progress)
      announceRef.current = (progress) => broadcast({ type: 'scouting', ...progress })
      // Say so at once: the players waiting have no other way to know the host
      // pressed the button.
      broadcast({ type: 'scouting', ...scout.progress })
    }
    const { deck } = await scout.promise
    announceRef.current = null
    if (scout.cancelled) return
    scoutRef.current = null
    setScouting(null)
    // START_GAME lands as a state change, which is what clears the other
    // players' screens; a deck that came up short falls back to the landmarks.
    void dispatch({ type: 'START_GAME', playerId, deck })
  }

  // Scout a deck the moment the player is one click away from using it. Reading
  // "Solo · Random World" and reaching for it takes about as long as the
  // archives do, so the wait is spent rather than watched.
  const onEntryScreen = gateDismissed && !soloGame && !gameState
  useEffect(() => {
    if (onEntryScreen) scoutDeck()
  }, [onEntryScreen, scoutDeck])

  // Watch the host scout. Progress is chatter, so it is only ever believed for
  // as long as it keeps coming: a host who closes the tab mid-scout stops
  // sending, and the screen falls away on its own rather than stranding the
  // room in a trip that will never start.
  const roomPhase = gameState?.phase ?? null
  useEffect(() => {
    onBroadcastRef.current = (message) => {
      if (message.type === 'scouting_done') setRoomScout(null)
      else setRoomScout({ found: message.found, total: message.total })
    }
    return () => {
      onBroadcastRef.current = null
    }
  }, [onBroadcastRef])

  useEffect(() => {
    if (!roomScout) return
    const timer = setTimeout(() => setRoomScout(null), SCOUT_SILENCE_MS)
    return () => clearTimeout(timer)
  }, [roomScout])

  useEffect(() => {
    // The game starting (or the room going away) is the definitive answer.
    if (roomPhase !== 'lobby') setRoomScout(null)
  }, [roomPhase])

  // The next photosphere downloads while the player reads this round's reveal,
  // so "Developing film" is over before they press Next round.
  const nextSoloPanoUrl =
    (soloGame?.phase === 'reveal' ? soloGame.rounds[soloGame.roundNumber]?.pano?.url : null) ?? null
  useEffect(() => {
    if (nextSoloPanoUrl) warmPanorama(nextSoloPanoUrl)
  }, [nextSoloPanoUrl])

  const isLoading = status === 'creating' || status === 'joining' || status === 'restoring'

  // ── Scouting a deck: your own, or the host's ───────────────────────────────
  // `scouting` is this browser doing the work (a solo trip, or hosting one);
  // `roomScout` is somebody else's, relayed. Either way the whole room watches
  // the same five dots fill in instead of an idle lobby.
  const watchedScout = scouting ?? (roomPhase === 'lobby' ? roomScout : null)
  if (watchedScout && !soloGame) {
    return (
      <Shell crumb="Scouting" roomCode={roomCode}>
        <ScoutingScreen progress={watchedScout} onCancel={scouting ? cancelScouting : undefined} />
      </Shell>
    )
  }

  // ── Solo flow ──────────────────────────────────────────────────────────────
  if (soloGame) {
    const location = currentSoloLocation(soloGame)
    const result = soloGame.phase === 'reveal' ? soloGame.results[soloGame.roundNumber - 1] : null

    if (soloGame.phase === 'finished') {
      return (
        <Shell crumb="Trip over">
          <FinishedScreen
            rows={[
              { id: 'you', name: 'You', avatarIdx: 0, isYou: true, total: soloGame.totalScore },
            ]}
            totalRounds={soloGame.rounds.length}
            isSolo
            canRestart
            onPlayAgain={() => {
              setSoloGame(null)
              void startSolo()
            }}
            onLeave={() => setSoloGame(null)}
            leaveLabel="Back to menu"
            leaveTestId="globetrotter-exit-solo"
          />
        </Shell>
      )
    }

    if (soloGame.phase === 'reveal' && result) {
      return (
        <Shell crumb="Reveal">
          <RevealScreen
            roundNumber={soloGame.roundNumber}
            totalRounds={soloGame.rounds.length}
            location={location}
            rows={[
              {
                id: 'you',
                name: 'You',
                avatarIdx: 0,
                isYou: true,
                guess: result.guess,
                distanceKm: result.distanceKm,
                points: result.points,
              },
            ]}
            isSolo
            canAdvance
            onNext={() => setSoloGame(nextSoloRound(soloGame))}
          />
        </Shell>
      )
    }

    return (
      <Shell crumb={`Round ${soloGame.roundNumber}`}>
        <GameBoard
          roundNumber={soloGame.roundNumber}
          totalRounds={soloGame.rounds.length}
          location={location}
          isSolo
          players={[
            { id: 'you', name: 'You', score: soloGame.totalScore, locked: false, isYou: true },
          ]}
          youLocked={false}
          crumbScore={soloGame.totalScore}
          deckNote={DECK_NOTES[soloSource]}
          onLockGuess={(guess) => setSoloGame(submitSoloGuess(soloGame, guess.lat, guess.lng))}
          onLeave={() => setSoloGame(null)}
          leaveTestId="globetrotter-exit-solo"
        />
      </Shell>
    )
  }

  // ── Entry / gate ───────────────────────────────────────────────────────────
  if (!gameState || !playerId || !roomCode) {
    if (!gateDismissed) {
      return (
        <Shell crumb="How to play">
          <HowToScreen onStart={() => setGateDismissed(true)} />
        </Shell>
      )
    }
    if (!isSupabaseConfigured) {
      return (
        <Shell crumb="Choose your trip">
          <Stage>
            <div className="sk-entry">
              <div className="sk-entry-head">
                <h2>Solo only right now</h2>
                <p>Online rooms need Supabase configured — solo trips still work.</p>
              </div>
              {soloError && (
                <div data-testid="globetrotter-solo-error" className="gt-form-error">
                  {soloError}
                </div>
              )}
              <div className="sk-entry-choose">
                <button
                  className="sk-entry-card alt"
                  data-testid="globetrotter-solo-button"
                  onClick={() => void startSolo()}
                >
                  <div>
                    <div className="big">Solo · Random World</div>
                    <div className="small">Anywhere on Earth</div>
                  </div>
                </button>
              </div>
              <SupabaseSetupNotice />
            </div>
          </Stage>
        </Shell>
      )
    }
    return (
      <Shell crumb="Choose your trip">
        <EntryScreen
          onSolo={() => void startSolo()}
          soloError={soloError}
          onCreate={createRoom}
          onJoin={joinRoom}
          onRestore={savedSession ? restoreSession : undefined}
          hasSavedSession={Boolean(savedSession)}
          loading={isLoading}
          error={error}
          onClearError={clearError}
          initialCode={inviteCode}
        />
      </Shell>
    )
  }

  // ── Online flow ────────────────────────────────────────────────────────────

  // Dropped while you were away. Presence goes quiet for a backgrounded phone
  // as readily as for a closed laptop, so coming back to find the room has
  // moved on without you is a real ending, not an edge case — and a roster you
  // are not on renders a board with nobody's score on it. Say what happened.
  if (!gameState.players.some((player) => player.id === playerId)) {
    return (
      <Shell crumb="Dropped" roomCode={roomCode}>
        <Stage>
          <div className="sk-entry" data-testid="globetrotter-dropped">
            <div className="sk-entry-head">
              <h2>You were dropped from this expedition</h2>
              <p>
                The room lost you for long enough that the others carried on without you. Room{' '}
                {roomCode} is still running — ask them for the code to rejoin, or start a trip of
                your own.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                className="sk-btn"
                data-testid="globetrotter-dropped-exit"
                onClick={leaveRoom}
              >
                Back to menu →
              </button>
            </div>
          </div>
        </Stage>
      </Shell>
    )
  }

  const redacted = redactForPlayer(gameState, playerId)

  if (redacted.phase === 'lobby') {
    return (
      <Shell crumb="Lobby" roomCode={roomCode}>
        <LobbyScreen
          gameState={redacted}
          playerId={playerId}
          roomCode={roomCode}
          drop={drop}
          onStart={(mode) => void startRoom(mode)}
          onLeave={leaveRoom}
        />
      </Shell>
    )
  }

  if (redacted.phase === 'finished') {
    const isHost = redacted.players.find((p) => p.id === playerId)?.isHost ?? false
    const leaderboard = getLeaderboard(redacted)
    return (
      <Shell crumb="Trip over" roomCode={roomCode}>
        <FinishedScreen
          rows={leaderboard.map((player) => ({
            id: player.id,
            name: player.name,
            avatarIdx: redacted.players.findIndex((p) => p.id === player.id),
            isYou: player.id === playerId,
            total: player.score,
            left: player.left,
          }))}
          totalRounds={redacted.totalRounds}
          isSolo={false}
          canRestart={isHost}
          onPlayAgain={() => dispatch({ type: 'PLAY_AGAIN', playerId })}
          onLeave={leaveRoom}
          leaveLabel="Leave room"
          leaveTestId="leave-room-button"
        />
      </Shell>
    )
  }

  const round = redacted.currentRound!
  const isHost = redacted.players.find((p) => p.id === playerId)?.isHost ?? false

  if (round.phase === 'reveal') {
    return (
      <Shell crumb="Reveal" roomCode={roomCode}>
        <DesyncIndicator active={connectionStatus === 'desynced'} />
        <RevealScreen
          roundNumber={round.number}
          totalRounds={redacted.totalRounds}
          location={round.location}
          rows={redacted.players.map((player, index) => ({
            id: player.id,
            name: player.name,
            avatarIdx: index,
            isYou: player.id === playerId,
            guess: round.guesses[player.id] ?? null,
            distanceKm: round.distances[player.id] ?? null,
            points: round.roundScores[player.id] ?? 0,
          }))}
          isSolo={false}
          canAdvance={isHost}
          drop={drop}
          onNext={() => dispatch({ type: 'NEXT_ROUND', playerId })}
        />
      </Shell>
    )
  }

  const youLocked = Boolean(round.guesses[playerId])

  return (
    <Shell crumb={`Round ${round.number}`} roomCode={roomCode}>
      <DesyncIndicator active={connectionStatus === 'desynced'} />
      <GameBoard
        roundNumber={round.number}
        totalRounds={redacted.totalRounds}
        location={round.location}
        isSolo={false}
        players={redacted.players.map((player) => ({
          id: player.id,
          name: player.name,
          score: player.score,
          locked: Boolean(round.guesses[player.id]),
          isYou: player.id === playerId,
        }))}
        youLocked={youLocked}
        crumbScore={redacted.players.find((p) => p.id === playerId)?.score ?? 0}
        drop={drop}
        onLockGuess={(guess) =>
          dispatch({ type: 'SUBMIT_GUESS', playerId, lat: guess.lat, lng: guess.lng })
        }
        onLeave={leaveRoom}
        leaveTestId="leave-room-button"
      />
    </Shell>
  )
}
