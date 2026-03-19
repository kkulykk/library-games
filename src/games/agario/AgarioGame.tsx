'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { getSavedPlayerName, savePlayerName } from '@/lib/player-name'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useInviteCode, getInviteLink } from '@/hooks/useInviteCode'
import { useAgarioRoom } from './useAgarioRoom'
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  FOOD_COUNT,
  FOOD_PER_SEGMENT,
  START_LENGTH,
  GAME_DURATION,
  RESPAWN_DELAY,
  HEAD_RADIUS,
  BODY_RADIUS,
  moveSnake,
  angleTo,
  checkSnakeHeadVsBody,
  checkSnakeVsBorder,
  distanceBetween,
  checkFoodCollisions,
  snakeToFood,
  generateFood,
  createSnakeState,
  getViewport,
  lerpViewport,
  spawnPosition,
  compressSegments,
  SEGMENT_SPACING,
  type SnakeState,
  type Food,
  type BroadcastMessage,
  type Position,
} from './logic'

// ─── Constants ────────────────────────────────────────────────────────────────

const BROADCAST_RATE = 1000 / 10
const FOOD_SYNC_RATE = 3000
const FOOD_REPLENISH_RATE = 500
const GRID_SIZE = 50
const BG_COLOR = '#0a0a2e'
const GRID_COLOR = 'rgba(50, 50, 120, 0.3)'
const BORDER_COLOR = '#FF073A'

// ─── Game Canvas ──────────────────────────────────────────────────────────────

interface GameCanvasProps {
  mySnake: SnakeState
  otherSnakes: Map<string, SnakeState>
  food: Food[]
  timeLeft: number
  onMouseMove: (worldX: number, worldY: number) => void
  onBoostStart: () => void
  onBoostEnd: () => void
  canvasWidth: number
  canvasHeight: number
}

