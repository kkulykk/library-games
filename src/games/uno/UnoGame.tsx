'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { getSavedPlayerName, savePlayerName } from '@/lib/player-name'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useInviteCode, getInviteLink } from '@/hooks/useInviteCode'
import { ArcadeShell, arcadeShellStyles } from '@/components/multiplayer/ArcadeShell'
import { LobbyActions } from '@/components/multiplayer/LobbyActions'
import { ResumeSessionCard } from '@/components/multiplayer/ResumeSessionCard'
import type { SavedSessionSummary } from '@/components/multiplayer/ResumeSessionButton'
import { DesyncIndicator } from '@/components/multiplayer/DesyncIndicator'
import { normalizeRoomCode } from '@/lib/room-code'
import { useUnoRoom } from './useUnoRoom'
import {
  getPlayableCards,
  getCurrentPlayer,
  getTopCard,
  redactForPlayer,
  type Card,
  type CardColor,
  type CardValue,
  type GameState,
  type Player,
} from './logic'
import styles from './UnoGame.module.css'

// ─── Animations not in the CSS module ───────────────────────────────────────

function UnoStyles() {
  return (
    <style>{`
      @keyframes confetti-fall {
        0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
    `}</style>
  )
}

// ─── Card rendering (markup-based, no sprite sheet) ─────────────────────────

const COLORS: CardColor[] = ['red', 'yellow', 'green', 'blue']

function cornerLabel(value: CardValue): string {
  if (typeof value === 'number') return String(value)
  if (value === 'skip') return 'Ø'
  if (value === 'reverse') return '⇄'
  if (value === 'draw2') return '+2'
  if (value === 'wild') return '★'
  if (value === 'wild4') return '+4'
  return ''
}

function CardSymbol({ value }: { value: CardValue }) {
  if (typeof value === 'number') return <span className={styles.centerNum}>{value}</span>
  if (value === 'skip') {
    return (
      <span className={styles.centerIcon}>
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
        >
          <circle cx="24" cy="24" r="18" />
          <path d="M 11 11 L 37 37" />
        </svg>
      </span>
    )
  }
  if (value === 'reverse') {
    return (
      <span className={styles.centerIcon}>
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        >
          <path d="M 8 16 L 18 8 L 18 14 L 32 14 Q 40 14 40 22" />
          <path d="M 40 32 L 30 40 L 30 34 L 16 34 Q 8 34 8 26" />
        </svg>
      </span>
    )
  }
  if (value === 'draw2') {
    return (
      <span className={styles.centerNum} style={{ fontSize: '2.4rem' }}>
        +2
      </span>
    )
  }
  if (value === 'wild') {
    return (
      <span className={styles.centerIcon} style={{ position: 'relative', zIndex: 2 }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="currentColor">
          <circle cx="20" cy="20" r="6" />
        </svg>
      </span>
    )
  }
  if (value === 'wild4') {
    return (
      <span
        className={styles.centerNum}
        style={{ fontSize: '2.25rem', color: '#fff', position: 'relative', zIndex: 2 }}
      >
        +4
      </span>
    )
  }
  return null
}

interface UnoCardProps {
  card: Card
  size?: 'sm' | 'md' | 'lg'
  playable?: boolean
  faceDown?: boolean
  onClick?: () => void
  className?: string
  testid?: string
  title?: string
}

function UnoCard({
  card,
  size = 'lg',
  playable,
  faceDown,
  onClick,
  className,
  testid,
  title,
}: UnoCardProps) {
  const sizeClass = size === 'sm' ? styles.cardSm : size === 'md' ? styles.cardMd : ''

  if (faceDown) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(styles.cardBack, sizeClass, className)}
        title={title ?? 'Face-down card'}
        data-testid={testid}
        aria-label="Face-down card"
      />
    )
  }

  const Component = onClick ? 'button' : 'div'
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick && !playable ? true : undefined}
      className={cn(styles.card, sizeClass, className)}
      data-c={card.color}
      data-testid={testid}
      title={title ?? `${card.color} ${card.value}`}
    >
      <div className={styles.face}>
        {card.color === 'wild' ? (
          <>
            <span className={cn(styles.quad, styles.quadTl)} />
            <span className={cn(styles.quad, styles.quadTr)} />
            <span className={cn(styles.quad, styles.quadBl)} />
            <span className={cn(styles.quad, styles.quadBr)} />
          </>
        ) : (
          <span className={styles.ellipse} />
        )}
        <span className={cn(styles.corner, styles.tl)}>{cornerLabel(card.value)}</span>
        <div className={styles.center}>
          <CardSymbol value={card.value} />
        </div>
        <span className={cn(styles.corner, styles.br)}>{cornerLabel(card.value)}</span>
      </div>
    </Component>
  )
}

// ─── Color picker overlay ────────────────────────────────────────────────────

