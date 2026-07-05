'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { copyText } from '@/lib/clipboard'
import { isSupabaseConfigured } from '@/lib/supabase'
import { getSavedPlayerName, savePlayerName } from '@/lib/player-name'
import { normalizeRoomCode } from '@/lib/room-code'
import { useInviteCode, getInviteLink } from '@/hooks/useInviteCode'
import { DesyncIndicator } from '@/components/multiplayer/DesyncIndicator'
import { SupabaseSetupNotice } from '@/components/multiplayer/SupabaseSetupNotice'
import { useGlobetrotterRoom } from './useGlobetrotterRoom'
import { fetchRandomWorldDeck } from './randomWorld'
import { PanoViewer } from './PanoViewer'
import { WorldMap, type MapPin } from './WorldMap'
import { AvatarSvg } from './avatars'
import {
  createSoloGame,
  currentSoloLocation,
  formatKm,
  getLeaderboard,
  MIN_PLAYERS,
  nextSoloRound,
  redactForPlayer,
  submitSoloGuess,
  TOTAL_ROUNDS,
  type GameState,
  type GeoLocation,
  type Guess,
  type SoloGame,
} from './logic'

type ExpeditionMode = 'landmarks' | 'random'

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
            A 360° drop into a real place — look around for clues, then pin your best guess on the
            world map. Closer pins score more. Landmark tours add field notes; Random World gives
            you nothing but your eyes.
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
              Most rounds drop you into a real 360° panorama — no labels. Pan around for clues.
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
            <div className="sk-step-title">Drop your guess</div>
            <div className="sk-step-desc">
              Click anywhere on the world map to place a pin, then lock it in.
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

// ─── Entry (design GlobetrotterEntry: solo / create / join) ──────────────────

interface EntryScreenProps {
  onSolo: () => void
  onSoloRandom: () => void
  soloLoading: boolean
  soloError: string | null
  onCreate: (name: string) => void
  onJoin: (code: string, name: string) => void
  onRestore?: () => void
  hasSavedSession: boolean
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
  hasSavedSession,
  loading,
  error,
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
              disabled={soloLoading}
            >
              <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M 6 10 L 15 6 L 25 10 L 34 6 L 34 30 L 25 34 L 15 30 L 6 34 Z M 15 6 L 15 30 M 25 10 L 25 34" />
              </svg>
              <div>
                <div className="big">Solo · Landmarks</div>
                <div className="small">Five famous spots · clues + 360° views</div>
              </div>
            </button>
            <button
              className="sk-entry-card"
              data-testid="globetrotter-solo-random-button"
              onClick={onSoloRandom}
              disabled={soloLoading}
            >
              <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="20" cy="20" r="14" />
                <path d="M 6 20 L 34 20 M 20 6 Q 28 20 20 34 Q 12 20 20 6" />
              </svg>
              <div>
                <div className="big">{soloLoading ? 'Scouting…' : 'Solo · Random World'}</div>
                <div className="small">Anywhere on Earth · no clues, just eyes</div>
              </div>
            </button>
            <button
              className="sk-entry-card"
              data-testid="create-room-button"
              onClick={() => setMode('create')}
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
              onClick={() => setMode('join')}
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
            <button className="sk-back" onClick={() => setMode('choose')}>
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
  onStart: (deck?: GeoLocation[]) => void
  onLeave: () => void
}

function LobbyScreen({ gameState, playerId, roomCode, onStart, onLeave }: LobbyScreenProps) {
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const ready = gameState.players.length >= MIN_PLAYERS
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [mode, setMode] = useState<ExpeditionMode>('landmarks')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  function copy(text: string, key: 'code' | 'link') {
    copyText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1800)
    })
  }

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
      setStartError('Could not fetch random panoramas — check your connection or pick Landmarks.')
    } finally {
      setStarting(false)
    }
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
            {gameState.players.map((player, index) => (
              <div
                key={player.id}
                className={cn('sk-player-row', player.id === playerId && 'is-you')}
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
              </div>
            ))}
          </div>

          <div className="sk-settings">
            <div className="sk-settings-row">
              <label>Expedition</label>
              <div className="sk-pill-group">
                <button
                  className={cn('sk-pill', mode === 'landmarks' && 'is-on')}
                  data-testid="globetrotter-mode-landmarks"
                  onClick={() => setMode('landmarks')}
                  disabled={!isHost}
                >
                  Landmarks
                </button>
                <button
                  className={cn('sk-pill', mode === 'random' && 'is-on')}
                  data-testid="globetrotter-mode-random"
                  onClick={() => setMode('random')}
                  disabled={!isHost}
                >
                  Random world
                </button>
              </div>
            </div>
            <div className="sk-settings-row">
              <label>Rounds</label>
              <span className="mono" style={{ color: 'var(--ink-dim)' }}>
                {TOTAL_ROUNDS} · distance scored
              </span>
            </div>
            {startError && (
              <div data-testid="globetrotter-start-error" className="gt-form-error">
                {startError}
              </div>
            )}
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
                disabled={!ready || starting}
                onClick={() => void handleStart()}
              >
                {starting ? 'Scouting the planet…' : 'Start trip →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Stage>
  )
}

