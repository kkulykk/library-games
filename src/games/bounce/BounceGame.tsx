'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  BALL_RADIUS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  TILE_SIZE,
  T_BRICK,
  T_BRICK2,
  T_SPIKE,
  T_SPRING,
  T_FINISH,
  TOTAL_LEVELS,
  LEVEL_BONUS,
  GameState,
  createInitialState,
  stepGame,
  advanceLevel,
} from './logic'

/* ── Nokia-style colour palette ──────────────────── */
const C = {
  bg: '#00B4D8',
  brickFace: '#C43C2C',
  brickMortar: '#8B2215',
  brickFace2: '#A85030',
  brickMortar2: '#6B1810',
  ballMain: '#E03030',
  ballShade: '#A01818',
  ballShine: '#FF7070',
  ringOuter: '#FFD700',
  ringInner: '#FFA500',
  ringCollected: 'rgba(255,215,0,0.3)',
  springBase: '#888888',
  springCoil: '#DDDD00',
  springTop: '#FFEE44',
  spikeBody: '#666666',
  spikeTip: '#999999',
  finishGlow: '#44FF44',
  finishCore: '#22CC22',
  hudBg: 'rgba(0,0,0,0.65)',
  hudText: '#FFFFFF',
  hudScore: '#FFD700',
  overBg: 'rgba(0,0,0,0.75)',
  overPanel: '#1A1A2E',
  overBorder: '#C43C2C',
  overTitle: '#FFFFFF',
  overText: '#CCCCCC',
  overHighlight: '#FFD700',
  btnBg: '#2A2A3E',
  btnBorder: '#555577',
  btnText: '#FFFFFF',
  btnActive: '#3A3A5E',
}

/* ── drawing helpers ─────────────────────────────── */

function drawBrickTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: 'normal' | 'dark'
) {
  const face = variant === 'dark' ? C.brickFace2 : C.brickFace
  const mortar = variant === 'dark' ? C.brickMortar2 : C.brickMortar

  // Mortar background
  ctx.fillStyle = mortar
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)

  // Brick faces — standard running bond pattern
  ctx.fillStyle = face
  const bh = 7 // brick height (with 1px mortar gap)
  const bw = 15 // brick width (with 1px mortar gap)

  for (let row = 0; row < 4; row++) {
    const by = y + row * (bh + 1)
    const offset = row % 2 === 0 ? 0 : 8
    for (let bx = x + offset - 8; bx < x + TILE_SIZE; bx += bw + 1) {
      const clampLeft = Math.max(bx, x)
      const clampRight = Math.min(bx + bw, x + TILE_SIZE)
      if (clampRight > clampLeft) {
        ctx.fillRect(clampLeft, by, clampRight - clampLeft, bh)
      }
    }
  }

  // Subtle top-left highlight for 3D feel
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(x, y, TILE_SIZE, 1)
  ctx.fillRect(x, y, 1, TILE_SIZE)
}

function drawSpikeTile(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const ts = TILE_SIZE
  const spikes = 3
  const sw = ts / spikes

  for (let i = 0; i < spikes; i++) {
    const sx = x + i * sw
    ctx.beginPath()
    ctx.moveTo(sx, y + ts)
    ctx.lineTo(sx + sw / 2, y + 4)
    ctx.lineTo(sx + sw, y + ts)
    ctx.closePath()
    ctx.fillStyle = C.spikeBody
    ctx.fill()

    // Tip highlight
    ctx.beginPath()
    ctx.moveTo(sx + sw / 2 - 2, y + 8)
    ctx.lineTo(sx + sw / 2, y + 4)
    ctx.lineTo(sx + sw / 2 + 2, y + 8)
    ctx.closePath()
    ctx.fillStyle = C.spikeTip
    ctx.fill()
  }
}

