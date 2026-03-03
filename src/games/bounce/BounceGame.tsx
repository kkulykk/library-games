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

// Doodle Jump-inspired colour palette
const C = {
  sky1: '#C8E8F8',
  sky2: '#EEF6FF',
  dot: 'rgba(120, 180, 220, 0.38)',
  platNormal: '#5AB552',
  platNormalShade: '#3D8030',
  platNormalShine: 'rgba(255,255,255,0.5)',
  platMoving: '#4A7FC1',
  platMovingShade: '#2A5598',
  platMovingShine: 'rgba(255,255,255,0.38)',
  platBreaking: '#C4883A',
  platBreakingShade: '#9A6018',
  platBreakingShine: 'rgba(255,255,255,0.22)',
  springTop: '#FFD700',
  springBottom: '#E8A800',
  springLine: '#AA7A00',
  doodleBody: '#9EDA8E',
  doodleOutline: '#5A9A50',
  doodleNose: '#76C468',
  star: '#FFD600',
  starGlow: 'rgba(255,214,0,0.22)',
  hudScore: '#1A3A5C',
  hudBest: '#4A7099',
  overBg: 'rgba(210,235,255,0.92)',
  overPanel: 'rgba(255,255,255,0.96)',
  overBorder: 'rgba(70,130,190,0.35)',
  overTitle: '#1A3A5C',
  overText: '#2A5080',
  overSub: '#5A80A0',
}

/** Draw a rounded-rectangle path (no fill/stroke applied yet). */
function rrect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function drawDoodle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  vx: number,
  squishX: number,
  squishY: number
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(squishX, squishY)

  const bw = BALL_RADIUS * 1.35
  const bh = BALL_RADIUS

  // Drop shadow
  ctx.beginPath()
  ctx.ellipse(2, 3, bw, bh * 0.45, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.10)'
  ctx.fill()

  // Body
  ctx.beginPath()
  ctx.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2)
  ctx.fillStyle = C.doodleBody
  ctx.fill()
  ctx.strokeStyle = C.doodleOutline
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Body highlight (top-left arc)
  ctx.beginPath()
  ctx.ellipse(-3, -3, bw * 0.55, bh * 0.45, -0.5, Math.PI, Math.PI * 1.7)
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 2.5
  ctx.stroke()

  // Pupils shift with horizontal movement
  const pupilShift = vx > 0.5 ? 1.5 : vx < -0.5 ? -1.5 : 0
  const eyeY = -3

  for (const ex of [-6, 6]) {
    // White of eye
    ctx.beginPath()
    ctx.arc(ex, eyeY, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = 'white'
    ctx.fill()
    // Pupil
    ctx.beginPath()
    ctx.arc(ex + pupilShift, eyeY + 0.5, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = '#111'
    ctx.fill()
    // Eye shine
    ctx.beginPath()
    ctx.arc(ex + pupilShift - 1, eyeY - 1, 1, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fill()
  }

  // Nose
  ctx.beginPath()
  ctx.ellipse(0, 5, 4, 2.5, 0, 0, Math.PI * 2)
  ctx.fillStyle = C.doodleNose
  ctx.fill()

  ctx.restore()
}

function drawSpring(ctx: CanvasRenderingContext2D, cx: number, topY: number) {
  const sw = 14
  const sh = 11
  // Body
  ctx.fillStyle = C.springBottom
  ctx.fillRect(cx - sw / 2, topY - sh, sw, sh)
  // Top highlight
  ctx.fillStyle = C.springTop
  ctx.fillRect(cx - sw / 2, topY - sh, sw, sh * 0.42)
  // Coil lines
  ctx.strokeStyle = C.springLine
  ctx.lineWidth = 1.5
  for (let i = 1; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(cx - sw / 2, topY - sh + (sh / 3) * i)
    ctx.lineTo(cx + sw / 2, topY - sh + (sh / 3) * i)
    ctx.stroke()
  }
  // Rounded cap
  ctx.beginPath()
  ctx.ellipse(cx, topY - sh, sw / 2, 2, 0, 0, Math.PI * 2)
  ctx.fillStyle = C.springTop
  ctx.fill()
}

function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform) {
  const h = PLATFORM_H
  const r = 6

  let main: string, shade: string, shine: string
  if (p.type === 'moving') {
    main = C.platMoving
    shade = C.platMovingShade
    shine = C.platMovingShine
  } else if (p.type === 'breaking') {
    main = C.platBreaking
    shade = C.platBreakingShade
    shine = C.platBreakingShine
  } else {
    // normal or spring — both green
    main = C.platNormal
    shade = C.platNormalShade
    shine = C.platNormalShine
  }

  // Main body
  rrect(ctx, p.x, p.y, p.w, h, r)
  ctx.fillStyle = main
  ctx.fill()

  // Bottom shade (clipped to platform shape)
  ctx.save()
  rrect(ctx, p.x, p.y, p.w, h, r)
  ctx.clip()
  ctx.fillStyle = shade
  ctx.fillRect(p.x, p.y + h * 0.55, p.w, h)
  ctx.restore()

  // Top shine strip
  rrect(ctx, p.x + 5, p.y + 2, p.w - 10, 3, 2)
  ctx.fillStyle = shine
  ctx.fill()

  // Spring pad on top
  if (p.type === 'spring') {
    drawSpring(ctx, p.x + p.w / 2, p.y)
  }
}

function drawStar(ctx: CanvasRenderingContext2D, star: Star, frame: number) {
  const pulse = Math.sin(frame * 0.07 + star.id * 1.5) * 1.2
  const r = STAR_RADIUS - 2 + pulse
  const { x, y } = star

  // Glow
  ctx.beginPath()
  ctx.arc(x, y, r + 5, 0, Math.PI * 2)
  ctx.fillStyle = C.starGlow
  ctx.fill()

  // Star shape
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
  ctx.strokeStyle = 'rgba(160,110,0,0.5)'
  ctx.lineWidth = 0.8
  ctx.stroke()
}

function drawBackground(ctx: CanvasRenderingContext2D, cameraY: number) {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
  grad.addColorStop(0, C.sky1)
  grad.addColorStop(1, C.sky2)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // Dot grid — graph-paper texture
  const spacing = 38
  const oy = ((-cameraY % spacing) + spacing) % spacing
  ctx.fillStyle = C.dot
  for (let dy = oy - spacing; dy < CANVAS_HEIGHT + spacing; dy += spacing) {
    for (let dx = spacing / 2; dx < CANVAS_WIDTH; dx += spacing) {
      ctx.fillRect(dx - 1, dy - 1, 2, 2)
    }
  }
}

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  const score = totalScore(state)
  ctx.textBaseline = 'alphabetic'

  // Score — left
  ctx.fillStyle = C.hudScore
  ctx.font = 'bold 11px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('SCORE', 14, 22)
  ctx.font = 'bold 28px sans-serif'
  ctx.fillText(String(score), 14, 50)

  // Best — right
  ctx.fillStyle = C.hudBest
  ctx.font = 'bold 11px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('BEST', CANVAS_WIDTH - 14, 22)
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText(String(state.highScore), CANVAS_WIDTH - 14, 46)

  ctx.textAlign = 'left'
}

