'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, PencilLine, Trash2, Undo2 } from 'lucide-react'
import { useInviteCode, getInviteLink } from '@/hooks/useInviteCode'
import { getSavedPlayerName, savePlayerName } from '@/lib/player-name'
import { isSupabaseConfigured } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { ArcadeAvatar } from '@/components/multiplayer/ArcadeAvatar'
import { ArcadeShell, arcadeShellStyles } from '@/components/multiplayer/ArcadeShell'
import { AvatarPicker } from '@/components/multiplayer/AvatarPicker'
import { LobbyActions } from '@/components/multiplayer/LobbyActions'
import { PlayerRoster } from '@/components/multiplayer/PlayerRoster'
import { ResultsTable } from '@/components/multiplayer/ResultsTable'
import { ResumeSessionCard } from '@/components/multiplayer/ResumeSessionCard'
import { RoomInviteCard } from '@/components/multiplayer/RoomInviteCard'
import { useSkribblRoom, type UseSkribblRoomReturn } from './useSkribblRoom'
import {
  decodeWord,
  getCurrentDrawer,
  type DrawPoint,
  type DrawStroke,
  type GameAction,
  type GameState,
} from './logic'
import styles from './SkribblGame.module.css'

const COLORS = [
  '#000000',
  '#555555',
  '#888888',
  '#c5c5c5',
  '#ffffff',
  '#7a1b1b',
  '#e53935',
  '#fb8c00',
  '#fdd835',
  '#ffee58',
  '#2e7d32',
  '#66bb6a',
  '#00acc1',
  '#1e88e5',
  '#3949ab',
  '#8e24aa',
  '#d81b60',
  '#f06292',
  '#8d6e63',
  '#5d4037',
]

const BRUSH_SIZES = [3, 6, 12, 22]
const WORD_PICKER_SECONDS = 15
const ROUND_END_DELAY = 5
const AVATAR_STORAGE_KEY = 'library-games:skribbl-avatar'

function getSavedAvatar(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = Number(localStorage.getItem(AVATAR_STORAGE_KEY) ?? '0')
    if (Number.isInteger(raw) && raw >= 0 && raw <= 7) return raw
  } catch {}
  return 0
}

function saveAvatar(index: number) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AVATAR_STORAGE_KEY, String(index))
  } catch {}
}

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

  const drawer = getCurrentDrawer(gameState)
  const isMyTurn = drawer?.id === playerId

  if (gameState.phase === 'lobby') {
    return (
      <>
        / Lobby · <span className={arcadeShellStyles.crumbAccent}>{roomCode}</span>
      </>
    )
  }

  if (gameState.phase === 'picking') {
    return (
      <>
        / Round {gameState.round} ·{' '}
        <span className={arcadeShellStyles.crumbAccent}>
          {isMyTurn ? 'Your turn' : `${drawer?.name ?? 'Player'} picking`}
        </span>
      </>
    )
  }

  if (gameState.phase === 'drawing') {
    return (
      <>
        / Round {gameState.round} · <span className={arcadeShellStyles.crumbAccent}>Drawing</span>
      </>
    )
  }

  if (gameState.phase === 'round-end') {
    return (
      <>
        / Round {gameState.round} · <span className={arcadeShellStyles.crumbAccent}>Reveal</span>
      </>
    )
  }

  return (
    <>
      / <span className={arcadeShellStyles.crumbAccent}>Game over</span>
    </>
  )
}

function TimerRing({
  startTime,
  duration,
  onTimeUp,
}: {
  startTime: number
  duration: number
  onTimeUp: () => void
}) {
  const [remaining, setRemaining] = useState(duration)
  const firedRef = useRef(false)

  useEffect(() => {
    firedRef.current = false

    const tick = () => {
      const left = Math.max(0, duration - (Date.now() - startTime) / 1000)
      setRemaining(Math.ceil(left))
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true
        onTimeUp()
      }
    }

    tick()
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [duration, onTimeUp, startTime])

  const progress = Math.max(0, Math.min(1, remaining / duration))
  const circumference = 2 * Math.PI * 18
  const dashOffset = circumference * (1 - progress)
  const numberClassName = cn(
    styles.timerNumber,
    remaining <= 10 && styles.timerCrit,
    remaining > 10 && remaining <= 25 && styles.timerWarn
  )
  const strokeColor =
    remaining <= 10
      ? 'var(--arcade-danger)'
      : remaining <= 25
        ? 'var(--arcade-amber)'
        : 'var(--arcade-accent)'

  return (
    <div className={styles.timer}>
      <svg viewBox="0 0 44 44" className={styles.timerRing}>
        <circle cx="22" cy="22" r="18" fill="none" stroke="var(--arcade-line)" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke={strokeColor}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 22 22)"
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 250ms linear' }}
        />
      </svg>
      <span className={numberClassName}>{remaining}</span>
      <span className={arcadeShellStyles.mono}>s</span>
    </div>
  )
}

