'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  BALL_RADIUS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PLATFORM_H,
  STAR_RADIUS,
  GameState,
  Platform,
  Star,
  createInitialState,
  stepGame,
  totalScore,
} from './logic'

// Nokia-inspired colour palette
const C = {
  bg: '#050a1f',
  platNormal: '#00c853',
  platNormalShade: '#007a33',
  platMoving: '#2979ff',
  platMovingShade: '#0d47a1',
  platBreaking: '#ff6d00',
  platBreakingShade: '#bf360c',
  ball: '#ff3d00',
  ballMid: '#ff6e40',
  ballHi: '#ffab91',
  star: '#ffd600',
  starGlow: 'rgba(255,214,0,0.3)',
  hud: '#ffffff',
  hudLabel: '#7986cb',
  overBg: 'rgba(5,10,31,0.82)',
  overTitle: '#ffd600',
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  squishX: number,
  squishY: number
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(squishX, squishY)
  const g = ctx.createRadialGradient(-3, -4, 1, 0, 0, BALL_RADIUS)
  g.addColorStop(0, C.ballHi)
  g.addColorStop(0.45, C.ballMid)
  g.addColorStop(1, C.ball)
  ctx.beginPath()
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  // specular highlight
  ctx.beginPath()
  ctx.arc(-4, -5, 4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fill()
  ctx.restore()
}

function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform) {
  const top =
    p.type === 'moving' ? C.platMoving : p.type === 'breaking' ? C.platBreaking : C.platNormal
  const shade =
    p.type === 'moving'
      ? C.platMovingShade
      : p.type === 'breaking'
        ? C.platBreakingShade
        : C.platNormalShade

  // Shadow/depth
  ctx.fillStyle = shade
  ctx.fillRect(p.x, p.y + 4, p.w, PLATFORM_H - 2)
  // Top face
  ctx.fillStyle = top
  ctx.fillRect(p.x, p.y, p.w, PLATFORM_H - 3)
  // Shine strip
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.fillRect(p.x + 3, p.y + 1, p.w - 6, 3)
  // End caps
  ctx.fillStyle = shade
  ctx.fillRect(p.x, p.y, 3, PLATFORM_H - 3)
  ctx.fillRect(p.x + p.w - 3, p.y, 3, PLATFORM_H - 3)
}

function drawStar(ctx: CanvasRenderingContext2D, star: Star, frame: number) {
  const pulse = Math.sin(frame * 0.08 + star.id * 1.3) * 1.5
  const r = STAR_RADIUS + pulse
  const { x, y } = star

  ctx.beginPath()
  ctx.arc(x, y, r + 4, 0, Math.PI * 2)
  ctx.fillStyle = C.starGlow
  ctx.fill()

  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.42
    const px = x + Math.cos(a) * rad
    const py = y + Math.sin(a) * rad
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = C.star
  ctx.fill()
}

function drawBackground(ctx: CanvasRenderingContext2D, cameraY: number) {
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // Twinkling background dots
  ctx.fillStyle = 'rgba(150,170,255,0.25)'
  for (let i = 0; i < 55; i++) {
    const sx = (i * 7919 + 17) % CANVAS_WIDTH
    const worldY = (i * 5003 + 31) % 4000
    const screenY =
      (((worldY - Math.abs(cameraY) * 0.2) % CANVAS_HEIGHT) + CANVAS_HEIGHT) % CANVAS_HEIGHT
    const size = i % 5 === 0 ? 2 : 1
    ctx.fillRect(sx, screenY, size, size)
  }
}

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  const score = totalScore(state)
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = C.hudLabel
  ctx.font = 'bold 12px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('SCORE', 12, 20)
  ctx.fillStyle = C.hud
  ctx.font = 'bold 22px monospace'
  ctx.fillText(String(score), 12, 42)

  ctx.fillStyle = C.hudLabel
  ctx.font = 'bold 11px monospace'
  ctx.textAlign = 'right'
  ctx.fillText('BEST', CANVAS_WIDTH - 12, 20)
  ctx.fillStyle = C.hud
  ctx.font = 'bold 18px monospace'
  ctx.fillText(String(state.highScore), CANVAS_WIDTH - 12, 39)

  ctx.textAlign = 'left'
}