function drawGameOver(ctx: CanvasRenderingContext2D, state: GameState) {
  const score = totalScore(state)
  const cx = CANVAS_WIDTH / 2
  const cy = CANVAS_HEIGHT / 2

  // Frosted overlay
  ctx.fillStyle = C.overBg
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // Panel
  rrect(ctx, cx - 135, cy - 95, 270, 200, 18)
  ctx.fillStyle = C.overPanel
  ctx.fill()
  ctx.strokeStyle = C.overBorder
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = C.overTitle
  ctx.font = 'bold 34px sans-serif'
  ctx.fillText('GAME OVER', cx, cy - 48)

  ctx.fillStyle = C.overText
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText(`Score: ${score}`, cx, cy + 2)

  if (score > 0 && score >= state.highScore) {
    ctx.fillStyle = '#F9A000'
    ctx.font = 'bold 14px sans-serif'
    ctx.fillText('★  NEW HIGH SCORE  ★', cx, cy + 30)
  }

  ctx.fillStyle = C.overSub
  ctx.font = '14px sans-serif'
  ctx.fillText('Tap or press Space to play again', cx, cy + 68)

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

  for (const p of platforms) {
    if (p.y + PLATFORM_H < cameraY - 20 || p.y > cameraY + CANVAS_HEIGHT + 20) continue
    drawPlatform(ctx, p)
  }

  for (const s of stars) {
    if (s.y < cameraY - 20 || s.y > cameraY + CANVAS_HEIGHT + 20) continue
    drawStar(ctx, s, frame)
  }

  const squishX = 1 + squish * 0.28
  const squishY = 1 - squish * 0.28
  drawDoodle(ctx, ball.x, ball.y, ball.vx, squishX, squishY)

  ctx.restore()

  drawHUD(ctx, state)
  if (state.gameOver) drawGameOver(ctx, state)
}

export default function BounceGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState | null>(null)
  const inputRef = useRef<{ left: boolean; right: boolean; analogX?: number }>({
    left: false,
    right: false,
  })
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

  // Main game loop
  useEffect(() => {
    stateRef.current = createInitialState(getStoredHigh())

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Prevent iOS scroll interference
    const prevent = (e: TouchEvent) => e.preventDefault()
    canvas.addEventListener('touchmove', prevent, { passive: false })
    canvas.addEventListener('touchstart', prevent, { passive: false })

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
    return () => {
      cancelAnimationFrame(rafRef.current)
      canvas.removeEventListener('touchmove', prevent)
      canvas.removeEventListener('touchstart', prevent)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keyboard controls
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

  // Pointer/touch controls — finger position maps to horizontal direction
  const getAnalogX = (e: React.PointerEvent<HTMLCanvasElement>): number => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const cx = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH
    return Math.max(-1, Math.min(1, (cx - CANVAS_WIDTH / 2) / (CANVAS_WIDTH / 2)))
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    if (stateRef.current?.gameOver) {
      newGame()
      return
    }
    inputRef.current.analogX = getAnalogX(e)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons === 0) return
    inputRef.current.analogX = getAnalogX(e)
  }

  const handlePointerUp = () => {
    inputRef.current.analogX = undefined
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="rounded-2xl shadow-2xl"
        style={{
          maxWidth: '100%',
          height: 'auto',
          cursor: 'none',
          touchAction: 'none',
          userSelect: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <p className="text-sm text-gray-400">
        Arrow keys / A–D on desktop &nbsp;·&nbsp; Slide finger left/right on mobile
      </p>
    </div>
  )
}
