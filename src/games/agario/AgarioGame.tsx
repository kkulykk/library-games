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

interface KillFeedEntry {
  id: number
  killerName: string
  killerColor: string
  victimName: string
  victimColor: string
  isMe: boolean
  at: number
}

interface GameCanvasProps {
  mySnake: SnakeState
  otherSnakes: Map<string, SnakeState>
  food: Food[]
  timeLeft: number
  respawnMs: number | null
  onSteer: (worldX: number, worldY: number) => void
  onBoostStart: () => void
  onBoostEnd: () => void
  canvasWidth: number
  canvasHeight: number
  isTouch: boolean
}

function GameCanvas({
  mySnake,
  otherSnakes,
  food,
  timeLeft,
  respawnMs,
  onSteer,
  onBoostStart,
  onBoostEnd,
  canvasWidth,
  canvasHeight,
  isTouch,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const vpRef = useRef({ x: 0, y: 0, scale: 1 })

  // Pointer tracking
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Desktop/mouse: steer to cursor world position (absolute).
    // Touch: steer relative to canvas center — project a target far ahead.
    const steerFromEvent = (clientX: number, clientY: number, relative: boolean) => {
      const rect = canvas.getBoundingClientRect()
      const cssX = clientX - rect.left
      const cssY = clientY - rect.top
      const vp = vpRef.current
      if (relative) {
        const dx = cssX - rect.width / 2
        const dy = cssY - rect.height / 2
        const mag = Math.sqrt(dx * dx + dy * dy) || 1
        // Project a far-away target in the indicated direction so the snake
        // steers toward that heading regardless of canvas distance.
        const head = mySnake.segments[0] ?? { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }
        const FAR = 2000
        onSteer(head.x + (dx / mag) * FAR, head.y + (dy / mag) * FAR)
      } else {
        onSteer(vp.x + cssX / vp.scale, vp.y + cssY / vp.scale)
      }
    }

    const onMouse = (e: MouseEvent) => steerFromEvent(e.clientX, e.clientY, false)
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches[0]) steerFromEvent(e.touches[0].clientX, e.touches[0].clientY, true)
    }
    const onMouseDown = () => onBoostStart()
    const onMouseUp = () => onBoostEnd()
    const onTouchStart = (e: TouchEvent) => {
      // Immediately steer on first touch
      if (e.touches[0]) {
        steerFromEvent(e.touches[0].clientX, e.touches[0].clientY, true)
      }
    }
    canvas.addEventListener('mousemove', onMouse)
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })

    return () => {
      canvas.removeEventListener('mousemove', onMouse)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchstart', onTouchStart)
    }
  }, [onSteer, onBoostStart, onBoostEnd, mySnake])

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

  // DPI-aware canvas backing store sizing
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(canvasWidth * dpr)
    canvas.height = Math.round(canvasHeight * dpr)
    canvas.style.width = `${canvasWidth}px`
    canvas.style.height = `${canvasHeight}px`
  }, [canvasWidth, canvasHeight])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number

    function draw() {
      if (!ctx || !canvas) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)

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

      // Reset transform and clear using raw canvas backing dimensions
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // All subsequent draws operate in CSS pixels
      ctx.scale(dpr, dpr)

      ctx.save()

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

      // Timer — top center pill
      const minutes = Math.floor(timeLeft / 60)
      const seconds = timeLeft % 60
      const timerStr = `${minutes}:${seconds.toString().padStart(2, '0')}`
      ctx.font = 'bold 18px monospace'
      ctx.textAlign = 'center'
      const timerW = ctx.measureText(timerStr).width + 28
      ctx.fillStyle = 'rgba(10, 10, 46, 0.7)'
      ctx.strokeStyle = 'rgba(100, 100, 200, 0.4)'
      ctx.lineWidth = 1
      roundedRect(ctx, canvasWidth / 2 - timerW / 2, 12, timerW, 30, 15)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = timeLeft <= 10 ? '#FF073A' : 'rgba(255,255,255,0.9)'
      ctx.fillText(timerStr, canvasWidth / 2, 33)

      // Stat card — top left (length + score)
      const cardPad = 10
      const cardX = 10
      const cardY = 12
      const cardW = 140
      const cardH = 58
      ctx.fillStyle = 'rgba(10, 10, 46, 0.7)'
      ctx.strokeStyle = 'rgba(100, 100, 200, 0.4)'
      roundedRect(ctx, cardX, cardY, cardW, cardH, 8)
      ctx.fill()
      ctx.stroke()
      ctx.textAlign = 'left'
      ctx.font = 'bold 11px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.fillText('LENGTH', cardX + cardPad, cardY + 18)
      ctx.fillText('SCORE', cardX + cardPad + 70, cardY + 18)
      ctx.font = 'bold 18px sans-serif'
      ctx.fillStyle = mySnake.color
      ctx.fillText(`${Math.floor(mySnake.targetLength)}`, cardX + cardPad, cardY + 42)
      ctx.fillStyle = '#fff'
      ctx.fillText(`${mySnake.score}`, cardX + cardPad + 70, cardY + 42)

      // Boost bar — bottom center
      const barW = Math.min(240, canvasWidth * 0.45)
      const barH = 10
      const barX = canvasWidth / 2 - barW / 2
      const barY = canvasHeight - 28
      const boostFraction = Math.max(
        0,
        Math.min(1, (mySnake.targetLength - 15) / Math.max(1, mySnake.targetLength))
      )
      ctx.fillStyle = 'rgba(10, 10, 46, 0.7)'
      ctx.strokeStyle = 'rgba(100, 100, 200, 0.4)'
      roundedRect(ctx, barX - 2, barY - 2, barW + 4, barH + 4, 6)
      ctx.fill()
      ctx.stroke()
      // fill
      const boostFillW = barW * boostFraction
      const canBoost = mySnake.targetLength > 15
      ctx.fillStyle = mySnake.boosting
        ? '#FFD700'
        : canBoost
          ? mySnake.color
          : 'rgba(255,255,255,0.2)'
      if (mySnake.boosting) {
        ctx.shadowColor = '#FFD700'
        ctx.shadowBlur = 10
      }
      roundedRect(ctx, barX, barY, boostFillW, barH, 5)
      ctx.fill()
      ctx.shadowBlur = 0
      // label
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      const boostLabel = isTouch ? 'BOOST — tap right button' : 'BOOST — click / space'
      ctx.fillText(boostLabel, canvasWidth / 2, barY - 6)

      // Kill feed — top right below leaderboard (drawn via DOM in React; nothing here)

      // Death overlay with countdown
      if (!mySnake.alive) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)
        ctx.fillStyle = '#FF073A'
        ctx.font = 'bold 34px sans-serif'
        ctx.textAlign = 'center'
        ctx.shadowColor = '#FF073A'
        ctx.shadowBlur = 14
        ctx.fillText('You died', canvasWidth / 2, canvasHeight / 2 - 10)
        ctx.shadowBlur = 0
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font = '16px sans-serif'
        const secs = respawnMs != null ? Math.max(0, Math.ceil(respawnMs / 1000)) : 0
        ctx.fillText(
          respawnMs != null && respawnMs > 0 ? `Respawning in ${secs}…` : 'Respawning…',
          canvasWidth / 2,
          canvasHeight / 2 + 22
        )
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [mySnake, otherSnakes, food, timeLeft, canvasWidth, canvasHeight, respawnMs, isTouch])

  return (
    <canvas
      data-testid="agario-canvas"
      ref={canvasRef}
      className="block h-full w-full select-none"
      style={{
        touchAction: 'none',
        cursor: isTouch ? 'default' : 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    />
  )
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
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

// ─── Kill Feed ────────────────────────────────────────────────────────────────

function KillFeed({ entries }: { entries: KillFeedEntry[] }) {
  if (entries.length === 0) return null
  return (
    <div className="pointer-events-none absolute top-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
      {entries.slice(-5).map((e) => (
        <div
          key={e.id}
          className={cn(
            'animate-in fade-in slide-in-from-top-1 rounded-full border bg-[#0a0a2e]/80 px-3 py-1 text-xs backdrop-blur-sm duration-200',
            e.isMe ? 'border-red-500/60' : 'border-white/10'
          )}
        >
          <span className="font-semibold" style={{ color: e.killerColor }}>
            {e.killerName}
          </span>
          <span className="mx-1.5 text-white/60">killed</span>
          <span className="font-semibold" style={{ color: e.victimColor }}>
            {e.victimName}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Mobile Boost Button ──────────────────────────────────────────────────────

function MobileBoostButton({
  canBoost,
  onStart,
  onEnd,
}: {
  canBoost: boolean
  onStart: () => void
  onEnd: () => void
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <button
      type="button"
      aria-label="Boost"
      className={cn(
        'pointer-events-auto absolute right-6 bottom-6 flex h-20 w-20 items-center justify-center rounded-full border-2 font-bold text-white transition-transform select-none',
        pressed ? 'scale-95' : 'scale-100',
        canBoost
          ? 'border-yellow-300/80 bg-gradient-to-br from-orange-500/80 to-red-600/80 shadow-lg shadow-orange-500/40'
          : 'border-white/20 bg-white/10'
      )}
      style={{ touchAction: 'none', WebkitTapHighlightColor: 'transparent' }}
      onTouchStart={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setPressed(true)
        onStart()
      }}
      onTouchEnd={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setPressed(false)
        onEnd()
      }}
      onTouchCancel={() => {
        setPressed(false)
        onEnd()
      }}
      onPointerDown={(e) => {
        // Fallback for devices that emit pointer before touch
        if (e.pointerType === 'mouse') return
        setPressed(true)
        onStart()
      }}
      onPointerUp={(e) => {
        if (e.pointerType === 'mouse') return
        setPressed(false)
        onEnd()
      }}
    >
      <span className="text-xs tracking-widest">BOOST</span>
    </button>
  )
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
    <div
      data-testid="agario-leaderboard"
      className="absolute top-10 right-2 rounded-lg border border-white/10 bg-[#0a0a2e]/80 px-3 py-2 text-sm text-white backdrop-blur-sm"
    >
      <div className="mb-1 text-center text-xs font-bold tracking-wider text-white/50 uppercase">
        Leaderboard
      </div>
      {sorted.map((s, i) => (
        <div
          key={s.id}
          data-testid="agario-leaderboard-row"
          data-player-id={s.id}
          data-player-name={s.name}
          data-score={s.score}
          data-length={Math.floor(s.targetLength)}
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
        <p className="text-muted-foreground mb-1 text-sm">Room Code</p>
        <p data-testid="room-code" className="font-mono text-4xl font-bold tracking-widest">
          {roomCode}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">Share this code with friends</p>
        <div className="mt-2 flex justify-center gap-2">
          <button
            onClick={copyCode}
            className="hover:bg-background rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors"
          >
            {copied === 'code' ? 'Copied!' : 'Copy code'}
          </button>
          <button
            onClick={copyInviteLink}
            data-testid="invite-link"
            data-invite-link={getInviteLink('agario', roomCode)}
            className="hover:bg-background rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors"
          >
            {copied === 'link' ? 'Copied!' : 'Copy invite link'}
          </button>
        </div>
      </div>

      <div className="w-full max-w-xs">
        <h3 className="mb-2 text-sm font-semibold">Players ({gameState.players.length}/8)</h3>
        <div data-testid="player-roster" className="space-y-1">
          {gameState.players.map((p) => (
            <div
              key={p.id}
              className={cn(
                'bg-muted flex items-center gap-2 rounded px-3 py-1.5 text-sm',
                p.id === playerId && 'ring-primary ring-1'
              )}
            >
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span>{p.name}</span>
              {p.isHost && <span className="text-muted-foreground ml-auto text-xs">(host)</span>}
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <button
          data-testid="start-game-button"
          onClick={onStart}
          disabled={gameState.players.length < 2}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-8 py-2 font-semibold transition disabled:opacity-50"
        >
          {gameState.players.length < 2 ? 'Need 2+ players' : 'Start Game'}
        </button>
      ) : (
        <p className="text-muted-foreground text-sm">Waiting for host to start...</p>
      )}

      <p className="text-muted-foreground max-w-xs text-center text-xs">
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
    <div data-testid="agario-finished" className="flex flex-col items-center gap-6">
      <h2 className="text-2xl font-bold">Game Over!</h2>

      <div className="w-full max-w-xs">
        <h3 className="mb-2 text-center text-sm font-semibold">Final Scores</h3>
        <div data-testid="agario-final-scores" className="space-y-1">
          {sorted.map((s, i) => (
            <div
              key={s.id}
              data-testid="agario-final-score-row"
              data-player-id={s.id}
              data-player-name={s.name}
              data-score={s.score}
              className={cn(
                'bg-muted flex items-center gap-2 rounded px-3 py-2 text-sm',
                s.id === myId && 'ring-primary ring-1',
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
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-2 font-semibold transition"
          >
            Play Again
          </button>
        )}
        <button
          data-testid="leave-room-button"
          onClick={onLeave}
          className="bg-muted hover:bg-muted/80 rounded-lg px-6 py-2 font-semibold transition"
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
  // Most-recently-received snake states from the network — rendered snakes are
  // interpolated toward these each frame for smoother movement between broadcasts.
  const otherSnakesTargetRef = useRef<Map<string, SnakeState>>(new Map())
  const foodRef = useRef<Food[]>([])
  const nextFoodIdRef = useRef(0)
  const targetRef = useRef<Position>({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 })
  const boostingRef = useRef(false)
  const gameStartTimeRef = useRef(0)
  const lastBroadcastRef = useRef(0)
  const lastBroadcastHeadRef = useRef<{ x: number; y: number } | null>(null)
  const lastBroadcastBoostRef = useRef(false)
  const lastFoodSyncRef = useRef(0)
  const lastFoodReplenishRef = useRef(0)
  const gameLoopRef = useRef<number | null>(null)
  const lastTickRef = useRef(0)
  const nextKillFeedIdRef = useRef(1)

  // React state for rendering
  const [mySnakeState, setMySnakeState] = useState<SnakeState | null>(null)
  const [otherSnakesState, setOtherSnakesState] = useState<Map<string, SnakeState>>(new Map())
  const [foodState, setFoodState] = useState<Food[]>([])
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [finalScores, setFinalScores] = useState<SnakeState[]>([])
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
  const [isTouch, setIsTouch] = useState(false)
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([])
  const [respawnMs, setRespawnMs] = useState<number | null>(null)

  // Detect touch device once (coarse pointer media query)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => setIsTouch(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Responsive canvas sizing — fullscreen on mobile, bounded on desktop.
  useEffect(() => {
    function updateSize() {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const mobile = vw < 768
      // On mobile: full viewport minus a small header (~56px for back button).
      // On desktop: bounded to 1200x800 with padding for the GameLayout chrome.
      const w = mobile ? vw : Math.min(vw - 32, 1200)
      const h = mobile ? vh - 64 : Math.min(vh - 140, 800)
      setCanvasSize({ width: Math.max(320, w), height: Math.max(320, h) })
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    window.addEventListener('orientationchange', updateSize)
    return () => {
      window.removeEventListener('resize', updateSize)
      window.removeEventListener('orientationchange', updateSize)
    }
  }, [])

  // Prune old kill-feed entries (fade out after 5s)
  useEffect(() => {
    if (killFeed.length === 0) return
    const timer = setTimeout(() => {
      const cutoff = Date.now() - 5000
      setKillFeed((prev) => prev.filter((k) => k.at > cutoff))
    }, 1000)
    return () => clearTimeout(timer)
  }, [killFeed])

  // Helper to push a kill-feed entry
  const pushKill = useCallback(
    (
      killerName: string,
      killerColor: string,
      victimName: string,
      victimColor: string,
      isMe: boolean
    ) => {
      const entry: KillFeedEntry = {
        id: nextKillFeedIdRef.current++,
        killerName,
        killerColor,
        victimName,
        victimColor,
        isMe,
        at: Date.now(),
      }
      setKillFeed((prev) => [...prev.slice(-5), entry])
    },
    []
  )

  const isHost = gameState?.hostId === playerId

  // Handle broadcast messages
  useEffect(() => {
    onBroadcast.current = (msg: BroadcastMessage) => {
      switch (msg.type) {
        case 'snake_update': {
          if (msg.snake.id === playerId) return
          // Store the latest authoritative snake as the interpolation target.
          // The currently-rendered snake is lerped toward this each tick.
          otherSnakesTargetRef.current.set(msg.snake.id, msg.snake)
          if (!otherSnakesRef.current.has(msg.snake.id)) {
            otherSnakesRef.current.set(msg.snake.id, msg.snake)
          }
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
          otherSnakesTargetRef.current.delete(msg.killedId)

          // Push kill-feed entry using best-known names/colors
          const resolveMeta = (id: string) => {
            if (id === playerId && mySnakeRef.current)
              return { name: mySnakeRef.current.name, color: mySnakeRef.current.color }
            const other = otherSnakesRef.current.get(id)
            if (other) return { name: other.name, color: other.color }
            const lobbyP = gameState?.players.find((p) => p.id === id)
            if (lobbyP) return { name: lobbyP.name, color: lobbyP.color }
            return { name: '???', color: '#888' }
          }
          const k = resolveMeta(msg.killerId)
          const v = resolveMeta(msg.killedId)
          pushKill(k.name, k.color, v.name, v.color, msg.killedId === playerId)
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
              otherSnakesTargetRef.current.clear()
            }
          }
          setKillFeed([])
          setRespawnMs(null)
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

      // Respawn countdown + logic
      if (!me.alive && me.deathTime) {
        const remainingRespawn = RESPAWN_DELAY - (now - me.deathTime)
        setRespawnMs(remainingRespawn)
        if (remainingRespawn <= 0) {
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
          setRespawnMs(null)
        }
      } else if (me.alive) {
        // Use functional setter so this isn't a dependency of the tick effect.
        setRespawnMs((prev) => (prev !== null ? null : prev))
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
              // Show kill-feed entry locally (remote clients get it via broadcast)
              pushKill(other.name, other.color, me.name, me.color, true)
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

      // Broadcast snake state — only when alive and moved significantly or boost changed
      const MIN_MOVE_PX = 3
      if (me.alive && now - lastBroadcastRef.current > BROADCAST_RATE) {
        const head = me.segments[0]
        const lastHead = lastBroadcastHeadRef.current
        const boostChanged = me.boosting !== lastBroadcastBoostRef.current
        const movedEnough =
          !lastHead ||
          Math.abs(head.x - lastHead.x) > MIN_MOVE_PX ||
          Math.abs(head.y - lastHead.y) > MIN_MOVE_PX
        if (movedEnough || boostChanged) {
          broadcast({
            type: 'snake_update',
            snake: {
              ...me,
              segments: compressSegments(me.segments),
            },
          })
          lastBroadcastRef.current = now
          lastBroadcastHeadRef.current = { x: head.x, y: head.y }
          lastBroadcastBoostRef.current = me.boosting
        }
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

      // Interpolate other snakes toward their latest broadcast targets.
      // Broadcasts arrive every ~100ms; lerping at a fixed per-frame rate
      // produces a smooth visual at the cost of a small display lag.
      const LERP_T = Math.min(1, dt * 12)
      for (const [id, target] of otherSnakesTargetRef.current) {
        const current = otherSnakesRef.current.get(id)
        if (!current) {
          otherSnakesRef.current.set(id, target)
          continue
        }
        // Preserve identity/meta from target; interpolate segment positions.
        const segs = target.segments.map((seg, i) => {
          const curSeg = current.segments[i]
          if (!curSeg) return seg
          return {
            x: curSeg.x + (seg.x - curSeg.x) * LERP_T,
            y: curSeg.y + (seg.y - curSeg.y) * LERP_T,
          }
        })
        otherSnakesRef.current.set(id, {
          ...target,
          segments: segs,
        })
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
  }, [isPlaying, playerId, isHost, broadcast, dispatch, pushKill])

  const handleSteer = useCallback((worldX: number, worldY: number) => {
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
        <div className="bg-destructive/10 text-destructive max-w-md rounded-lg p-6 text-center">
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
          data-testid="agario-game-area"
          className="relative overflow-hidden rounded-lg border border-white/10"
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
          <GameCanvas
            mySnake={mySnakeState}
            otherSnakes={otherSnakesState}
            food={foodState}
            timeLeft={timeLeft}
            respawnMs={respawnMs}
            onSteer={handleSteer}
            onBoostStart={handleBoostStart}
            onBoostEnd={handleBoostEnd}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            isTouch={isTouch}
          />
          <Leaderboard mySnake={mySnakeState} otherSnakes={otherSnakesState} myId={playerId} />
          <KillFeed entries={killFeed} />
          {isTouch && mySnakeState.alive && (
            <MobileBoostButton
              canBoost={mySnakeState.targetLength > 15}
              onStart={handleBoostStart}
              onEnd={handleBoostEnd}
            />
          )}
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
        <p className="text-muted-foreground animate-pulse">
          {status === 'creating' && 'Creating room...'}
          {status === 'joining' && 'Joining room...'}
          {status === 'restoring' && 'Restoring session...'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <p className="text-muted-foreground max-w-md text-center text-sm">
        Slither around, eat food to grow longer, and make other snakes crash into you! Hold click or
        spacebar to boost.
      </p>

      {error && (
        <div
          data-testid="room-error"
          className="bg-destructive/10 text-destructive rounded px-4 py-2 text-sm"
        >
          {error}
        </div>
      )}

      {savedSession && (
        <button
          onClick={restoreSession}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full max-w-xs rounded-lg px-4 py-2 font-semibold transition"
        >
          Rejoin as {savedSession.playerName}
        </button>
      )}

      {mode === 'menu' && (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            data-testid="create-room-button"
            onClick={() => setMode('create')}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-3 font-semibold transition"
          >
            Create Room
          </button>
          <button
            data-testid="join-room-button"
            onClick={() => setMode('join')}
            className="bg-muted hover:bg-muted/80 rounded-lg px-4 py-3 font-semibold transition"
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
            data-testid="player-name-input"
            type="text"
            placeholder="Your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={16}
            className="border-input bg-background rounded-lg border px-3 py-2 text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('menu')}
              className="bg-muted hover:bg-muted/80 flex-1 rounded-lg px-4 py-2 text-sm transition"
            >
              Back
            </button>
            <button
              type="submit"
              data-testid="create-room-button"
              disabled={!nameInput.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
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
            data-testid="player-name-input"
            type="text"
            placeholder="Your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={16}
            className="border-input bg-background rounded-lg border px-3 py-2 text-sm"
            autoFocus
          />
          <input
            data-testid="room-code-input"
            type="text"
            placeholder="Room code"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            maxLength={4}
            className="border-input bg-background rounded-lg border px-3 py-2 text-center font-mono text-lg tracking-widest"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('menu')}
              className="bg-muted hover:bg-muted/80 flex-1 rounded-lg px-4 py-2 text-sm transition"
            >
              Back
            </button>
            <button
              type="submit"
              data-testid="join-room-button"
              disabled={!nameInput.trim() || codeInput.length < 4}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