function drawGameOver(ctx: CanvasRenderingContext2D, state: GameState) {
  const score = totalScore(state)
  const cx = CANVAS_WIDTH / 2
  const cy = CANVAS_HEIGHT / 2

  ctx.fillStyle = C.overBg
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = C.overTitle
  ctx.font = 'bold 36px monospace'
  ctx.fillText('GAME OVER', cx, cy - 55)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px monospace'
  ctx.fillText(`Score: ${score}`, cx, cy)

  if (score > 0 && score >= state.highScore) {
    ctx.fillStyle = C.overTitle
    ctx.font = 'bold 15px monospace'
    ctx.fillText('★ NEW HIGH SCORE ★', cx, cy + 30)
  }

  ctx.fillStyle = '#9fa8da'
  ctx.font = '15px monospace'
  ctx.fillText('Space / tap to play again', cx, cy + 68)

  ctx.textAlign = 'left'
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  frame: number,
  squish: number
) {
  const { cameraY, ball, platforms, stars } = state

  drawBackground(ctx, cameraY)

  ctx.save()
  ctx.translate(0, -cameraY)

  // Platforms
  for (const p of platforms) {
    if (p.y + PLATFORM_H < cameraY - 10 || p.y > cameraY + CANVAS_HEIGHT + 10) continue
    drawPlatform(ctx, p)
  }

  // Stars
  for (const s of stars) {
    if (s.y < cameraY - 20 || s.y > cameraY + CANVAS_HEIGHT + 20) continue
    drawStar(ctx, s, frame)
  }

  // Ball with optional squish on bounce
  const squishX = 1 + squish * 0.25
  const squishY = 1 - squish * 0.25
  drawBall(ctx, ball.x, ball.y, squishX, squishY)

  ctx.restore()

  drawHUD(ctx, state)
  if (state.gameOver) drawGameOver(ctx, state)
}

export default function BounceGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState | null>(null)
  const inputRef = useRef({ left: false, right: false })
  const frameRef = useRef(0)
  const rafRef = useRef(0)
  const prevVyRef = useRef(0)
  const squishRef = useRef(0)

  const getStoredHigh = () => {
    try {
      return parseInt(localStorage.getItem('bounce-hs') ?? '0', 10) || 0
    } catch {
      return 0
    }
  }

  const saveHigh = (score: number) => {
    try {
      if (score > getStoredHigh()) localStorage.setItem('bounce-hs', String(score))
    } catch {
      // ignore
    }
  }

  const newGame = useCallback(() => {
    stateRef.current = createInitialState(
      Math.max(getStoredHigh(), stateRef.current?.highScore ?? 0)
    )
    squishRef.current = 0
    prevVyRef.current = 0
  }, [])

  // Game loop
  useEffect(() => {
    stateRef.current = createInitialState(getStoredHigh())

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function loop() {
      const state = stateRef.current!

      if (!state.gameOver) {
        const prevVy = prevVyRef.current
        stateRef.current = stepGame(state, inputRef.current)
        const nextVy = stateRef.current.ball.vy

        // Detect bounce: vy flipped from positive to negative
        if (prevVy > 2 && nextVy < 0) squishRef.current = 1
        prevVyRef.current = nextVy

        if (stateRef.current.gameOver) saveHigh(totalScore(stateRef.current))
      }

      squishRef.current = Math.max(0, squishRef.current - 0.07)
      renderFrame(ctx!, stateRef.current!, frameRef.current++, squishRef.current)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keyboard input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const down = e.type === 'keydown'
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        inputRef.current.left = down
        if (down) e.preventDefault()
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        inputRef.current.right = down
        if (down) e.preventDefault()
      }
      if (down && (e.key === ' ' || e.key === 'Enter') && stateRef.current?.gameOver) {
        newGame()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [newGame])

  const handleCanvasClick = () => {
    if (stateRef.current?.gameOver) newGame()
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="rounded-xl border border-indigo-900 shadow-2xl"
        style={{ maxWidth: '100%', height: 'auto', cursor: 'none', touchAction: 'none' }}
        onClick={handleCanvasClick}
      />

      {/* On-screen controls for mobile */}
      <div className="flex select-none gap-6">
        <button
          className="h-14 w-20 rounded-xl border border-slate-600 bg-slate-800 text-2xl text-white shadow-lg active:bg-slate-600"
          onPointerDown={() => (inputRef.current.left = true)}
          onPointerUp={() => (inputRef.current.left = false)}
          onPointerCancel={() => (inputRef.current.left = false)}
          onPointerLeave={() => (inputRef.current.left = false)}
          aria-label="Move left"
        >
          ←
        </button>
        <button
          className="h-14 w-20 rounded-xl border border-slate-600 bg-slate-800 text-2xl text-white shadow-lg active:bg-slate-600"
          onPointerDown={() => (inputRef.current.right = true)}
          onPointerUp={() => (inputRef.current.right = false)}
          onPointerCancel={() => (inputRef.current.right = false)}
          onPointerLeave={() => (inputRef.current.right = false)}
          aria-label="Move right"
        >
          →
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Arrow keys / A–D to move &nbsp;·&nbsp; Bounce on platforms &nbsp;·&nbsp; Collect ★ stars
      </p>
    </div>
  )
}