function DrawingCanvas({
  strokes,
  isDrawer,
  color,
  size,
  tool,
  onStrokeComplete,
}: {
  strokes: DrawStroke[]
  isDrawer: boolean
  color: string
  size: number
  tool: 'pen' | 'eraser'
  onStrokeComplete: (stroke: DrawStroke) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const currentStrokeRef = useRef<DrawPoint[]>([])

  const redraw = useCallback(
    (preview?: DrawPoint[]) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const allStrokes = preview && preview.length > 0 ? [...strokes, { points: preview }] : strokes

      for (const stroke of allStrokes) {
        if (stroke.points.length === 0) continue

        ctx.beginPath()
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        const first = stroke.points[0]
        ctx.strokeStyle = first.tool === 'eraser' ? '#ffffff' : first.color
        ctx.lineWidth = first.size
        ctx.moveTo(first.x, first.y)

        for (let index = 1; index < stroke.points.length; index += 1) {
          ctx.lineTo(stroke.points[index].x, stroke.points[index].y)
        }

        if (stroke.points.length === 1) {
          ctx.lineTo(first.x + 0.1, first.y + 0.1)
        }

        ctx.stroke()
      }
    },
    [strokes]
  )

  useEffect(() => {
    redraw()
  }, [redraw])

  function getPosition(
    event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const point = 'touches' in event ? event.touches[0] || event.changedTouches[0] : event

    return {
      x: (point.clientX - rect.left) * scaleX,
      y: (point.clientY - rect.top) * scaleY,
    }
  }

  function startStroke(
    event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    if (!isDrawer) return
    event.preventDefault()

    const position = getPosition(event)
    if (!position) return

    drawingRef.current = true
    currentStrokeRef.current = [{ ...position, color, size, tool }]
    redraw(currentStrokeRef.current)
  }

  function moveStroke(
    event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    if (!isDrawer || !drawingRef.current) return
    event.preventDefault()

    const position = getPosition(event)
    if (!position) return

    currentStrokeRef.current.push({ ...position, color, size, tool })
    redraw(currentStrokeRef.current)
  }

  function endStroke() {
    if (!isDrawer || !drawingRef.current) return

    drawingRef.current = false
    if (currentStrokeRef.current.length > 0) {
      onStrokeComplete({ points: currentStrokeRef.current })
      currentStrokeRef.current = []
    }
  }

  return (
    <div className={cn(styles.canvasSurface, !isDrawer && styles.canvasReadOnly)}>
      <canvas
        data-testid="skribbl-canvas"
        ref={canvasRef}
        width={800}
        height={560}
        onMouseDown={startStroke}
        onMouseMove={moveStroke}
        onMouseUp={endStroke}
        onMouseLeave={endStroke}
        onTouchStart={startStroke}
        onTouchMove={moveStroke}
        onTouchEnd={endStroke}
      />
      <span className={cn(styles.canvasWatermark, arcadeShellStyles.mono)}>
        Library Games · Skribbl
      </span>
    </div>
  )
}

function Scoreboard({
  players,
  currentDrawerId,
  guessedPlayers,
  playerId,
  onlinePlayerIds,
  scoreDeltas,
}: {
  players: GameState['players']
  currentDrawerId: string | null
  guessedPlayers: string[]
  playerId: string
  onlinePlayerIds: string[]
  scoreDeltas: GameState['scoreDeltas']
}) {
  const sortedPlayers = [...players].sort((left, right) => right.score - left.score)

  return (
    <aside className={styles.scoreboard}>
      <div className={cn(styles.scoreHead, arcadeShellStyles.mono)}>
        <span>Scoreboard</span>
        <span>{players.length} players</span>
      </div>
      <div className={styles.scoreRows}>
        {sortedPlayers.map((player, index) => {
          const isDrawer = player.id === currentDrawerId
          const hasGuessed = guessedPlayers.includes(player.id)
          const isYou = player.id === playerId
          const isOnline = onlinePlayerIds.includes(player.id)
          const delta = scoreDeltas[player.id]

          return (
            <div
              key={player.id}
              className={cn(
                styles.scoreRow,
                isYou && styles.scoreRowYou,
                isDrawer && styles.scoreRowDrawer,
                hasGuessed && styles.scoreRowGuessed
              )}
            >
              <span className={cn(styles.scoreRank, arcadeShellStyles.mono)}>{index + 1}</span>
              <div className={styles.playerAvatar}>
                <ArcadeAvatar index={player.avatar} size={24} />
              </div>
              <div className={styles.scoreName}>
                <span>{player.name}</span>
                {player.isHost && <span className={styles.scoreBadge}>host</span>}
                {isDrawer && <span className={styles.scoreBadge}>draw</span>}
                {hasGuessed && !isDrawer && <span className={styles.scoreBadge}>guessed</span>}
                {!isOnline && <span className={styles.scoreBadge}>away</span>}
              </div>
              <span className={styles.scoreValue}>{player.score}</span>
              {typeof delta === 'number' && delta > 0 && (
                <span className={styles.scoreDelta}>+{delta}</span>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function ChatPanel({
  messages,
  isDrawer,
  hasGuessed,
  onGuess,
}: {
  messages: GameState['messages']
  isDrawer: boolean
  hasGuessed: boolean
  onGuess: (text: string) => void
}) {
  const [input, setInput] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!logRef.current) return
    logRef.current.scrollTop = logRef.current.scrollHeight
  }, [messages.length])

  const canGuess = !isDrawer && !hasGuessed

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canGuess || !input.trim()) return
    onGuess(input.trim())
    setInput('')
  }

  return (
    <section className={styles.chat}>
      <div className={cn(styles.scoreHead, arcadeShellStyles.mono)}>
        <span>Guesses</span>
        <span>live</span>
      </div>

      <div ref={logRef} className={styles.chatLog}>
        {messages.length === 0 && (
          <div className={cn(styles.message, styles.messageSystem)}>
            {isDrawer ? 'Players will guess here' : 'Type your guess below'}
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              styles.message,
              message.isSystem && styles.messageSystem,
              message.isCorrect && styles.messageCorrect,
              message.isClose && !message.isSystem && styles.messageClose
            )}
          >
            {!message.isSystem && <span className={styles.messageName}>{message.playerName}:</span>}
            <span>{message.text}</span>
          </div>
        ))}
      </div>

      <form className={styles.chatForm} onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={!canGuess}
          maxLength={50}
          placeholder={
            isDrawer ? "You're drawing!" : hasGuessed ? 'Already guessed ✓' : 'Your guess...'
          }
          className={styles.chatInput}
        />
        <button type="submit" disabled={!canGuess || !input.trim()} className={styles.chatSend}>
          Send
        </button>
      </form>
    </section>
  )
}