function ColorPicker({
  onPick,
  onCancel,
}: {
  onPick: (color: CardColor) => void
  onCancel: () => void
}) {
  return (
    <div className={styles.overlay}>
      <div className={styles.picker}>
        <h3 className={styles.pickerTitle}>Pick a color</h3>
        <p className={styles.pickerSubtitle}>/ wild card · choose new active color</p>
        <div className={styles.pickerGrid}>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={styles.pickerBtn}
              data-c={c}
              onClick={() => onPick(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={cn(
            arcadeShellStyles.button,
            arcadeShellStyles.buttonGhost,
            arcadeShellStyles.buttonSmall
          )}
          onClick={onCancel}
        >
          ← Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Crumb ──────────────────────────────────────────────────────────────────

function makeCrumb(
  gameState: GameState | null,
  roomCode: string | null,
  playerId: string | null,
  inviteCode: string | null | undefined
) {
  if (!gameState) {
    return (
      <>
        /{' '}
        <span className={arcadeShellStyles.crumbAccent}>
          {inviteCode === undefined ? 'Loading' : inviteCode ? 'Join a game' : 'How to play'}
        </span>
      </>
    )
  }

  if (gameState.phase === 'lobby') {
    return (
      <>
        / Lobby · <span className={arcadeShellStyles.crumbAccent}>{roomCode}</span>
      </>
    )
  }

  if (gameState.phase === 'playing') {
    const currentPlayer = getCurrentPlayer(gameState)
    const turnLabel =
      currentPlayer?.id === playerId ? 'Your turn' : `${currentPlayer?.name ?? 'Player'}’s turn`
    return (
      <>
        / <span className={arcadeShellStyles.crumbAccent}>{turnLabel}</span>
        {roomCode && <> · room {roomCode}</>}
      </>
    )
  }

  return (
    <>
      / <span className={arcadeShellStyles.crumbAccent}>Round over</span>
      {roomCode && <> · room {roomCode}</>}
    </>
  )
}

// ─── Setup / loading screens ─────────────────────────────────────────────────

function SetupRequired() {
  return (
    <div className={styles.setup}>
      <div className="text-5xl">🔧</div>
      <h2>Supabase setup required</h2>
      <p>
        Online multiplayer rooms still run through Supabase. The redesign is ready, but the game
        needs the same backend wiring as before.
      </p>
      <pre>{`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}</pre>
    </div>
  )
}

function InviteResolvingScreen() {
  return (
    <div className={styles.entryShell}>
      <div className={styles.entryHead}>
        <h2>Loading room…</h2>
        <p>Checking your invite link and preparing the right entry screen.</p>
      </div>
    </div>
  )
}

// ─── How-to screen ──────────────────────────────────────────────────────────

const HOWTO_STEPS: Array<{
  number: string
  title: string
  copy: string
  accent?: boolean
  icon: React.ReactNode
}> = [
  {
    number: '01 · MATCH',
    title: 'Color or number',
    copy: "Play any card sharing the top card's color or face value. Wilds go anytime.",
    icon: (
      <svg
        viewBox="0 0 32 32"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="5" y="5" width="11" height="16" rx="1.5" />
        <rect x="16" y="11" width="11" height="16" rx="1.5" />
      </svg>
    ),
  },
  {
    number: '02 · ATTACK',
    title: 'Skip · Reverse · +2',
    copy: 'Action cards skip a turn, flip direction, or force a draw. Wild +4 hits hardest.',
    accent: true,
    icon: (
      <svg
        viewBox="0 0 32 32"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M 6 16 L 14 8 L 14 13 L 26 13 Q 28 13 28 15" />
        <path d="M 26 16 L 22 12 M 26 16 L 22 20" />
      </svg>
    ),
  },
  {
    number: '03 · CALL UNO',
    title: 'One card left',
    copy: 'Call UNO before someone catches you — or draw two as penalty.',
    icon: (
      <svg
        viewBox="0 0 32 32"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      >
        <path d="M 8 22 L 8 10 L 14 22 L 14 10" />
        <path d="M 18 10 L 18 18 Q 18 22 22 22 Q 26 22 26 18 L 26 10" />
      </svg>
    ),
  },
  {
    number: '04 · WIN',
    title: 'Empty your hand',
    copy: "First to zero cards wins the round — and adds opponents' card values to their score.",
    icon: (
      <svg
        viewBox="0 0 32 32"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M 10 6 L 22 6 L 22 14 Q 22 20 16 20 Q 10 20 10 14 Z" />
        <path d="M 13 22 L 19 22 L 20 26 L 12 26 Z" />
      </svg>
    ),
  },
]

function HowToScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroLeft}>
        <span className={cn(styles.tag, arcadeShellStyles.mono)}>Cards · 2–10 players</span>
        <h1 className={styles.heroTitle}>
          Match it.
          <br />
          Stack it.
          <br />
          <span className={styles.heroTitleAccent}>UNO it.</span>
        </h1>
        <p className={styles.heroCopy}>
          Drop cards that match the top of the pile by color or number. Stack action cards to dunk
          on the next player. First to empty their hand wins the round.
        </p>
        <div className={styles.heroActions}>
          <button
            type="button"
            data-testid="play-game-button"
            onClick={onStart}
            className={arcadeShellStyles.button}
          >
            Play now →
          </button>
          <span className={cn(styles.heroMeta, arcadeShellStyles.mono)}>
            ~5 min · 2–10 players · 108 cards
          </span>
        </div>
      </div>

      <div className={styles.steps}>
        {HOWTO_STEPS.map((step) => (
          <article key={step.number} className={cn(styles.step, step.accent && styles.stepAccent)}>
            <span className={cn(styles.stepNumber, arcadeShellStyles.mono)}>{step.number}</span>
            <div className={styles.stepIcon}>{step.icon}</div>
            <div className={styles.stepTitle}>{step.title}</div>
            <div className={styles.stepDescription}>{step.copy}</div>
          </article>
        ))}
      </div>
    </div>
  )
}

// ─── Entry screen ───────────────────────────────────────────────────────────

interface EntryScreenProps {
  onCreate: (name: string) => void
  onJoin: (code: string, name: string) => void
  onRestore?: () => void
  savedSession: SavedSessionSummary | null
  loading: boolean
  error: string | null
  initialCode?: string | null
  onBackToHowTo?: () => void
}

function EntryScreen({
  onCreate,
  onJoin,
  onRestore,
  savedSession,
  loading,
  error,
  initialCode,
  onBackToHowTo,
}: EntryScreenProps) {
  const [name, setName] = useState(getSavedPlayerName)
  const [joinCode, setJoinCode] = useState(initialCode ?? '')
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(initialCode ? 'join' : 'choose')

  useEffect(() => {
    if (!initialCode) return
    setMode('join')
    setJoinCode(initialCode)
  }, [initialCode])

  const canSubmit = name.trim().length >= 2 && (mode === 'create' || joinCode.trim().length >= 6)

  function submit() {
    if (!canSubmit) return
    const trimmedName = name.trim()
    savePlayerName(trimmedName)
    if (mode === 'create') {
      onCreate(trimmedName)
      return
    }
    onJoin(joinCode.trim().toUpperCase(), trimmedName)
  }

  if (mode === 'choose') {
    return (
      <div className={styles.entryShell}>
        <div className={styles.entryHead}>
          <h2>Ready to deal?</h2>
          <p>Host a private table or join a friend&apos;s room with a code.</p>
        </div>

        {savedSession && onRestore && (
          <ResumeSessionCard
            session={savedSession}
            onResume={onRestore}
            className={styles.resumeCard}
            titleClassName={styles.resumeTitle}
            descriptionClassName={styles.resumeCopy}
            actionClassName={cn(arcadeShellStyles.button, arcadeShellStyles.buttonSmall)}
          />
        )}

        <div className={styles.entryChoiceGrid}>
          <button
            type="button"
            data-testid="create-room-button"
            className={cn(styles.entryCard, styles.entryCardAccent)}
            onClick={() => setMode('create')}
          >
            <span className={styles.entryCardIcon}>
              <svg
                viewBox="0 0 40 40"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M 20 8 L 20 32 M 8 20 L 32 20" />
              </svg>
            </span>
            <div>
              <div className={styles.entryCardTitle}>Create Table</div>
              <div className={cn(styles.entryCardCopy, arcadeShellStyles.mono)}>
                Host a private game
              </div>
            </div>
          </button>

          <button
            type="button"
            data-testid="join-room-button"
            className={styles.entryCard}
            onClick={() => setMode('join')}
          >
            <span className={styles.entryCardIcon}>
              <svg
                viewBox="0 0 40 40"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M 8 20 L 32 20 M 24 12 L 32 20 L 24 28" />
              </svg>
            </span>
            <div>
              <div className={styles.entryCardTitle}>Join Table</div>
              <div className={cn(styles.entryCardCopy, arcadeShellStyles.mono)}>
                Enter a 4-char code
              </div>
            </div>
          </button>
        </div>

        {onBackToHowTo && (
          <div className={styles.entryActions}>
            <button
              type="button"
              className={cn(
                arcadeShellStyles.button,
                arcadeShellStyles.buttonGhost,
                arcadeShellStyles.buttonSmall
              )}
              onClick={onBackToHowTo}
            >
              ← Back to how to play
            </button>
          </div>
        )}
      </div>
    )
  }

  const isCreate = mode === 'create'
  return (
    <div className={styles.entryShell}>
      <div className={styles.entryHead}>
        <h2>{isCreate ? 'New table' : 'Join a table'}</h2>
        <p>{isCreate ? "You'll get a code to share." : 'Enter the code your friend shared.'}</p>
      </div>

      <div className={styles.entryForm}>
        {error && (
          <div data-testid="room-error" className={styles.error}>
            {error}
          </div>
        )}

        <label className={styles.field}>
          <span className={cn(styles.label, arcadeShellStyles.mono)}>Your nickname</span>
          <input
            data-testid="player-name-input"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            placeholder="e.g. queen of clubs"
            autoFocus
            className={arcadeShellStyles.input}
          />
        </label>

        {!isCreate && (
          <label className={styles.field}>
            <span className={cn(styles.label, arcadeShellStyles.mono)}>Room code</span>
            <input
              data-testid="room-code-input"
              value={joinCode}
              onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
              placeholder="7H2K9F"
              maxLength={6}
              className={cn(arcadeShellStyles.input, styles.codeInput)}
            />
          </label>
        )}

        <div className={cn(styles.entryActions, styles.entryActionsBetween)}>
          <button
            type="button"
            className={cn(
              arcadeShellStyles.button,
              arcadeShellStyles.buttonGhost,
              arcadeShellStyles.buttonSmall
            )}
            onClick={() => setMode('choose')}
          >
            ← Back
          </button>
          <button
            type="button"
            data-testid={isCreate ? 'create-room-button' : 'join-room-button'}
            disabled={loading || !canSubmit}
            onClick={submit}
            className={arcadeShellStyles.button}
          >
            {loading ? 'Connecting…' : isCreate ? 'Create →' : 'Join →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Lobby screen ───────────────────────────────────────────────────────────

interface LobbyScreenProps {
  gameState: GameState
  playerId: string
  roomCode: string
  onlinePlayerIds: string[]
  onStart: () => void
  onLeave: () => void
}

function LobbyScreen({
  gameState,
  playerId,
  roomCode,
  onlinePlayerIds,
  onStart,
  onLeave,
}: LobbyScreenProps) {
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const inviteLink = getInviteLink('uno', roomCode)

  function copyValue(value: string, kind: 'code' | 'link') {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(kind)
        window.setTimeout(() => setCopied(null), 1400)
      },
      () => {}
    )
  }

  const players = gameState.players
  const slots = Math.max(0, 4 - players.length)

  return (
    <div className={styles.lobby}>
      <div className={styles.lobbyGrid}>
        <section className={styles.lobbyCard}>
          <div className={cn(styles.lobbyCardHead, arcadeShellStyles.mono)}>
            <span>/ ROOM CODE</span>
          </div>
          <div
            data-testid="room-code"
            className={styles.roomCodeDisplay}
            role="button"
            title="Click to copy"
            onClick={() => copyValue(roomCode, 'code')}
          >
            {roomCode.split('').map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
          <div className={styles.roomShare}>
            <button
              type="button"
              data-testid="invite-link"
              data-invite-link={inviteLink}
              className={cn(styles.roomLinkBtn, arcadeShellStyles.mono)}
              onClick={() => copyValue(inviteLink, 'link')}
            >
              {copied === 'link'
                ? '✓ link copied!'
                : copied === 'code'
                  ? '✓ code copied!'
                  : 'Copy invite link →'}
            </button>
          </div>
        </section>

        <section data-testid="player-roster" className={styles.lobbyCard}>
          <div className={cn(styles.lobbyCardHead, arcadeShellStyles.mono)}>
            <span>/ TABLE · {players.length}/10</span>
            <span className={styles.lobbyCardLive}>● LIVE</span>
          </div>
          <div className={styles.players}>
            {players.map((p, i) => {
              const isYou = p.id === playerId
              const isOnline = onlinePlayerIds.includes(p.id)
              return (
                <div
                  key={p.id}
                  className={cn(
                    styles.player,
                    p.isHost && styles.playerHost,
                    isYou && styles.playerYou
                  )}
                >
                  <span className={styles.playerNum}>{String(i + 1).padStart(2, '0')}</span>
                  <span
                    className={styles.playerAvatar}
                    style={{ background: `oklch(0.7 0.18 ${(i * 47) % 360})` }}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className={styles.playerName}>{p.name}</span>
                  {p.isHost && <span className={styles.playerPill}>HOST</span>}
                  {isYou && !p.isHost && <span className={styles.playerPill}>YOU</span>}
                  {!isOnline && (
                    <span className={cn(styles.playerPill, styles.playerPillGhost)}>OFFLINE</span>
                  )}
                </div>
              )
            })}
            {Array.from({ length: slots }).map((_, i) => (
              <div key={`e${i}`} className={cn(styles.player, styles.playerEmpty)}>
                <span className={styles.playerNum}>
                  {String(players.length + i + 1).padStart(2, '0')}
                </span>
                <span className={cn(styles.playerAvatar, styles.playerAvatarEmpty)} />
                <span className={styles.playerName}>waiting…</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.lobbyCard}>
          <div className={cn(styles.lobbyCardHead, arcadeShellStyles.mono)}>
            <span>/ HOUSE RULES</span>
          </div>
          <div className={styles.settings}>
            <div className={styles.setting}>
              <span className={styles.settingLabel}>STACKING</span>
              <div className={styles.segmented}>
                <button type="button" className={styles.segmentedOn}>
                  ON
                </button>
                <button type="button">OFF</button>
              </div>
            </div>
            <div className={styles.setting}>
              <span className={styles.settingLabel}>DRAW UNTIL PLAY</span>
              <div className={styles.segmented}>
                <button type="button">ON</button>
                <button type="button" className={styles.segmentedOn}>
                  OFF
                </button>
              </div>
            </div>
            <div className={styles.setting}>
              <span className={styles.settingLabel}>TARGET</span>
              <div className={styles.segmented}>
                <button type="button">250</button>
                <button type="button" className={styles.segmentedOn}>
                  500
                </button>
                <button type="button">1000</button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <LobbyActions
        isHost={isHost}
        canStart={gameState.players.length >= 2}
        onLeave={onLeave}
        onStart={onStart}
        leaveLabel="← Leave table"
        startLabel={`Deal ${gameState.players.length} hands →`}
        hostLabel=""
        guestLabel="Waiting for host to deal"
        className={styles.lobbyCta}
        statusClassName={cn(styles.lobbyHostHint, arcadeShellStyles.mono)}
        actionsClassName={styles.entryActions}
        leaveButtonClassName={cn(
          arcadeShellStyles.button,
          arcadeShellStyles.buttonGhost,
          arcadeShellStyles.buttonSmall
        )}
        startButtonClassName={arcadeShellStyles.button}
      />
    </div>
  )
}

// ─── Game board ─────────────────────────────────────────────────────────────

interface GameBoardProps {
  gameState: GameState
  playerId: string
  onlinePlayerIds: string[]
  onDispatch: (cardId: string, chosenColor?: CardColor) => void
  onDraw: () => void
  onPassAfterDraw: () => void
  onSayUno: () => void
  onCatchUno: (targetId: string) => void
  onLeave: () => void
}

const ACTION_TOAST: Partial<Record<CardValue, { msg: string; kind: '' | 'danger' | 'win' }>> = {
  skip: { msg: 'SKIPPED!', kind: 'danger' },
  reverse: { msg: 'REVERSED!', kind: '' },
  draw2: { msg: '+2!', kind: 'danger' },
  wild4: { msg: 'WILD +4!', kind: 'danger' },
}

function GameBoard({
  gameState,
  playerId,
  onlinePlayerIds,
  onDispatch,
  onDraw,
  onPassAfterDraw,
  onSayUno,
  onCatchUno,
  onLeave,
}: GameBoardProps) {
  const [pendingWild, setPendingWild] = useState<string | null>(null)
  const [discardKey, setDiscardKey] = useState(0)
  const [toast, setToast] = useState<{
    msg: string
    kind: '' | 'danger' | 'win'
    k: number
  } | null>(null)
  const prevTopCardRef = useRef<string | null>(null)
  const isFirstRenderRef = useRef(true)

  const me = gameState.players.find((p) => p.id === playerId)
  const currentPlayer = getCurrentPlayer(gameState)
  const isMyTurn = currentPlayer?.id === playerId
  const myHand = gameState.hands[playerId] ?? []
  const topCard = getTopCard(gameState)
  const otherPlayers = gameState.players.filter((p) => p.id !== playerId)
  const hasDrawnCard = gameState.drawnCardId !== null && isMyTurn
  const mustDraw = isMyTurn && gameState.pendingDrawCount > 0

  const topCardId = topCard?.id ?? null
  useEffect(() => {
    if (topCardId !== prevTopCardRef.current) {
      const wasFirst = isFirstRenderRef.current
      isFirstRenderRef.current = false
      prevTopCardRef.current = topCardId

      if (!wasFirst && topCard) {
        setDiscardKey((k) => k + 1)
        const t = ACTION_TOAST[topCard.value]
        if (t) {
          setToast({ msg: t.msg, kind: t.kind, k: Math.random() })
          const timer = window.setTimeout(() => setToast(null), 1400)
          return () => window.clearTimeout(timer)
        }
      }
    }
  }, [topCardId, topCard])

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

  // catch-uno window watcher
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const windows = Object.values(gameState.unoWindow)
    const nextExpiry = windows.filter((w) => w > Date.now()).sort((a, b) => a - b)[0]
    if (!nextExpiry) return
    const delay = nextExpiry - Date.now()
    const timer = window.setTimeout(() => setNow(Date.now()), delay + 50)
    return () => window.clearTimeout(timer)
  }, [gameState.unoWindow])

  const catchableTargets = otherPlayers.filter((p) => {
    const hand = gameState.hands[p.id] ?? []
    const windowUntil = gameState.unoWindow[p.id] ?? 0
    return hand.length === 1 && !gameState.calledUno.includes(p.id) && now >= windowUntil
  })

  const turnLabel = isMyTurn ? 'YOUR TURN' : `${(currentPlayer?.name ?? '').toUpperCase()}'S TURN`
  const directionClass = gameState.direction === 1 ? styles.directionCw : styles.directionCcw
  const calledMyself = gameState.calledUno.includes(playerId)

  const statusText = !isMyTurn
    ? 'wait for your turn'
    : mustDraw
      ? `must take +${gameState.pendingDrawCount}`
      : hasDrawnCard
        ? 'play drawn card or pass'
        : playableIds.size > 0
          ? `${playableIds.size} playable`
          : 'no plays — must draw'

  return (
    <div className={styles.table}>
      {pendingWild && (
        <ColorPicker onPick={handleColorPick} onCancel={() => setPendingWild(null)} />
      )}

      <div className={styles.hud}>
        <div className={styles.hudLeft}>
          <div className={cn(styles.turn, isMyTurn && styles.turnIsMe)}>
            <span className={styles.turnLabel}>{isMyTurn ? '▶ YOU' : '▶'}</span>
            <span className={styles.turnName}>{turnLabel}</span>
          </div>
          <div className={cn(styles.direction, directionClass)}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M 4 10 Q 4 4 10 4 Q 16 4 16 10" />
              <path d="M 14 6 L 16 4 L 18 6" />
            </svg>
            <span>{gameState.direction === 1 ? 'clockwise' : 'reversed'}</span>
          </div>
        </div>

        <div className={styles.hudCenter}>
          <div className={styles.colorPill} data-c={gameState.currentColor}>
            <span>active color</span>
            <span className={styles.colorPillStrong}>{gameState.currentColor}</span>
          </div>
        </div>

        <div className={styles.hudRight}>
          {gameState.pendingDrawCount > 0 && (
            <span className={styles.pending}>
              +{gameState.pendingDrawCount} pending — must draw
            </span>
          )}
          <button
            type="button"
            className={styles.action}
            onClick={onLeave}
            data-testid="leave-room-button"
          >
            Leave
          </button>
        </div>
      </div>

      <div data-testid="uno-status" className="sr-only">
        {isMyTurn ? 'Your turn' : `${currentPlayer?.name ?? '?'}'s turn`}
      </div>

      <div className={styles.felt}>
        <div className={styles.opponents}>
          {otherPlayers.map((p, i) => {
            const hand = gameState.hands[p.id] ?? []
            const isTurn = currentPlayer?.id === p.id
            const calledUno = gameState.calledUno.includes(p.id)
            const isCatchable = catchableTargets.includes(p)
            const isOnline = onlinePlayerIds.includes(p.id)
            const showFlag = hand.length === 1 && calledUno
            return (
              <div key={p.id} className={cn(styles.opponent, isTurn && styles.opponentActive)}>
                <div className={styles.opponentHead}>
                  <span
                    className={styles.opponentAvatar}
                    style={{ background: `oklch(0.7 0.18 ${(i * 47 + 90) % 360})` }}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className={styles.opponentName} title={isOnline ? 'online' : 'offline'}>
                    {p.name}
                  </span>
                  <span className={styles.opponentCount}>{hand.length}</span>
                </div>
                <div className={styles.opponentMiniHand}>
                  {Array.from({ length: Math.min(hand.length, 7) }).map((_, j) => (
                    <div
                      key={j}
                      className={cn(
                        styles.opponentMini,
                        hand.length > 5 && styles.opponentMiniLots
                      )}
                    />
                  ))}
                </div>
                {showFlag && <span className={styles.opponentFlag}>UNO!</span>}
                {isCatchable && (
                  <span
                    role="button"
                    title="Catch them!"
                    className={cn(styles.opponentFlag, styles.opponentFlagCallable)}
                    onClick={() => onCatchUno(p.id)}
                  >
                    CATCH +2
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div className={styles.piles}>
          <div data-testid="uno-draw-pile" className={styles.pile}>
            <span className={styles.pileLabel}>
              Draw {gameState.pendingDrawCount > 0 && `· must take +${gameState.pendingDrawCount}`}
            </span>
            <div
              className={cn(
                styles.drawStack,
                (!isMyTurn || hasDrawnCard) && styles.drawStackDisabled,
                mustDraw && styles.drawStackMustDraw
              )}
              onClick={() => {
                if (!isMyTurn || hasDrawnCard) return
                onDraw()
              }}
              role="button"
            >
              <span className={styles.cardBack} />
              <span className={styles.cardBack} />
              <span className={styles.cardBack} />
            </div>
            <span className={styles.drawCount}>{gameState.drawPile.length} cards</span>
          </div>

          <div data-testid="uno-discard-pile" className={styles.pile}>
            <span className={styles.pileLabel}>discard</span>
            <div className={styles.discard}>
              {topCard && (
                <div key={discardKey} className={styles.pop}>
                  <UnoCard card={topCard} size="lg" />
                </div>
              )}
            </div>
            <span className={styles.drawCount}>{gameState.discardPile.length} cards</span>
          </div>
        </div>

        {toast && (
          <div
            key={toast.k}
            className={cn(
              styles.toast,
              toast.kind === 'danger' && styles.toastDanger,
              toast.kind === 'win' && styles.toastWin
            )}
          >
            {toast.msg}
          </div>
        )}
      </div>

      <div className={styles.handArea}>
        <div className={styles.handMeta}>
          <span>
            <span className={styles.handMetaName}>{me?.name ?? 'You'}</span> ·{' '}
            <span className={styles.handMetaCount}>{myHand.length}</span> cards
          </span>
          <span>{statusText}</span>
          {myHand.length === 2 && !calledMyself && (
            <button
              type="button"
              className={cn(styles.callBtn, styles.callBtnUrgent)}
              onClick={onSayUno}
            >
              UNO!
            </button>
          )}
          {myHand.length === 1 && !calledMyself && (
            <button
              type="button"
              className={cn(styles.callBtn, styles.callBtnUrgent)}
              onClick={onSayUno}
            >
              SAY UNO!
            </button>
          )}
          {myHand.length === 1 && calledMyself && (
            <button type="button" className={cn(styles.callBtn, styles.callBtnConfirmed)} disabled>
              UNO ✓
            </button>
          )}
        </div>

        <div className={styles.hand}>
          {myHand.map((card) => {
            const ok = playableIds.has(card.id)
            const isDrawn = card.id === gameState.drawnCardId
            return (
              <button
                key={card.id}
                type="button"
                data-testid="uno-hand-card"
                className={cn(
                  styles.handCard,
                  ok && styles.handCardPlayable,
                  !ok && styles.handCardUnplayable,
                  isDrawn && styles.handCardDrawn
                )}
                onClick={() => handleCardClick(card)}
              >
                <UnoCard card={card} size="lg" />
              </button>
            )
          })}
        </div>

        {isMyTurn && hasDrawnCard && (
          <div className={styles.handActions}>
            <button
              type="button"
              className={cn(styles.action, styles.actionPrimary)}
              onClick={onPassAfterDraw}
            >
              Keep & pass turn →
            </button>
          </div>
        )}
        {isMyTurn &&
          !hasDrawnCard &&
          playableIds.size === 0 &&
          gameState.pendingDrawCount === 0 && (
            <div className={styles.handActions}>
              <button
                type="button"
                className={cn(styles.action, styles.actionPrimary)}
                onClick={onDraw}
              >
                Draw a card →
              </button>
            </div>
          )}
      </div>
    </div>
  )
}

// ─── Finished screen ────────────────────────────────────────────────────────

function cardScoreValue(card: Card): number {
  if (typeof card.value === 'number') return card.value
  if (card.value === 'skip' || card.value === 'reverse' || card.value === 'draw2') return 20
  return 50
}

interface FinishedScreenProps {
  gameState: GameState
  playerId: string
  onPlayAgain: () => void
  onLeave: () => void
}

function FinishedScreen({ gameState, playerId, onPlayAgain, onLeave }: FinishedScreenProps) {
  const winner: Player | undefined =
    gameState.players.find((p) => p.id === gameState.winnerId) ?? gameState.players[0]
  const isWinner = gameState.winnerId === playerId
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    const t = window.setTimeout(() => setShowConfetti(false), 3000)
    return () => window.clearTimeout(t)
  }, [])

  const winnerScore = useMemo(() => {
    if (!winner) return 0
    return Object.entries(gameState.hands)
      .filter(([id]) => id !== winner.id)
      .reduce((sum, [, hand]) => sum + hand.reduce((a, c) => a + cardScoreValue(c), 0), 0)
  }, [gameState.hands, winner])

  const sortedRows = useMemo(() => {
    const rows = gameState.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      cards: gameState.hands[p.id]?.length ?? 0,
      score: p.id === winner?.id ? winnerScore : 0,
      isWinner: p.id === winner?.id,
    }))
    rows.sort((a, b) => {
      if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1
      return a.cards - b.cards
    })
    return rows
  }, [gameState.players, gameState.hands, winner, winnerScore])

  return (
    <div className={styles.endShell}>
      {isWinner && showConfetti && <ConfettiEffect />}
      <span className={styles.endSub}>/ ROUND OVER · FINAL STANDINGS</span>
      <h2 data-testid="uno-winner-banner" className={styles.endTitle}>
        {isWinner ? 'You win' : `${winner?.name ?? 'Winner'} wins the round`}
      </h2>

      <div className={styles.endBoard}>
        {sortedRows.map((row, i) => (
          <div key={row.id} className={cn(styles.endRow, row.isWinner && styles.endRowWin)}>
            <span className={styles.endRank}>{String(i + 1).padStart(2, '0')}</span>
            <span className={styles.endName}>{row.name}</span>
            <span className={styles.endCardsLeft}>
              {row.cards} card{row.cards === 1 ? '' : 's'} left
            </span>
            <span className={styles.endScore}>+{row.score}</span>
          </div>
        ))}
      </div>

      <div className={styles.endActions}>
        <button
          type="button"
          onClick={onLeave}
          data-testid="leave-room-button"
          className={cn(
            arcadeShellStyles.button,
            arcadeShellStyles.buttonGhost,
            arcadeShellStyles.buttonSmall
          )}
        >
          ← Back to Library
        </button>
        {isHost ? (
          <button type="button" onClick={onPlayAgain} className={arcadeShellStyles.button}>
            Deal again →
          </button>
        ) : (
          <span className={cn(styles.endCountdown, arcadeShellStyles.mono)}>waiting for host</span>
        )}
      </div>
    </div>
  )
}

function ConfettiEffect() {
  const [particles] = useState(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 1.5,
      color: ['#e53935', '#fdd835', '#43a047', '#1e88e5'][i % 4],
      size: 4 + Math.random() * 6,
    }))
  )

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
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

export function UnoGame() {
  const inviteCode = useInviteCode()
  const inviteCodeResolved = inviteCode !== undefined
  const [entryMode, setEntryMode] = useState<'howto' | 'entry'>(
    process.env.NEXT_PUBLIC_E2E_FAKE_SUPABASE === '1' ? 'entry' : 'howto'
  )
  const {
    gameState,
    playerId,
    roomCode,
    status,
    error,
    connectionStatus,
    savedSession,
    onlinePlayerIds,
    createRoom,
    joinRoom,
    restoreSession,
    dispatch,
    leaveRoom,
  } = useUnoRoom()

  useEffect(() => {
    if (inviteCode) setEntryMode('entry')
  }, [inviteCode])

  const redactedState = useMemo(
    () => (gameState && playerId ? redactForPlayer(gameState, playerId) : gameState),
    [gameState, playerId]
  )

  const crumb = makeCrumb(gameState, roomCode, playerId, inviteCode)
  const isLoading = status === 'creating' || status === 'joining' || status === 'restoring'
  const isEntryState = !gameState || !playerId || !roomCode
  const isResolvingInvite = isEntryState && !inviteCodeResolved
  const inGame = !isEntryState && gameState.phase === 'playing'

  const handleCreate = useCallback((name: string) => void createRoom(name), [createRoom])
  const handleJoin = useCallback(
    (code: string, name: string) => void joinRoom(code, name),
    [joinRoom]
  )
  const handleLeave = useCallback(() => void leaveRoom(), [leaveRoom])

  return (
    <ArcadeShell title="Uno" crumb={crumb} centered={!inGame}>
      <UnoStyles />
      {!isEntryState && <DesyncIndicator active={connectionStatus === 'desynced'} />}
      {!isSupabaseConfigured ? (
        <SetupRequired />
      ) : isResolvingInvite ? (
        <InviteResolvingScreen />
      ) : isEntryState ? (
        entryMode === 'howto' ? (
          <HowToScreen onStart={() => setEntryMode('entry')} />
        ) : (
          <EntryScreen
            onCreate={handleCreate}
            onJoin={handleJoin}
            onRestore={savedSession ? () => void restoreSession() : undefined}
            savedSession={savedSession}
            loading={isLoading}
            error={error}
            initialCode={inviteCode ?? null}
            onBackToHowTo={!inviteCode ? () => setEntryMode('howto') : undefined}
          />
        )
      ) : gameState.phase === 'finished' ? (
        <FinishedScreen
          gameState={gameState}
          playerId={playerId}
          onPlayAgain={() => void dispatch({ type: 'PLAY_AGAIN', playerId })}
          onLeave={handleLeave}
        />
      ) : gameState.phase === 'lobby' ? (
        <LobbyScreen
          gameState={gameState}
          playerId={playerId}
          roomCode={roomCode}
          onlinePlayerIds={onlinePlayerIds}
          onStart={() => void dispatch({ type: 'START_GAME', playerId })}
          onLeave={handleLeave}
        />
      ) : (
        <GameBoard
          gameState={redactedState!}
          playerId={playerId}
          onlinePlayerIds={onlinePlayerIds}
          onDispatch={(cardId, chosenColor) =>
            void dispatch({ type: 'PLAY_CARD', playerId, cardId, chosenColor, now: Date.now() })
          }
          onDraw={() => void dispatch({ type: 'DRAW_CARD', playerId })}
          onPassAfterDraw={() => void dispatch({ type: 'PASS_AFTER_DRAW', playerId })}
          onSayUno={() => void dispatch({ type: 'SAY_UNO', playerId })}
          onCatchUno={(targetId) =>
            void dispatch({ type: 'CATCH_UNO', playerId, targetId, now: Date.now() })
          }
          onLeave={handleLeave}
        />
      )}
    </ArcadeShell>
  )
}