function drawSpringTile(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const ts = TILE_SIZE
  const cx = x + ts / 2

  // Base
  ctx.fillStyle = C.springBase
  ctx.fillRect(cx - 10, y + ts - 6, 20, 6)

  // Coils
  ctx.strokeStyle = C.springCoil
  ctx.lineWidth = 3
  const coils = 4
  const coilH = (ts - 10) / coils
  for (let i = 0; i < coils; i++) {
    const cy = y + ts - 8 - i * coilH
    ctx.beginPath()
    ctx.moveTo(cx - 8, cy)
    ctx.lineTo(cx + 8, cy - coilH * 0.5)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx + 8, cy - coilH * 0.5)
    ctx.lineTo(cx - 8, cy - coilH)
    ctx.stroke()
  }

  // Top cap
  ctx.fillStyle = C.springTop
  ctx.fillRect(cx - 10, y + 2, 20, 5)
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillRect(cx - 10, y + 2, 20, 2)
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
  collected: boolean
) {
  if (collected) return
  const pulse = Math.sin(frame * 0.08) * 1.5
  const rx = x + TILE_SIZE / 2
  const ry = y + TILE_SIZE / 2
  const rr = 9 + pulse

  // Glow
  ctx.beginPath()
  ctx.arc(rx, ry, rr + 4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,215,0,0.15)'
  ctx.fill()

  // Outer ring
  ctx.beginPath()
  ctx.arc(rx, ry, rr, 0, Math.PI * 2)
  ctx.strokeStyle = C.ringOuter
  ctx.lineWidth = 3.5
  ctx.stroke()

  // Inner highlight
  ctx.beginPath()
  ctx.arc(rx, ry, rr - 2, -0.8, 0.8)
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawFinish(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const cx = x + TILE_SIZE / 2
  const cy = y + TILE_SIZE / 2
  const pulse = Math.sin(frame * 0.06) * 4

  // Glow
  ctx.beginPath()
  ctx.arc(cx, cy, 16 + pulse, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(68,255,68,0.15)'
  ctx.fill()

  // Core
  ctx.beginPath()
  ctx.arc(cx, cy, 10 + pulse * 0.3, 0, Math.PI * 2)
  ctx.fillStyle = C.finishGlow
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, 6, 0, Math.PI * 2)
  ctx.fillStyle = C.finishCore
  ctx.fill()

  // Arrow/checkmark
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(cx - 4, cy)
  ctx.lineTo(cx - 1, cy + 3)
  ctx.lineTo(cx + 5, cy - 4)
  ctx.stroke()
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  squish: number,
  deathTimer: number
) {
  if (deathTimer > 0 && Math.floor(deathTimer / 3) % 2 === 0) return // flash

  ctx.save()
  ctx.translate(x, y)
  const sx = 1 + squish * 0.2
  const sy = 1 - squish * 0.2
  ctx.scale(sx, sy)

  const r = BALL_RADIUS

  // Shadow
  ctx.beginPath()
  ctx.ellipse(1.5, 2, r, r * 0.35, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fill()

  // Main ball
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = C.ballMain
  ctx.fill()

  // Bottom shade
  ctx.beginPath()
  ctx.arc(0, 1, r, 0, Math.PI)
  ctx.fillStyle = C.ballShade
  ctx.fill()

  // Top highlight
  ctx.beginPath()
  ctx.arc(-2, -3, r * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = C.ballShine
  ctx.fill()

  // Tiny white shine
  ctx.beginPath()
  ctx.arc(-3, -4, 2, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fill()

  ctx.restore()
}

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  const hudH = 28

  // Background bar
  ctx.fillStyle = C.hudBg
  ctx.fillRect(0, 0, CANVAS_WIDTH, hudH)

  ctx.textBaseline = 'middle'
  ctx.font = 'bold 13px monospace'

  // Lives — left side
  const livesX = 10
  // Draw mini ball icon
  ctx.beginPath()
  ctx.arc(livesX + 6, hudH / 2, 5, 0, Math.PI * 2)
  ctx.fillStyle = C.ballMain
  ctx.fill()
  ctx.fillStyle = C.hudText
  ctx.textAlign = 'left'
  ctx.fillText(`x${state.lives}`, livesX + 14, hudH / 2 + 1)

  // Rings — center
  const totalRings = state.rings.length
  const collected = state.rings.filter((r) => r.collected).length
  ctx.textAlign = 'center'
  // Mini ring icon
  ctx.beginPath()
  ctx.arc(CANVAS_WIDTH / 2 - 30, hudH / 2, 5, 0, Math.PI * 2)
  ctx.strokeStyle = C.ringOuter
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = C.hudText
  ctx.fillText(`${collected}/${totalRings}`, CANVAS_WIDTH / 2, hudH / 2 + 1)

  // Score — right side
  ctx.textAlign = 'right'
  ctx.fillStyle = C.hudScore
  ctx.fillText(String(state.score).padStart(7, '0'), CANVAS_WIDTH - 10, hudH / 2 + 1)

  // Level indicator
  ctx.textAlign = 'center'
  ctx.fillStyle = C.hudText
  ctx.font = 'bold 11px monospace'
  ctx.fillText(`LVL ${state.level + 1}`, CANVAS_WIDTH / 2 + 80, hudH / 2 + 1)

  ctx.textAlign = 'left'
}

function drawOverlayPanel(
  ctx: CanvasRenderingContext2D,
  title: string,
  lines: string[],
  actionText: string,
  highlight?: string
) {
  const cx = CANVAS_WIDTH / 2
  const cy = CANVAS_HEIGHT / 2
  const pw = 280
  const ph = 180

  // Dim background
  ctx.fillStyle = C.overBg
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // Panel
  ctx.fillStyle = C.overPanel
  ctx.strokeStyle = C.overBorder
  ctx.lineWidth = 3
  ctx.fillRect(cx - pw / 2, cy - ph / 2, pw, ph)
  ctx.strokeRect(cx - pw / 2, cy - ph / 2, pw, ph)

  // Inner border
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 1
  ctx.strokeRect(cx - pw / 2 + 4, cy - ph / 2 + 4, pw - 8, ph - 8)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // Title
  ctx.fillStyle = C.overTitle
  ctx.font = 'bold 28px monospace'
  ctx.fillText(title, cx, cy - ph / 2 + 42)

  // Lines
  ctx.fillStyle = C.overText
  ctx.font = '14px monospace'
  let ly = cy - 10
  for (const line of lines) {
    ctx.fillText(line, cx, ly)
    ly += 22
  }

  // Highlight
  if (highlight) {
    ctx.fillStyle = C.overHighlight
    ctx.font = 'bold 14px monospace'
    ctx.fillText(highlight, cx, ly)
    ly += 22
  }

  // Action
  ctx.fillStyle = C.overText
  ctx.font = '12px monospace'
  ctx.fillText(actionText, cx, cy + ph / 2 - 18)

  ctx.textAlign = 'left'
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  frame: number,
  squish: number
) {
  const { cameraX, cameraY, tiles, levelWidth, levelHeight, ball, rings } = state

  // ── background ──
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  ctx.save()
  ctx.translate(-cameraX, -cameraY)

  // ── tiles ──
  const startCol = Math.max(0, Math.floor(cameraX / TILE_SIZE) - 1)
  const endCol = Math.min(levelWidth, Math.ceil((cameraX + CANVAS_WIDTH) / TILE_SIZE) + 1)
  const startRow = Math.max(0, Math.floor(cameraY / TILE_SIZE) - 1)
  const endRow = Math.min(levelHeight, Math.ceil((cameraY + CANVAS_HEIGHT) / TILE_SIZE) + 1)

  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      const t = tiles[row]?.[col] ?? 0
      const tx = col * TILE_SIZE
      const ty = row * TILE_SIZE

      switch (t) {
        case T_BRICK:
          drawBrickTile(ctx, tx, ty, 'normal')
          break
        case T_BRICK2:
          drawBrickTile(ctx, tx, ty, 'dark')
          break
        case T_SPIKE:
          drawSpikeTile(ctx, tx, ty)
          break
        case T_SPRING:
          drawSpringTile(ctx, tx, ty)
          break
        case T_FINISH:
          drawFinish(ctx, tx, ty, frame)
          break
      }
    }
  }

  // ── rings ──
  for (const ring of rings) {
    const rx = ring.col * TILE_SIZE
    const ry = ring.row * TILE_SIZE
    if (rx + TILE_SIZE < cameraX - 32 || rx > cameraX + CANVAS_WIDTH + 32) continue
    if (ry + TILE_SIZE < cameraY - 32 || ry > cameraY + CANVAS_HEIGHT + 32) continue
    drawRing(ctx, rx, ry, frame, ring.collected)
  }

  // ── ball ──
  drawBall(ctx, ball.x, ball.y, squish, state.deathTimer)

  ctx.restore()

  // ── HUD ──
  drawHUD(ctx, state)

  // ── overlay screens ──
  if (state.gameOver) {
    drawOverlayPanel(ctx, 'GAME OVER', [`Score: ${state.score}`], 'Tap or press Space to retry')
  } else if (state.won) {
    drawOverlayPanel(
      ctx,
      'YOU WIN!',
      [`Final Score: ${state.score}`, `All ${TOTAL_LEVELS} levels cleared!`],
      'Tap or press Space to play again',
      '★ CONGRATULATIONS ★'
    )
  } else if (state.levelComplete) {
    drawOverlayPanel(
      ctx,
      'LEVEL CLEAR!',
      [`Score: ${state.score}`],
      'Tap or press Space for next level',
      `+${LEVEL_BONUS} LEVEL BONUS`
    )
  }
}

/* ── main component ──────────────────────────────── */

export default function BounceGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState | null>(null)
  const inputRef = useRef<{ left: boolean; right: boolean; jump: boolean }>({
    left: false,
    right: false,
    jump: false,
  })
  const frameRef = useRef(0)
  const rafRef = useRef(0)
  const squishRef = useRef(0)

  const newGame = useCallback(() => {
    stateRef.current = createInitialState()
    squishRef.current = 0
  }, [])

  const nextLevel = useCallback(() => {
    if (!stateRef.current) return
    stateRef.current = advanceLevel(stateRef.current)
    squishRef.current = 0
  }, [])

  // ── game loop ──
  useEffect(() => {
    stateRef.current = createInitialState()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const prevent = (e: TouchEvent) => e.preventDefault()
    canvas.addEventListener('touchmove', prevent, { passive: false })
    canvas.addEventListener('touchstart', prevent, { passive: false })

    function loop() {
      const state = stateRef.current!

      if (!state.gameOver && !state.levelComplete && !state.won) {
        const prevVy = state.ball.vy
        stateRef.current = stepGame(state, inputRef.current)

        // Detect bounce for squish animation
        if (stateRef.current.justBounced && prevVy > 1) {
          squishRef.current = 1
        }
      }

      squishRef.current = Math.max(0, squishRef.current - 0.08)
      renderFrame(ctx, stateRef.current!, frameRef.current++, squishRef.current)
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      canvas.removeEventListener('touchmove', prevent)
      canvas.removeEventListener('touchstart', prevent)
    }
  }, [])

  // ── keyboard ──
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
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        inputRef.current.jump = down
        if (down) e.preventDefault()
      }
      if (down && (e.key === ' ' || e.key === 'Enter')) {
        const s = stateRef.current
        if (s?.gameOver || s?.won) newGame()
        else if (s?.levelComplete) nextLevel()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [newGame, nextLevel])

  // ── on-screen button helpers ──
  const btnDown = (key: 'left' | 'right' | 'jump') => () => {
    inputRef.current[key] = true
    const s = stateRef.current
    if (key === 'jump') {
      if (s?.gameOver || s?.won) newGame()
      else if (s?.levelComplete) nextLevel()
    }
  }
  const btnUp = (key: 'left' | 'right' | 'jump') => () => {
    inputRef.current[key] = false
  }

  const handleCanvasTap = () => {
    const s = stateRef.current
    if (s?.gameOver || s?.won) newGame()
    else if (s?.levelComplete) nextLevel()
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="rounded-lg shadow-2xl"
        style={{
          maxWidth: '100%',
          height: 'auto',
          touchAction: 'none',
          userSelect: 'none',
          imageRendering: 'pixelated',
        }}
        onClick={handleCanvasTap}
      />
      {/* Nokia-style on-screen controls */}
      <div className="flex select-none items-center gap-3" style={{ touchAction: 'none' }}>
        <button
          className="flex h-14 w-14 items-center justify-center rounded-lg text-2xl font-bold transition-colors active:brightness-125"
          style={{
            background: C.btnBg,
            border: `2px solid ${C.btnBorder}`,
            color: C.btnText,
          }}
          onPointerDown={btnDown('left')}
          onPointerUp={btnUp('left')}
          onPointerLeave={btnUp('left')}
          onPointerCancel={btnUp('left')}
          onContextMenu={(e) => e.preventDefault()}
        >
          ◀
        </button>
        <button
          className="flex h-14 w-20 items-center justify-center rounded-lg text-sm font-bold uppercase tracking-wider transition-colors active:brightness-125"
          style={{
            background: C.overBorder,
            border: `2px solid ${C.brickFace}`,
            color: C.btnText,
          }}
          onPointerDown={btnDown('jump')}
          onPointerUp={btnUp('jump')}
          onPointerLeave={btnUp('jump')}
          onPointerCancel={btnUp('jump')}
          onContextMenu={(e) => e.preventDefault()}
        >
          JUMP
        </button>
        <button
          className="flex h-14 w-14 items-center justify-center rounded-lg text-2xl font-bold transition-colors active:brightness-125"
          style={{
            background: C.btnBg,
            border: `2px solid ${C.btnBorder}`,
            color: C.btnText,
          }}
          onPointerDown={btnDown('right')}
          onPointerUp={btnUp('right')}
          onPointerLeave={btnUp('right')}
          onPointerCancel={btnUp('right')}
          onContextMenu={(e) => e.preventDefault()}
        >
          ▶
        </button>
      </div>
      <p className="text-sm text-gray-400">
        Arrow keys / A–D + Space on desktop · On-screen buttons on mobile
      </p>
    </div>
  )
}