function GameCanvas({
  mySnake,
  otherSnakes,
  food,
  timeLeft,
  onMouseMove,
  onBoostStart,
  onBoostEnd,
  canvasWidth,
  canvasHeight,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const vpRef = useRef({ x: 0, y: 0, scale: 1 })

  // Pointer tracking
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const sx = canvas.width / rect.width
      const sy = canvas.height / rect.height
      const cx = (clientX - rect.left) * sx
      const cy = (clientY - rect.top) * sy
      const vp = vpRef.current
      onMouseMove(vp.x + cx / vp.scale, vp.y + cy / vp.scale)
    }

    const onMouse = (e: MouseEvent) => toWorld(e.clientX, e.clientY)
    const onTouch = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches[0]) toWorld(e.touches[0].clientX, e.touches[0].clientY)
    }
    const onMouseDown = () => onBoostStart()
    const onMouseUp = () => onBoostEnd()
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) onBoostStart()
    }
    const onTouchEnd = () => onBoostEnd()

    canvas.addEventListener('mousemove', onMouse)
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('touchmove', onTouch, { passive: false })
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)

    return () => {
      canvas.removeEventListener('mousemove', onMouse)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('touchmove', onTouch)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [onMouseMove, onBoostStart, onBoostEnd])

  // Keyboard boost
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        onBoostStart()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') onBoostEnd()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [onBoostStart, onBoostEnd])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number

    function draw() {
      if (!ctx) return

      // Smooth camera
      const targetVp = getViewport(
        mySnake.segments[0]?.x ?? MAP_WIDTH / 2,
        mySnake.segments[0]?.y ?? MAP_HEIGHT / 2,
        mySnake.targetLength,
        canvasWidth,
        canvasHeight
      )
      vpRef.current = lerpViewport(vpRef.current, targetVp, 0.08)
      const vp = vpRef.current

      ctx.save()
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      // Dark background
      ctx.fillStyle = BG_COLOR
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      ctx.scale(vp.scale, vp.scale)
      ctx.translate(-vp.x, -vp.y)

      const endX = vp.x + canvasWidth / vp.scale
      const endY = vp.y + canvasHeight / vp.scale

      // Grid
      ctx.strokeStyle = GRID_COLOR
      ctx.lineWidth = 1
      const startX = Math.floor(vp.x / GRID_SIZE) * GRID_SIZE
      const startY = Math.floor(vp.y / GRID_SIZE) * GRID_SIZE
      for (let x = startX; x <= endX; x += GRID_SIZE) {
        ctx.beginPath()
        ctx.moveTo(x, Math.max(0, vp.y))
        ctx.lineTo(x, Math.min(MAP_HEIGHT, endY))
        ctx.stroke()
      }
      for (let y = startY; y <= endY; y += GRID_SIZE) {
        ctx.beginPath()
        ctx.moveTo(Math.max(0, vp.x), y)
        ctx.lineTo(Math.min(MAP_WIDTH, endX), y)
        ctx.stroke()
      }

      // Border glow
      ctx.shadowColor = BORDER_COLOR
      ctx.shadowBlur = 20
      ctx.strokeStyle = BORDER_COLOR
      ctx.lineWidth = 4
      ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT)
      ctx.shadowBlur = 0

      // Food with glow
      for (const f of food) {
        if (f.x < vp.x - 20 || f.x > endX + 20 || f.y < vp.y - 20 || f.y > endY + 20) continue
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2)
        ctx.fillStyle = f.color
        ctx.shadowColor = f.color
        ctx.shadowBlur = 8
        ctx.fill()
      }
      ctx.shadowBlur = 0

      // Other snakes
      for (const [, s] of otherSnakes) {
        if (!s.alive || s.segments.length === 0) continue
        drawSnake(ctx, s, false)
      }

      // My snake
      if (mySnake.alive && mySnake.segments.length > 0) {
        drawSnake(ctx, mySnake, true)
      }

      ctx.restore()

      // ─── HUD (screen space) ─────────────────────────────────────────

      // Minimap
      const mmSize = 130
      const mmPad = 10
      const mmX = canvasWidth - mmSize - mmPad
      const mmY = canvasHeight - mmSize - mmPad
      ctx.fillStyle = 'rgba(10, 10, 46, 0.7)'
      ctx.strokeStyle = 'rgba(100, 100, 200, 0.4)'
      ctx.lineWidth = 1
      ctx.fillRect(mmX, mmY, mmSize, mmSize)
      ctx.strokeRect(mmX, mmY, mmSize, mmSize)

      const mmSX = mmSize / MAP_WIDTH
      const mmSY = mmSize / MAP_HEIGHT

      if (mySnake.alive) {
        const head = mySnake.segments[0]
        ctx.beginPath()
        ctx.arc(mmX + head.x * mmSX, mmY + head.y * mmSY, 3, 0, Math.PI * 2)
        ctx.fillStyle = mySnake.color
        ctx.shadowColor = mySnake.color
        ctx.shadowBlur = 4
        ctx.fill()
        ctx.shadowBlur = 0
      }
      for (const [, s] of otherSnakes) {
        if (!s.alive || s.segments.length === 0) continue
        ctx.beginPath()
        ctx.arc(mmX + s.segments[0].x * mmSX, mmY + s.segments[0].y * mmSY, 2, 0, Math.PI * 2)
        ctx.fillStyle = s.color
        ctx.fill()
      }

      // Timer
      const minutes = Math.floor(timeLeft / 60)
      const seconds = timeLeft % 60
      ctx.font = 'bold 18px monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, canvasWidth / 2, 30)

      // Length counter
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.fillText(`Length: ${Math.floor(mySnake.targetLength)}`, 14, 28)

      // Score
      ctx.fillText(`Score: ${mySnake.score}`, 14, 50)

      // Boost indicator
      if (mySnake.boosting && mySnake.alive) {
        ctx.font = 'bold 14px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(255, 200, 0, 0.8)'
        ctx.fillText('BOOST', canvasWidth / 2, canvasHeight - 20)
      }

      // Death overlay
      if (!mySnake.alive) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)
        ctx.fillStyle = '#FF073A'
        ctx.font = 'bold 28px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('You died!', canvasWidth / 2, canvasHeight / 2 - 10)
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = '16px sans-serif'
        ctx.fillText('Respawning...', canvasWidth / 2, canvasHeight / 2 + 20)
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [mySnake, otherSnakes, food, timeLeft, canvasWidth, canvasHeight])

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="h-full w-full"
      style={{ touchAction: 'none', cursor: 'none' }}
    />
  )
}