// ─── Field notes / random drop panels ────────────────────────────────────────

function FieldNotes({ clues, hero }: { clues: string[]; hero: boolean }) {
  return (
    <div data-testid="globetrotter-clues" className={cn('gt-briefing', hero ? 'hero' : 'aside')}>
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

function RandomDropNote() {
  return (
    <div data-testid="globetrotter-random-drop" className="gt-briefing aside">
      <span className="tx-panel-label">Random world drop</span>
      <ol>
        <li>
          <span className="n">--</span>
          <span>
            No field notes out here — you could be anywhere on Earth. Scan for road signs, language,
            driving side, vegetation and architecture, then trust your gut.
          </span>
        </li>
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
  lockedGhosts: Guess[]
  crumbScore: number
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
  lockedGhosts,
  crumbScore,
  onLockGuess,
  onLeave,
  leaveTestId,
}: GameBoardProps) {
  const [pending, setPending] = useState<Guess | null>(null)

  useEffect(() => {
    setPending(null)
  }, [roundNumber])

  const lockedCount = players.filter((p) => p.locked).length
  const waitingFor = players.length - lockedCount
  const hasPano = Boolean(location.pano)
  const hasClues = location.clues.length > 0

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
        <div className="gt-panorama-col">
          {hasPano && location.pano ? (
            <PanoViewer pano={location.pano} />
          ) : (
            hasClues && <FieldNotes clues={location.clues} hero />
          )}
          {hasPano && hasClues && <FieldNotes clues={location.clues} hero={false} />}
          {hasPano && !hasClues && <RandomDropNote />}
        </div>

        <div className="gt-sidebar">
          <div className="gt-mappanel">
            <span className="tx-panel-label" style={{ padding: '10px 12px 0' }}>
              Where in the world?
            </span>
            <WorldMap
              interactive={!youLocked}
              pins={pending && !youLocked ? [{ ...pending, isYou: true, pending: true }] : []}
              ghosts={lockedGhosts}
              onSelect={(guess) => setPending(guess)}
            />
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
                    onClick={() => pending && onLockGuess(pending)}
                  >
                    Lock in guess →
                  </button>
                </>
              )}
            </div>
          </div>

          {!isSolo && (
            <div className="sk-players-panel gt-players-mini">
              <div className="sk-panel-head">
                <span>Explorers</span>
                <span>
                  {lockedCount}/{players.length} locked
                </span>
              </div>
              {players.map((player, index) => (
                <div key={player.id} className={cn('sk-player-row', player.isYou && 'is-you')}>
                  <div className="sk-player-avatar" style={{ width: 30, height: 30 }}>
                    <AvatarSvg idx={index} size={24} />
                  </div>
                  <span className="sk-player-name" style={{ fontSize: 13 }}>
                    {player.name}
                  </span>
                  <span className="sk-score-pts" style={{ fontSize: 12 }}>
                    {player.score.toLocaleString('en-US')}
                  </span>
                  {player.locked && <span className="sk-player-tag locked">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
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
  onNext: () => void
}

function RevealScreen({
  roundNumber,
  totalRounds,
  location,
  rows,
  isSolo,
  canAdvance,
  onNext,
}: RevealScreenProps) {
  const sorted = [...rows].sort((a, b) => b.points - a.points)
  const pins: MapPin[] = sorted
    .filter((row) => row.guess)
    .map((row) => ({
      lat: row.guess!.lat,
      lng: row.guess!.lng,
      isYou: row.isYou,
      hueIndex: rows.findIndex((r) => r.id === row.id),
    }))

  return (
    <Stage>
      <div className="gt-reveal" data-testid="globetrotter-reveal">
        <div className="gt-reveal-head">
          <span className="sk-pick-meta">
            Round {roundNumber} of {totalRounds}
          </span>
          <h2>
            {location.emoji} {location.name}
          </h2>
          <span className="gt-reveal-sub">{location.country}</span>
        </div>
        <div className="gt-reveal-body">
          <div className="gt-reveal-map">
            <WorldMap
              interactive={false}
              pins={pins}
              target={{ lat: location.lat, lng: location.lng }}
            />
          </div>
          <div className="gt-reveal-table">
            <div className="sk-panel-head">
              <span>{isSolo ? 'Your guess' : 'Round results'}</span>
              <span>the gold flag was the spot</span>
            </div>
            {sorted.map((row, index) => (
              <div key={row.id} className={cn('gt-reveal-row', row.isYou && 'you')}>
                <span className="gt-reveal-rank">{index + 1}</span>
                <div className="sk-player-avatar" style={{ width: 26, height: 26 }}>
                  <AvatarSvg idx={row.avatarIdx} size={20} />
                </div>
                <span className="gt-reveal-name">{row.name}</span>
                <span className="gt-reveal-dist mono">
                  {row.distanceKm !== null ? formatKm(row.distanceKm) : 'no guess'}
                </span>
                <span
                  className="gt-reveal-pts"
                  data-testid={row.isYou ? 'globetrotter-round-score' : undefined}
                >
                  +{row.points.toLocaleString('en-US')}
                </span>
              </div>
            ))}
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
            <div key={row.id} className={cn('sk-end-row', index === 0 && !isSolo && 'win')}>
              <span className="sk-end-rank">{index === 0 && !isSolo ? '👑' : index + 1}</span>
              <span className="sk-end-name">
                <AvatarSvg idx={row.avatarIdx} size={22} />
                {row.name}
                {row.isYou && ' (you)'}
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

export function GlobetrotterGame() {
  const inviteCode = useInviteCode()
  const [gateDismissed, setGateDismissed] = useState(false)
  const [soloGame, setSoloGame] = useState<SoloGame | null>(null)
  const [soloMode, setSoloMode] = useState<ExpeditionMode>('landmarks')
  const [soloLoading, setSoloLoading] = useState(false)
  const [soloError, setSoloError] = useState<string | null>(null)

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

  // An invite link should land the player straight on the join form.
  useEffect(() => {
    if (inviteCode) setGateDismissed(true)
  }, [inviteCode])

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
      setSoloError('Could not reach the panorama archive — try a Landmarks trip instead.')
    } finally {
      setSoloLoading(false)
    }
  }

  const isLoading = status === 'creating' || status === 'joining' || status === 'restoring'

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
              if (soloMode === 'random') {
                setSoloGame(null)
                void startRandomSolo()
              } else {
                startLandmarkSolo()
              }
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
          lockedGhosts={[]}
          crumbScore={soloGame.totalScore}
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
                  onClick={startLandmarkSolo}
                >
                  <div>
                    <div className="big">Solo · Landmarks</div>
                    <div className="small">Five famous spots</div>
                  </div>
                </button>
                <button
                  className="sk-entry-card"
                  data-testid="globetrotter-solo-random-button"
                  onClick={() => void startRandomSolo()}
                  disabled={soloLoading}
                >
                  <div>
                    <div className="big">{soloLoading ? 'Scouting…' : 'Solo · Random World'}</div>
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
          onSolo={startLandmarkSolo}
          onSoloRandom={() => void startRandomSolo()}
          soloLoading={soloLoading}
          soloError={soloError}
          onCreate={createRoom}
          onJoin={joinRoom}
          onRestore={savedSession ? restoreSession : undefined}
          hasSavedSession={Boolean(savedSession)}
          loading={isLoading}
          error={error}
          initialCode={inviteCode}
        />
      </Shell>
    )
  }

  // ── Online flow ────────────────────────────────────────────────────────────
  const redacted = redactForPlayer(gameState, playerId)

  if (redacted.phase === 'lobby') {
    return (
      <Shell crumb="Lobby" roomCode={roomCode}>
        <LobbyScreen
          gameState={redacted}
          playerId={playerId}
          roomCode={roomCode}
          onStart={(deck) => dispatch({ type: 'START_GAME', playerId, deck })}
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
          onNext={() => dispatch({ type: 'NEXT_ROUND', playerId })}
        />
      </Shell>
    )
  }

  const youLocked = Boolean(round.guesses[playerId])
  const lockedGhosts = redacted.players
    .filter((player) => player.id !== playerId && round.guesses[player.id])
    .map((player) => round.guesses[player.id])

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
        lockedGhosts={lockedGhosts}
        crumbScore={redacted.players.find((p) => p.id === playerId)?.score ?? 0}
        onLockGuess={(guess) =>
          dispatch({ type: 'SUBMIT_GUESS', playerId, lat: guess.lat, lng: guess.lng })
        }
        onLeave={leaveRoom}
        leaveTestId="leave-room-button"
      />
    </Shell>
  )
}