function SetupRequired() {
  return (
    <div className={styles.setup}>
      <div className="mb-4 text-5xl">🔧</div>
      <h2 className="text-3xl font-extrabold tracking-tight">Supabase setup required</h2>
      <p className="mt-3">
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

function HowToScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroLeft}>
        <span className={cn(styles.tag, arcadeShellStyles.mono)}>Multiplayer · 2-8 players</span>
        <h1 className={styles.heroTitle}>
          Draw it.
          <br />
          Guess it.
          <br />
          <span className={styles.heroTitleAccent}>Lose it.</span>
        </h1>
        <p className={styles.heroCopy}>
          One player sketches a word against the clock while everyone else races to guess it in
          chat. Faster guesses, more points. Three rounds, one winner.
        </p>
        <div className={styles.heroActions}>
          <button type="button" onClick={onStart} className={arcadeShellStyles.button}>
            Play now →
          </button>
          <span className={cn(styles.heroMeta, arcadeShellStyles.mono)}>
            80s · 3 rounds · avg game ~8 min
          </span>
        </div>
      </div>

      <div className={styles.steps}>
        {[
          {
            number: '01 · Join',
            title: 'Grab a room',
            copy: 'Host a private room or drop into an invite code from a friend.',
            icon: (
              <svg
                viewBox="0 0 32 32"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="4" y="8" width="24" height="18" rx="1" />
                <path d="M 10 4 L 10 12 M 22 4 L 22 12" />
              </svg>
            ),
          },
          {
            number: '02 · Draw',
            title: 'Pick & sketch',
            copy: 'Choose from three words. You get 80 seconds. No letters, no numbers.',
            accent: true,
            icon: (
              <svg
                viewBox="0 0 32 32"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M 4 26 L 10 24 L 24 10 L 22 8 L 8 22 Z" />
                <path d="M 18 12 L 20 14" />
              </svg>
            ),
          },
          {
            number: '03 · Guess',
            title: 'Type in chat',
            copy: 'Early guesses score more. Hints reveal as the clock drops.',
            icon: (
              <svg
                viewBox="0 0 32 32"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M 6 10 L 26 10 L 24 22 L 12 22 L 6 26 Z" />
              </svg>
            ),
          },
          {
            number: '04 · Win',
            title: 'Rack up points',
            copy: 'After 3 rounds, top scorer takes the crown. Drawers earn on every guess too.',
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
                <path d="M 10 8 L 6 8 L 6 12 Q 6 14 10 14 M 22 8 L 26 8 L 26 12 Q 26 14 22 14" />
              </svg>
            ),
          },
        ].map((step) => (
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

function EntryScreen({
  error,
  initialCode,
  loading,
  onBackToHowTo,
  onCreate,
  onJoin,
  onRestore,
  savedSession,
}: {
  error: string | null
  initialCode: string | null
  loading: boolean
  onBackToHowTo?: () => void
  onCreate: (name: string, avatar: number) => void
  onJoin: (code: string, name: string, avatar: number) => void
  onRestore: () => void
  savedSession: UseSkribblRoomReturn['savedSession']
}) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(initialCode ? 'join' : 'choose')
  const [name, setName] = useState(getSavedPlayerName)
  const [avatar, setAvatar] = useState(getSavedAvatar)
  const [code, setCode] = useState(initialCode ?? '')

  useEffect(() => {
    if (!initialCode) return
    setMode('join')
    setCode(initialCode)
  }, [initialCode])

  const canSubmit = name.trim().length >= 2 && (mode === 'create' || code.trim().length >= 4)

  function submit() {
    if (!canSubmit) return

    const trimmedName = name.trim()
    savePlayerName(trimmedName)
    saveAvatar(avatar)

    if (mode === 'create') {
      onCreate(trimmedName, avatar)
      return
    }

    onJoin(code.trim().toUpperCase(), trimmedName, avatar)
  }

  if (mode === 'choose') {
    return (
      <div className={styles.entryShell}>
        <div className={styles.entryHead}>
          <h2>Ready to play?</h2>
          <p>Host a new room or jump into a friend&apos;s game with a code.</p>
        </div>

        {savedSession && (
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
            <div className={styles.entryCardTitle}>Create Room</div>
            <div className={cn(styles.entryCardCopy, arcadeShellStyles.mono)}>
              Host a private game
            </div>
          </button>

          <button
            type="button"
            data-testid="join-room-button"
            className={styles.entryCard}
            onClick={() => setMode('join')}
          >
            <div className={styles.entryCardTitle}>Join Room</div>
            <div className={cn(styles.entryCardCopy, arcadeShellStyles.mono)}>
              Enter a 4-char code
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
              ← Back to how it works
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.entryShell}>
      <div className={styles.entryHead}>
        <h2>{mode === 'create' ? 'Create a room' : 'Join a room'}</h2>
        <p>{mode === 'create' ? "You'll be the host." : 'Ask the host for the room code.'}</p>
      </div>

      <div className={styles.entryForm}>
        {error && (
          <div data-testid="room-error" className={styles.error}>
            {error}
          </div>
        )}

        <label className={styles.field}>
          <span className={cn(styles.label, arcadeShellStyles.mono)}>Your name</span>
          <input
            data-testid="player-name-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={16}
            placeholder="e.g. Marble"
            className={arcadeShellStyles.input}
          />
        </label>

        <div className={styles.field}>
          <span className={cn(styles.label, arcadeShellStyles.mono)}>Pick an avatar</span>
          <AvatarPicker
            selectedIndex={avatar}
            onSelect={setAvatar}
            className={styles.avatarGrid}
            buttonClassName={styles.avatarButton}
            selectedButtonClassName={styles.avatarButtonActive}
          />
        </div>

        {mode === 'join' && (
          <label className={styles.field}>
            <span className={cn(styles.label, arcadeShellStyles.mono)}>Room code</span>
            <input
              data-testid="room-code-input"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
              }
              maxLength={4}
              placeholder="AB23"
              className={cn(arcadeShellStyles.input, styles.codeInput)}
            />
          </label>
        )}

        <div className={styles.entryActions}>
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
            data-testid={mode === 'create' ? 'create-room-button' : 'join-room-button'}
            onClick={submit}
            disabled={loading || !canSubmit}
            className={arcadeShellStyles.button}
          >
            {loading ? 'Connecting...' : mode === 'create' ? 'Create room' : 'Join room'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LobbyScreen({
  gameState,
  onlinePlayerIds,
  playerId,
  roomCode,
  onLeave,
  onRemovePlayer,
  onStart,
  onUpdateSettings,
}: {
  gameState: GameState
  onlinePlayerIds: string[]
  playerId: string
  roomCode: string
  onLeave: () => void
  onRemovePlayer: (targetPlayerId: string) => void
  onStart: () => void
  onUpdateSettings: (settings: { totalRounds?: number; turnDuration?: number }) => void
}) {
  const isHost = gameState.players.find((player) => player.id === playerId)?.isHost ?? false
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  function copyValue(value: string, kind: 'code' | 'link') {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(kind)
        window.setTimeout(() => setCopied(null), 1800)
      },
      () => {}
    )
  }

  return (
    <div className={styles.lobby}>
      <RoomInviteCard
        roomCode={roomCode}
        inviteLink={getInviteLink('skribbl', roomCode)}
        copied={copied}
        onCopy={copyValue}
        className={styles.roomCard}
        titleClassName={cn(styles.roomLabel, arcadeShellStyles.mono)}
        roomCodeClassName={styles.roomCode}
        actionsClassName={styles.roomActions}
        actionClassName={cn(styles.roomAction, arcadeShellStyles.mono)}
        metaClassName={cn(styles.roomMeta, arcadeShellStyles.mono)}
      />

      <div className={styles.lobbySide}>
        <PlayerRoster
          players={gameState.players}
          currentPlayerId={playerId}
          onlinePlayerIds={onlinePlayerIds}
          maxPlayers={8}
          currentPlayerIsHost={isHost}
          onRemovePlayer={onRemovePlayer}
          className={styles.playersPanel}
          headerClassName={cn(styles.panelHead, arcadeShellStyles.mono)}
          listClassName={styles.playerList}
          rowClassName={styles.playerRow}
          currentPlayerRowClassName={styles.playerRowYou}
          avatarClassName={styles.playerAvatar}
          infoClassName={styles.playerInfo}
          nameClassName={styles.playerName}
          metaClassName={styles.playerMeta}
          tagsClassName={styles.playerTags}
          tagClassName={styles.playerTag}
          hostTagClassName={styles.playerTagHost}
          removeButtonClassName={styles.playerRemove}
        />

        <section className={styles.settingsPanel}>
          <div className={styles.settingsRow}>
            <span className={cn(styles.label, arcadeShellStyles.mono)}>Rounds</span>
            <div className={styles.pillGroup}>
              {[2, 3, 5].map((roundCount) => (
                <button
                  key={roundCount}
                  type="button"
                  disabled={!isHost}
                  onClick={() => onUpdateSettings({ totalRounds: roundCount })}
                  className={cn(
                    styles.pill,
                    gameState.totalRounds === roundCount && styles.pillActive
                  )}
                >
                  {roundCount}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.settingsRow}>
            <span className={cn(styles.label, arcadeShellStyles.mono)}>Turn</span>
            <div className={styles.pillGroup}>
              {[60, 80, 120].map((turnDuration) => (
                <button
                  key={turnDuration}
                  type="button"
                  disabled={!isHost}
                  onClick={() => onUpdateSettings({ turnDuration })}
                  className={cn(
                    styles.pill,
                    gameState.turnDuration === turnDuration && styles.pillActive
                  )}
                >
                  {turnDuration}s
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <LobbyActions
        isHost={isHost}
        canStart={gameState.players.length >= 2}
        onLeave={onLeave}
        onStart={onStart}
        className={styles.lobbyFooter}
        statusClassName={cn(styles.waiting, arcadeShellStyles.mono)}
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

function WordPickerScreen({ words, onPick }: { words: string[]; onPick: (word: string) => void }) {
  const [remaining, setRemaining] = useState(WORD_PICKER_SECONDS)
  const firedRef = useRef(false)

  useEffect(() => {
    firedRef.current = false
    const startedAt = Date.now()

    const interval = window.setInterval(() => {
      const left = Math.max(0, WORD_PICKER_SECONDS - (Date.now() - startedAt) / 1000)
      setRemaining(Math.ceil(left))

      if (left <= 0 && !firedRef.current) {
        firedRef.current = true
        const randomWord = words[Math.floor(Math.random() * words.length)]
        onPick(randomWord)
      }
    }, 120)

    return () => window.clearInterval(interval)
  }, [onPick, words])

  const progress = Math.max(0, (remaining / WORD_PICKER_SECONDS) * 100)

  return (
    <div className={styles.pickerShell}>
      <div className={styles.pickerHead}>
        <p className={cn(styles.label, arcadeShellStyles.mono)}>Your turn · choose a word</p>
        <h2>Pick your poison</h2>
        <p className={cn(styles.label, arcadeShellStyles.mono)}>Auto-picks in {remaining}s</p>
      </div>

      <div className={styles.pickerTimer}>
        <div className={styles.pickerTimerBar} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.pickerGrid}>
        {words.map((word, index) => {
          const plainWord = decodeWord(word)
          const difficulty = index + 1
          return (
            <button
              key={word}
              type="button"
              className={styles.wordCard}
              onClick={() => onPick(word)}
            >
              <span className={cn(styles.wordIndex, arcadeShellStyles.mono)}>
                0{index + 1} / 03
              </span>
              <span className={styles.wordDifficulty}>
                {[1, 2, 3].map((value) => (
                  <span
                    key={value}
                    className={cn(styles.wordDot, value <= difficulty && styles.wordDotActive)}
                  />
                ))}
              </span>
              <span className={styles.wordText}>{plainWord}</span>
              <span className={styles.wordHint}>
                {plainWord
                  .split('')
                  .map((character, characterIndex) =>
                    character === ' ' ? (
                      <span key={characterIndex} className={styles.wordHintSpace} />
                    ) : (
                      <span key={characterIndex} className={styles.wordHintBox} />
                    )
                  )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WaitingPickerScreen({ drawerName }: { drawerName: string }) {
  return (
    <div className={styles.pickerShell}>
      <div className={styles.pickerHead}>
        <p className={cn(styles.label, arcadeShellStyles.mono)}>{drawerName} is choosing</p>
        <h2>Hang tight...</h2>
        <p>A word is being picked for the next sketch.</p>
      </div>
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className={styles.skeletonCard}>
            <div className={styles.skeletonBar} style={{ animationDelay: `${index * 180}ms` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function RoundEndScreen({
  gameState,
  playerId,
  onLeave,
  onNext,
}: {
  gameState: GameState
  playerId: string
  onLeave: () => void
  onNext: () => void
}) {
  const isHost = gameState.players.find((player) => player.id === playerId)?.isHost ?? false
  const [countdown, setCountdown] = useState(ROUND_END_DELAY)
  const firedRef = useRef(false)
  const drawer = getCurrentDrawer(gameState)
  const allGuessed =
    gameState.players.length > 1 && gameState.guessedPlayers.length >= gameState.players.length - 1
  const sortedPlayers = [...gameState.players].sort((left, right) => right.score - left.score)

  useEffect(() => {
    firedRef.current = false
    setCountdown(ROUND_END_DELAY)

    const interval = window.setInterval(() => {
      setCountdown((current) => {
        const nextValue = Math.max(0, current - 1)
        if (nextValue === 0 && isHost && !firedRef.current) {
          firedRef.current = true
          onNext()
        }
        return nextValue
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isHost, onNext])

  return (
    <div className={styles.endShell}>
      <p className={cn(styles.endMeta, arcadeShellStyles.mono)}>
        Round {gameState.round} of {gameState.totalRounds} · {drawer?.name ?? 'Player'} was drawing
      </p>
      <h2 className={styles.endTitle}>{allGuessed ? 'Everyone got it!' : "Time's up"}</h2>
      <p className={styles.endWord}>
        The word was{' '}
        <span className={styles.endWordAccent}>{decodeWord(gameState.word ?? '')}</span>
      </p>

      <ResultsTable
        rows={sortedPlayers.map((player, index) => ({
          id: player.id,
          rankLabel: index + 1,
          name: player.name,
          avatar: player.avatar,
          secondaryLabel: gameState.scoreDeltas[player.id]
            ? `+${gameState.scoreDeltas[player.id]}`
            : '—',
          totalLabel: player.score,
        }))}
        className={styles.resultsTable}
        rowClassName={styles.resultRow}
        rankClassName={cn(styles.resultTotal, arcadeShellStyles.mono)}
        playerClassName={styles.resultPlayer}
        secondaryClassName={styles.resultDelta}
        totalClassName={styles.resultTotal}
      />

      <div className={styles.endActions}>
        <button
          type="button"
          onClick={onLeave}
          className={cn(
            arcadeShellStyles.button,
            arcadeShellStyles.buttonGhost,
            arcadeShellStyles.buttonSmall
          )}
        >
          Leave
        </button>
        {isHost ? (
          <button type="button" onClick={onNext} className={arcadeShellStyles.button}>
            Next turn →
          </button>
        ) : null}
        <span className={cn(styles.endCountdown, arcadeShellStyles.mono)}>
          auto in {countdown}s
        </span>
      </div>
    </div>
  )
}

function FinishedScreen({
  gameState,
  playerId,
  onLeave,
  onPlayAgain,
}: {
  gameState: GameState
  playerId: string
  onLeave: () => void
  onPlayAgain: () => void
}) {
  const isHost = gameState.players.find((player) => player.id === playerId)?.isHost ?? false
  const sortedPlayers = [...gameState.players].sort((left, right) => right.score - left.score)
  const winner = sortedPlayers[0]
  const isWinner = winner?.id === playerId

  return (
    <div className={styles.endShell}>
      <p className={cn(styles.endMeta, arcadeShellStyles.mono)}>Game over · final standings</p>
      <h2 className={styles.endTitle}>
        {isWinner ? 'You win' : `${winner?.name ?? 'Winner'} wins`}
      </h2>
      <p className={styles.endWord}>
        with <span className={styles.endWordAccent}>{winner?.score ?? 0}</span> points
      </p>

      <ResultsTable
        rows={sortedPlayers.map((player, index) => ({
          id: player.id,
          rankLabel: index === 0 ? '👑' : index + 1,
          name: player.name,
          avatar: player.avatar,
          secondaryLabel: index === 0 ? 'Winner' : '',
          totalLabel: player.score,
          isWinner: index === 0,
        }))}
        className={styles.resultsTable}
        rowClassName={styles.resultRow}
        winnerRowClassName={styles.resultRowWinner}
        rankClassName={cn(styles.resultTotal, arcadeShellStyles.mono)}
        playerClassName={styles.resultPlayer}
        secondaryClassName={styles.resultDelta}
        totalClassName={styles.resultTotal}
      />

      <div className={styles.endActions}>
        <button
          type="button"
          onClick={onLeave}
          className={cn(
            arcadeShellStyles.button,
            arcadeShellStyles.buttonGhost,
            arcadeShellStyles.buttonSmall
          )}
        >
          Back to library
        </button>
        {isHost ? (
          <button type="button" onClick={onPlayAgain} className={arcadeShellStyles.button}>
            Play again
          </button>
        ) : (
          <span className={cn(styles.endCountdown, arcadeShellStyles.mono)}>waiting for host</span>
        )}
      </div>
    </div>
  )
}

function GameBoardScreen({
  gameState,
  onlinePlayerIds,
  playerId,
  onAction,
  onLeave,
}: {
  gameState: GameState
  onlinePlayerIds: string[]
  playerId: string
  onAction: (action: GameAction) => void
  onLeave: () => void
}) {
  const [color, setColor] = useState('#000000')
  const [size, setSize] = useState(6)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')

  const drawer = getCurrentDrawer(gameState)
  const isDrawer = drawer?.id === playerId
  const hasGuessed = gameState.guessedPlayers.includes(playerId)
  const plainWord = decodeWord(gameState.word ?? '')

  useEffect(() => {
    if (!isDrawer || gameState.phase !== 'drawing' || !gameState.drawStartTime) return

    const elapsed = Date.now() - gameState.drawStartTime
    const halfDelay = gameState.turnDuration * 1000 * 0.5 - elapsed
    const lateDelay = gameState.turnDuration * 1000 * 0.75 - elapsed
    const timers: number[] = []

    if (halfDelay > 0) {
      timers.push(
        window.setTimeout(() => {
          onAction({ type: 'REVEAL_HINT', playerId, ratio: 0.5 })
        }, halfDelay)
      )
    }

    if (lateDelay > 0) {
      timers.push(
        window.setTimeout(() => {
          onAction({ type: 'REVEAL_HINT', playerId, ratio: 0.75 })
        }, lateDelay)
      )
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [
    gameState.drawStartTime,
    gameState.phase,
    gameState.turnDuration,
    isDrawer,
    onAction,
    playerId,
  ])

  return (
    <div className={styles.board}>
      <div className={styles.hud}>
        <div className={styles.hudSection}>
          <div className={styles.roundBlock}>
            <span className={cn(styles.roundLabel, arcadeShellStyles.mono)}>Round</span>
            <span className={styles.roundValue}>
              {gameState.round}
              <span className="text-sm font-normal text-[var(--arcade-ink-mute)]">
                {' '}
                / {gameState.totalRounds}
              </span>
            </span>
          </div>
          <div className={styles.roundBlock}>
            <span className={cn(styles.roundLabel, arcadeShellStyles.mono)}>Drawer</span>
            <span className={styles.roundValue}>{drawer?.name}</span>
          </div>
        </div>

        <div className={cn(styles.hudSection, styles.hudSectionCenter)}>
          {isDrawer ? (
            <div className={styles.hintDrawer}>
              <span className={cn(styles.hintLabel, arcadeShellStyles.mono)}>Draw this</span>
              <span className={styles.hintWord}>{plainWord}</span>
            </div>
          ) : (
            <div className={styles.hintDrawer}>
              <span className={cn(styles.hintLabel, arcadeShellStyles.mono)}>
                {plainWord.length} letters · {plainWord.replace(/ /g, '').length} chars
              </span>
              <span className={styles.hintMask}>{gameState.hint}</span>
            </div>
          )}
        </div>

        <div className={cn(styles.hudSection, styles.hudSectionRight)}>
          {gameState.drawStartTime && (
            <TimerRing
              startTime={gameState.drawStartTime}
              duration={gameState.turnDuration}
              onTimeUp={() => onAction({ type: 'END_TURN', playerId })}
            />
          )}
          <button
            type="button"
            onClick={onLeave}
            className={cn(
              arcadeShellStyles.button,
              arcadeShellStyles.buttonGhost,
              arcadeShellStyles.buttonSmall
            )}
          >
            Leave
          </button>
        </div>
      </div>

      <Scoreboard
        players={gameState.players}
        currentDrawerId={drawer?.id ?? null}
        guessedPlayers={gameState.guessedPlayers}
        playerId={playerId}
        onlinePlayerIds={onlinePlayerIds}
        scoreDeltas={gameState.scoreDeltas}
      />

      <div className={styles.canvasColumn}>
        <DrawingCanvas
          strokes={gameState.strokes}
          isDrawer={isDrawer}
          color={tool === 'eraser' ? '#ffffff' : color}
          size={size}
          tool={tool}
          onStrokeComplete={(stroke) => onAction({ type: 'ADD_STROKE', playerId, stroke })}
        />

        {isDrawer ? (
          <div className={styles.toolbar}>
            <div className={styles.toolGroup}>
              <span className={cn(styles.toolLabel, arcadeShellStyles.mono)}>Colors</span>
              {COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  title={swatch}
                  onClick={() => {
                    setTool('pen')
                    setColor(swatch)
                  }}
                  className={cn(
                    styles.colorButton,
                    color === swatch && tool === 'pen' && styles.colorButtonActive
                  )}
                  style={{ background: swatch }}
                />
              ))}
            </div>

            <div className={styles.toolGroup}>
              <span className={cn(styles.toolLabel, arcadeShellStyles.mono)}>Size</span>
              {BRUSH_SIZES.map((brushSize) => (
                <button
                  key={brushSize}
                  type="button"
                  onClick={() => setSize(brushSize)}
                  className={cn(styles.sizeButton, size === brushSize && styles.sizeButtonActive)}
                >
                  <span
                    className={styles.sizeDot}
                    style={{
                      width: Math.min(brushSize, 18),
                      height: Math.min(brushSize, 18),
                    }}
                  />
                </button>
              ))}
            </div>

            <div className={styles.toolGroup}>
              <span className={cn(styles.toolLabel, arcadeShellStyles.mono)}>Tools</span>
              <button
                type="button"
                title="Pen"
                onClick={() => setTool('pen')}
                className={cn(styles.toolButton, tool === 'pen' && styles.toolButtonActive)}
              >
                <PencilLine className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Eraser"
                onClick={() => setTool('eraser')}
                className={cn(styles.toolButton, tool === 'eraser' && styles.toolButtonActive)}
              >
                <Eraser className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Undo"
                onClick={() => onAction({ type: 'UNDO_STROKE', playerId })}
                className={styles.toolButton}
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Clear all"
                onClick={() => onAction({ type: 'CLEAR_CANVAS', playerId })}
                className={cn(styles.toolButton, styles.toolButtonDanger)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className={cn(styles.toolbar, styles.toolbarInfo)}>
            <span className={arcadeShellStyles.mono}>
              {hasGuessed ? '✓ You got it — waiting on the others' : 'Keep guessing in chat →'}
            </span>
          </div>
        )}
      </div>

      <ChatPanel
        messages={gameState.messages}
        isDrawer={isDrawer}
        hasGuessed={hasGuessed}
        onGuess={(text) => onAction({ type: 'GUESS', playerId, text })}
      />
    </div>
  )
}

export function SkribblGame() {
  const inviteCode = useInviteCode()
  const inviteCodeResolved = inviteCode !== undefined
  const [entryMode, setEntryMode] = useState<'howto' | 'entry'>('howto')
  const {
    createRoom,
    dispatch,
    error,
    gameState,
    joinRoom,
    leaveRoom,
    onlinePlayerIds,
    playerId,
    restoreSession,
    roomCode,
    savedSession,
    status,
  } = useSkribblRoom()

  useEffect(() => {
    if (inviteCode) {
      setEntryMode('entry')
    }
  }, [inviteCode])

  const crumb = makeCrumb(gameState, roomCode, playerId, inviteCode)
  const handleAction = useCallback(
    (action: GameAction) => {
      void dispatch(action)
    },
    [dispatch]
  )

  const handleCreate = useCallback(
    (name: string, avatar: number) => {
      void createRoom(name, { avatar })
    },
    [createRoom]
  )

  const handleJoin = useCallback(
    (code: string, name: string, avatar: number) => {
      void joinRoom(code, name, { avatar })
    },
    [joinRoom]
  )

  const handleLeave = useCallback(() => {
    void leaveRoom()
  }, [leaveRoom])

  const centered = gameState?.phase !== 'drawing'
  const isEntryState = !gameState || !playerId || !roomCode
  const isResolvingInvite = isEntryState && !inviteCodeResolved

  return (
    <ArcadeShell title="Skribbl" crumb={crumb} centered={centered}>
      {!isSupabaseConfigured ? (
        <SetupRequired />
      ) : isResolvingInvite ? (
        <InviteResolvingScreen />
      ) : isEntryState ? (
        entryMode === 'howto' ? (
          <HowToScreen onStart={() => setEntryMode('entry')} />
        ) : (
          <EntryScreen
            error={error}
            initialCode={inviteCode ?? null}
            loading={status === 'creating' || status === 'joining' || status === 'restoring'}
            onBackToHowTo={!inviteCode ? () => setEntryMode('howto') : undefined}
            onCreate={handleCreate}
            onJoin={handleJoin}
            onRestore={() => void restoreSession()}
            savedSession={savedSession}
          />
        )
      ) : gameState.phase === 'lobby' ? (
        <LobbyScreen
          gameState={gameState}
          onlinePlayerIds={onlinePlayerIds}
          playerId={playerId}
          roomCode={roomCode}
          onLeave={handleLeave}
          onRemovePlayer={(targetPlayerId) =>
            handleAction({
              type: 'REMOVE_PLAYER',
              playerId,
              targetPlayerId,
            })
          }
          onStart={() => handleAction({ type: 'START_GAME', playerId })}
          onUpdateSettings={(settings) =>
            handleAction({
              type: 'UPDATE_SETTINGS',
              playerId,
              ...settings,
            })
          }
        />
      ) : gameState.phase === 'picking' ? (
        getCurrentDrawer(gameState)?.id === playerId ? (
          <WordPickerScreen
            words={gameState.wordChoices}
            onPick={(word) => handleAction({ type: 'PICK_WORD', playerId, word })}
          />
        ) : (
          <WaitingPickerScreen drawerName={getCurrentDrawer(gameState)?.name ?? 'Player'} />
        )
      ) : gameState.phase === 'drawing' ? (
        <GameBoardScreen
          gameState={gameState}
          onlinePlayerIds={onlinePlayerIds}
          playerId={playerId}
          onAction={handleAction}
          onLeave={handleLeave}
        />
      ) : gameState.phase === 'round-end' ? (
        <RoundEndScreen
          gameState={gameState}
          playerId={playerId}
          onLeave={handleLeave}
          onNext={() => handleAction({ type: 'NEXT_TURN', playerId })}
        />
      ) : (
        <FinishedScreen
          gameState={gameState}
          playerId={playerId}
          onLeave={handleLeave}
          onPlayAgain={() => handleAction({ type: 'PLAY_AGAIN', playerId })}
        />
      )}
    </ArcadeShell>
  )
}