function drawSnake(ctx: CanvasRenderingContext2D, snake: SnakeState, isMe: boolean) {
  const { segments, color, name, boosting } = snake
  if (segments.length < 2) return

  // Glow when boosting
  if (boosting) {
    ctx.shadowColor = color
    ctx.shadowBlur = 15
  }

  // Draw body segments (from tail to head)
  for (let i = segments.length - 1; i >= 1; i--) {
    const seg = segments[i]
    const t = i / segments.length
    const radius = BODY_RADIUS * (0.6 + t * 0.4) // tapers toward tail

    // Alternating pattern (like slither.io skins)
    const stripe = i % 4 < 2
    ctx.beginPath()
    ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = stripe ? color : darkenCSS(color, 50)
    ctx.fill()

    // Outline
    ctx.strokeStyle = darkenCSS(color, 80)
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  // Head
  const head = segments[0]
  ctx.beginPath()
  ctx.arc(head.x, head.y, HEAD_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = darkenCSS(color, 60)
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.shadowBlur = 0

  // Eyes
  const angle =
    segments.length > 1
      ? Math.atan2(head.y - segments[1].y, head.x - segments[1].x) + Math.PI
      : snake.angle
  const eyeOffset = HEAD_RADIUS * 0.45
  const eyeR = HEAD_RADIUS * 0.3
  const pupilR = eyeR * 0.55

  for (const side of [-1, 1]) {
    const ex =
      head.x +
      Math.cos(angle) * eyeOffset * 0.6 +
      Math.cos(angle + (Math.PI / 2) * side) * eyeOffset
    const ey =
      head.y +
      Math.sin(angle) * eyeOffset * 0.6 +
      Math.sin(angle + (Math.PI / 2) * side) * eyeOffset

    ctx.beginPath()
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(
      ex + Math.cos(angle) * pupilR * 0.4,
      ey + Math.sin(angle) * pupilR * 0.4,
      pupilR,
      0,
      Math.PI * 2
    )
    ctx.fillStyle = '#111'
    ctx.fill()
  }

  // Name above head
  if (isMe || segments.length > 10) {
    const fontSize = isMe ? 14 : 12
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 3
    ctx.strokeText(name, head.x, head.y - HEAD_RADIUS - 8)
    ctx.fillText(name, head.x, head.y - HEAD_RADIUS - 8)
  }
}

function darkenCSS(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount)
  return `rgb(${r},${g},${b})`
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function Leaderboard({
  mySnake,
  otherSnakes,
  myId,
}: {
  mySnake: SnakeState
  otherSnakes: Map<string, SnakeState>
  myId: string
}) {
  const all = [mySnake, ...Array.from(otherSnakes.values())]
  const sorted = all
    .filter((s) => s.alive)
    .sort((a, b) => b.targetLength - a.targetLength)
    .slice(0, 8)

  return (
    <div className="absolute right-2 top-10 rounded-lg border border-white/10 bg-[#0a0a2e]/80 px-3 py-2 text-sm text-white backdrop-blur-sm">
      <div className="mb-1 text-center text-xs font-bold uppercase tracking-wider text-white/50">
        Leaderboard
      </div>
      {sorted.map((s, i) => (
        <div
          key={s.id}
          className={cn('flex items-center gap-2 py-0.5', s.id === myId && 'font-bold')}
        >
          <span className="w-4 text-right text-white/40">{i + 1}.</span>
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
            style={{ backgroundColor: s.color, boxShadow: `0 0 4px ${s.color}` }}
          />
          <span className="max-w-[80px] truncate">{s.name}</span>
          <span className="ml-auto text-white/60">{Math.floor(s.targetLength)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

function Lobby({
  gameState,
  playerId,
  roomCode,
  onStart,
}: {
  gameState: NonNullable<ReturnType<typeof useAgarioRoom>['gameState']>
  playerId: string
  roomCode: string
  onStart: () => void
}) {
  const isHost = gameState.hostId === playerId
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
    navigator.clipboard.writeText(getInviteLink('agario', roomCode)).then(
      () => {
        setCopied('link')
        setTimeout(() => setCopied(null), 2000)
      },
      () => {}
    )
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <p className="mb-1 text-sm text-muted-foreground">Room Code</p>
        <p className="font-mono text-4xl font-bold tracking-widest">{roomCode}</p>
        <p className="mt-1 text-sm text-muted-foreground">Share this code with friends</p>
        <div className="mt-2 flex justify-center gap-2">
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

      <div className="w-full max-w-xs">
        <h3 className="mb-2 text-sm font-semibold">Players ({gameState.players.length}/8)</h3>
        <div className="space-y-1">
          {gameState.players.map((p) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-2 rounded bg-muted px-3 py-1.5 text-sm',
                p.id === playerId && 'ring-1 ring-primary'
              )}
            >
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span>{p.name}</span>
              {p.isHost && <span className="ml-auto text-xs text-muted-foreground">(host)</span>}
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <button
          onClick={onStart}
          disabled={gameState.players.length < 2}
          className="rounded-lg bg-primary px-8 py-2 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {gameState.players.length < 2 ? 'Need 2+ players' : 'Start Game'}
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">Waiting for host to start...</p>
      )}

      <p className="max-w-xs text-center text-xs text-muted-foreground">
        Steer with your mouse. Hold click or spacebar to boost. Avoid crashing into other snakes!
      </p>
    </div>
  )
}

// ─── Finished Screen ──────────────────────────────────────────────────────────

function FinishedScreen({
  finalScores,
  myId,
  isHost,
  onPlayAgain,
  onLeave,
}: {
  finalScores: SnakeState[]
  myId: string
  isHost: boolean
  onPlayAgain: () => void
  onLeave: () => void
}) {
  const sorted = [...finalScores].sort((a, b) => b.score - a.score)

  return (
    <div className="flex flex-col items-center gap-6">
      <h2 className="text-2xl font-bold">Game Over!</h2>

      <div className="w-full max-w-xs">
        <h3 className="mb-2 text-center text-sm font-semibold">Final Scores</h3>
        <div className="space-y-1">
          {sorted.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                'flex items-center gap-2 rounded bg-muted px-3 py-2 text-sm',
                s.id === myId && 'ring-1 ring-primary',
                i === 0 && 'bg-yellow-100 dark:bg-yellow-900/30'
              )}
            >
              <span className="w-6 font-bold">{i + 1}.</span>
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate">{s.name}</span>
              <span className="ml-auto font-mono">{s.score}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        {isHost && (
          <button
            onClick={onPlayAgain}
            className="rounded-lg bg-primary px-6 py-2 font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Play Again
          </button>
        )}
        <button
          onClick={onLeave}
          className="rounded-lg bg-muted px-6 py-2 font-semibold transition hover:bg-muted/80"
        >
          Leave
        </button>
      </div>
    </div>
  )
}

// ─── Main Game Component ──────────────────────────────────────────────────────

export function AgarioGame() {
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
    broadcast,
    onBroadcast,
    leaveRoom,
  } = useAgarioRoom()

  const inviteCode = useInviteCode()
  const [nameInput, setNameInput] = useState(getSavedPlayerName)
  const [codeInput, setCodeInput] = useState(inviteCode ?? '')
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>(inviteCode ? 'join' : 'menu')

  // Game state refs
  const mySnakeRef = useRef<SnakeState | null>(null)
  const otherSnakesRef = useRef<Map<string, SnakeState>>(new Map())
  const foodRef = useRef<Food[]>([])
  const nextFoodIdRef = useRef(0)
  const targetRef = useRef<Position>({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 })
  const boostingRef = useRef(false)
  const gameStartTimeRef = useRef(0)
  const lastBroadcastRef = useRef(0)
  const lastFoodSyncRef = useRef(0)
  const lastFoodReplenishRef = useRef(0)
  const gameLoopRef = useRef<number | null>(null)
  const lastTickRef = useRef(0)

  // React state for rendering
  const [mySnakeState, setMySnakeState] = useState<SnakeState | null>(null)
  const [otherSnakesState, setOtherSnakesState] = useState<Map<string, SnakeState>>(new Map())
  const [foodState, setFoodState] = useState<Food[]>([])
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [finalScores, setFinalScores] = useState<SnakeState[]>([])
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

  useEffect(() => {
    function updateSize() {
      const w = Math.min(window.innerWidth, 1200)
      const h = Math.min(window.innerHeight - 120, 800)
      setCanvasSize({ width: Math.max(400, w), height: Math.max(300, h) })
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const isHost = gameState?.hostId === playerId

  // Handle broadcast messages
  useEffect(() => {
    onBroadcast.current = (msg: BroadcastMessage) => {
      switch (msg.type) {
        case 'snake_update': {
          if (msg.snake.id === playerId) return
          otherSnakesRef.current.set(msg.snake.id, msg.snake)
          break
        }
        case 'food_sync': {
          foodRef.current = msg.food
          nextFoodIdRef.current = msg.nextFoodId
          break
        }
        case 'eat_food': {
          if (msg.playerId === playerId) return
          const eatenSet = new Set(msg.foodIds)
          foodRef.current = foodRef.current.filter((f) => !eatenSet.has(f.id))
          break
        }
        case 'snake_killed': {
          // Validate proximity — reject fake kill messages from cheaters.
          // Use generous tolerance (4x normal collision distance) for network latency.
          const killer =
            msg.killerId === playerId
              ? mySnakeRef.current
              : otherSnakesRef.current.get(msg.killerId)
          const victim =
            msg.killedId === playerId
              ? mySnakeRef.current
              : otherSnakesRef.current.get(msg.killedId)
          if (!killer || !victim) break // Unknown snake — reject forged kill
          if (killer.alive && victim.segments.length > 0) {
            const maxDist = (HEAD_RADIUS + BODY_RADIUS) * 4
            const headPos = killer.segments[0]
            const isPlausible = victim.segments.some(
              (seg) => distanceBetween(headPos, seg) < maxDist
            )
            if (!isPlausible) break // Reject suspicious kill
          }

          if (msg.killedId === playerId && mySnakeRef.current) {
            mySnakeRef.current = {
              ...mySnakeRef.current,
              alive: false,
              deathTime: Date.now(),
            }
          }
          const killed = otherSnakesRef.current.get(msg.killedId)
          if (killed) {
            killed.alive = false
            killed.deathTime = Date.now()
          }
          break
        }
        case 'death_food': {
          foodRef.current = [...foodRef.current, ...msg.food]
          break
        }
        case 'game_start': {
          gameStartTimeRef.current = msg.startTime
          foodRef.current = msg.food
          nextFoodIdRef.current = msg.nextFoodId

          if (playerId && gameState) {
            const me = gameState.players.find((p) => p.id === playerId)
            if (me) {
              mySnakeRef.current = createSnakeState(me.id, me.name, me.color)
              otherSnakesRef.current.clear()
            }
          }
          setIsPlaying(true)
          setIsFinished(false)
          break
        }
        case 'game_end': {
          endGame()
          break
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, gameState, broadcast])

  function endGame() {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current)
      gameLoopRef.current = null
    }
    const allSnakes = [
      ...(mySnakeRef.current ? [mySnakeRef.current] : []),
      ...Array.from(otherSnakesRef.current.values()),
    ]
    setFinalScores(allSnakes)
    setIsPlaying(false)
    setIsFinished(true)
  }

  const handleStartGame = useCallback(async () => {
    if (!isHost || !playerId || !gameState) return

    await dispatch({ type: 'START_GAME', playerId })

    const initialFood = generateFood(FOOD_COUNT, 0)
    const me = gameState.players.find((p) => p.id === playerId)
    if (me) {
      mySnakeRef.current = createSnakeState(me.id, me.name, me.color)
    }
    foodRef.current = initialFood
    nextFoodIdRef.current = FOOD_COUNT
    gameStartTimeRef.current = Date.now()
    otherSnakesRef.current.clear()

    broadcast({
      type: 'game_start',
      startTime: Date.now(),
      food: initialFood,
      nextFoodId: FOOD_COUNT,
    })

    setIsPlaying(true)
    setIsFinished(false)
  }, [isHost, playerId, gameState, dispatch, broadcast])

  // Game loop
  useEffect(() => {
    if (!isPlaying || !mySnakeRef.current || !playerId) return

    function tick() {
      const now = Date.now()
      const dt = Math.min((now - (lastTickRef.current || now)) / 1000, 0.1)
      lastTickRef.current = now

      const me = mySnakeRef.current
      if (!me) return

      // Timer
      const elapsed = (now - gameStartTimeRef.current) / 1000
      const remaining = Math.max(0, GAME_DURATION - Math.floor(elapsed))
      setTimeLeft(remaining)

      if (remaining <= 0) {
        if (isHost) {
          broadcast({ type: 'game_end' })
        }
        endGame()
        return
      }

      // Respawn
      if (!me.alive && me.deathTime && now - me.deathTime > RESPAWN_DELAY) {
        const pos = spawnPosition()
        const angle = Math.random() * Math.PI * 2
        const segments: Position[] = []
        for (let i = 0; i < START_LENGTH; i++) {
          segments.push({
            x: pos.x - Math.cos(angle) * i * SEGMENT_SPACING,
            y: pos.y - Math.sin(angle) * i * SEGMENT_SPACING,
          })
        }
        me.segments = segments
        me.angle = angle
        me.targetLength = START_LENGTH
        me.alive = true
        me.deathTime = null
        me.boosting = false
        me.foodEaten = 0
      }

      if (me.alive && me.segments.length > 0) {
        // Set boosting
        me.boosting = boostingRef.current

        // Calculate target angle from cursor
        const head = me.segments[0]
        const targetAngle = angleTo(head, targetRef.current)

        // Move snake
        const moved = moveSnake(me, targetAngle, dt)
        Object.assign(me, moved)

        // Border collision
        if (checkSnakeVsBorder(me.segments[0])) {
          me.alive = false
          me.deathTime = now
          const deathFood = snakeToFood(me, nextFoodIdRef.current)
          nextFoodIdRef.current += deathFood.length
          foodRef.current = [...foodRef.current, ...deathFood]
          broadcast({ type: 'death_food', food: deathFood })
        }

        // Check collision with other snakes
        if (me.alive) {
          for (const [, other] of otherSnakesRef.current) {
            if (checkSnakeHeadVsBody(me.segments[0], other)) {
              me.alive = false
              me.deathTime = now
              const deathFood = snakeToFood(me, nextFoodIdRef.current)
              nextFoodIdRef.current += deathFood.length
              foodRef.current = [...foodRef.current, ...deathFood]
              broadcast({
                type: 'snake_killed',
                killerId: other.id,
                killedId: me.id,
              })
              broadcast({ type: 'death_food', food: deathFood })
              break
            }
          }
        }

        // Food collisions
        if (me.alive) {
          const eatenIds = checkFoodCollisions(me, foodRef.current)
          if (eatenIds.length > 0) {
            const eatenSet = new Set(eatenIds)
            foodRef.current = foodRef.current.filter((f) => !eatenSet.has(f.id))
            me.foodEaten += eatenIds.length
            me.score += eatenIds.length

            // Grow snake
            const growth = Math.floor(me.foodEaten / FOOD_PER_SEGMENT)
            if (growth > 0) {
              me.targetLength += growth
              me.foodEaten -= growth * FOOD_PER_SEGMENT
            }

            broadcast({ type: 'eat_food', playerId: me.id, foodIds: eatenIds })
          }
        }
      }

      // Broadcast snake state
      if (now - lastBroadcastRef.current > BROADCAST_RATE) {
        broadcast({
          type: 'snake_update',
          snake: {
            ...me,
            segments: compressSegments(me.segments),
          },
        })
        lastBroadcastRef.current = now
      }

      // Host: replenish food
      if (isHost && now - lastFoodReplenishRef.current > FOOD_REPLENISH_RATE) {
        lastFoodReplenishRef.current = now
        const deficit = FOOD_COUNT - foodRef.current.length
        if (deficit > 20) {
          const batch = Math.min(deficit, 30)
          const newFood = generateFood(batch, nextFoodIdRef.current)
          nextFoodIdRef.current += batch
          foodRef.current = [...foodRef.current, ...newFood]
        }
      }

      // Host: sync food
      if (isHost && now - lastFoodSyncRef.current > FOOD_SYNC_RATE) {
        broadcast({
          type: 'food_sync',
          food: foodRef.current,
          nextFoodId: nextFoodIdRef.current,
        })
        lastFoodSyncRef.current = now
      }

      // Update React state
      setMySnakeState({ ...me, segments: [...me.segments] })
      setOtherSnakesState(new Map(otherSnakesRef.current))
      setFoodState([...foodRef.current])

      gameLoopRef.current = requestAnimationFrame(tick)
    }

    lastTickRef.current = Date.now()
    gameLoopRef.current = requestAnimationFrame(tick)

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
        gameLoopRef.current = null
      }
    }
  }, [isPlaying, playerId, isHost, broadcast, dispatch])

  const handleMouseMove = useCallback((worldX: number, worldY: number) => {
    targetRef.current = { x: worldX, y: worldY }
  }, [])

  const handleBoostStart = useCallback(() => {
    boostingRef.current = true
  }, [])

  const handleBoostEnd = useCallback(() => {
    boostingRef.current = false
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (!isSupabaseConfigured) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="max-w-md rounded-lg bg-destructive/10 p-6 text-center text-destructive">
          <h3 className="mb-2 font-semibold">Supabase not configured</h3>
          <p className="text-sm">
            Copy <code>.env.local.example</code> to <code>.env.local</code> and fill in your
            Supabase URL and anon key.
          </p>
        </div>
      </div>
    )
  }

  if (isPlaying && mySnakeState && playerId) {
    return (
      <div className="relative flex flex-col items-center">
        <div
          className="relative overflow-hidden rounded-lg border border-white/10"
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
          <GameCanvas
            mySnake={mySnakeState}
            otherSnakes={otherSnakesState}
            food={foodState}
            timeLeft={timeLeft}
            onMouseMove={handleMouseMove}
            onBoostStart={handleBoostStart}
            onBoostEnd={handleBoostEnd}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
          />
          <Leaderboard mySnake={mySnakeState} otherSnakes={otherSnakesState} myId={playerId} />
        </div>
      </div>
    )
  }

  if (isFinished && playerId) {
    return (
      <FinishedScreen
        finalScores={finalScores}
        myId={playerId}
        isHost={isHost}
        onPlayAgain={async () => {
          await dispatch({ type: 'PLAY_AGAIN', playerId })
          setIsFinished(false)
        }}
        onLeave={leaveRoom}
      />
    )
  }

  if (status === 'connected' && gameState && playerId && roomCode) {
    return (
      <Lobby
        gameState={gameState}
        playerId={playerId}
        roomCode={roomCode}
        onStart={handleStartGame}
      />
    )
  }

  if (status === 'creating' || status === 'joining' || status === 'restoring') {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="animate-pulse text-muted-foreground">
          {status === 'creating' && 'Creating room...'}
          {status === 'joining' && 'Joining room...'}
          {status === 'restoring' && 'Restoring session...'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Slither around, eat food to grow longer, and make other snakes crash into you! Hold click or
        spacebar to boost.
      </p>

      {error && (
        <div className="rounded bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      )}

      {savedSession && (
        <button
          onClick={restoreSession}
          className="w-full max-w-xs rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Rejoin as {savedSession.playerName}
        </button>
      )}

      {mode === 'menu' && (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            onClick={() => setMode('create')}
            className="rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Create Room
          </button>
          <button
            onClick={() => setMode('join')}
            className="rounded-lg bg-muted px-4 py-3 font-semibold transition hover:bg-muted/80"
          >
            Join Room
          </button>
        </div>
      )}

      {mode === 'create' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (nameInput.trim()) {
              savePlayerName(nameInput.trim())
              createRoom(nameInput.trim())
            }
          }}
          className="flex w-full max-w-xs flex-col gap-3"
        >
          <input
            type="text"
            placeholder="Your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={16}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('menu')}
              className="flex-1 rounded-lg bg-muted px-4 py-2 text-sm transition hover:bg-muted/80"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {mode === 'join' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (nameInput.trim() && codeInput.trim()) {
              savePlayerName(nameInput.trim())
              joinRoom(codeInput.trim(), nameInput.trim())
            }
          }}
          className="flex w-full max-w-xs flex-col gap-3"
        >
          <input
            type="text"
            placeholder="Your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={16}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            autoFocus
          />
          <input
            type="text"
            placeholder="Room code"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            maxLength={4}
            className="rounded-lg border border-input bg-background px-3 py-2 text-center font-mono text-lg tracking-widest"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('menu')}
              className="flex-1 rounded-lg bg-muted px-4 py-2 text-sm transition hover:bg-muted/80"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!nameInput.trim() || codeInput.length < 4}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
