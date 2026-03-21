'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  createBall,
  createPaddle,
  createBricks,
  moveBall,
  bounceWalls,
  checkPaddleCollision,
  checkBrickCollisions,
  isBallLost,
  isLevelComplete,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PADDLE_WIDTH,
} from './logic'

export function BreakoutGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef({
    ball: createBall(),
    paddle: createPaddle(),
    bricks: createBricks(),
    score: 0,
    lives: 3,
    running: false,
    gameOver: false,
    won: false,
    level: 1,
  })
  const [displayState, setDisplayState] = useState({
    score: 0,
    lives: 3,
    running: false,
    gameOver: false,
    won: false,
    level: 1,
  })
  const rafRef = useRef<number | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { ball, paddle, bricks } = stateRef.current

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Background
    ctx.fillStyle = '#18181b'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Bricks
    bricks.forEach((brick) => {
      if (!brick.alive) return
      ctx.fillStyle = brick.color
      ctx.beginPath()
      ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 3)
      ctx.fill()
    })

    // Paddle
    ctx.fillStyle = '#e4e4e7'
    ctx.beginPath()
    ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 6)
    ctx.fill()

    // Ball
    ctx.fillStyle = '#f4f4f5'
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  const gameLoop = useCallback(() => {
    const s = stateRef.current
    if (!s.running) return

    s.ball = moveBall(s.ball)
    s.ball = bounceWalls(s.ball)
    s.ball = checkPaddleCollision(s.ball, s.paddle)

    const { ball: newBall, bricks: newBricks, points } = checkBrickCollisions(s.ball, s.bricks)
    s.ball = newBall
    s.bricks = newBricks
    s.score += points

    if (isBallLost(s.ball)) {
      s.lives -= 1
      if (s.lives <= 0) {
        s.running = false
        s.gameOver = true
        setDisplayState((prev) => ({ ...prev, lives: 0, running: false, gameOver: true }))
        draw()
        return
      }
      s.ball = createBall()
      setDisplayState((prev) => ({ ...prev, lives: s.lives, score: s.score }))
    }

    if (isLevelComplete(s.bricks)) {
      s.level += 1
      s.bricks = createBricks()
      const speed = Math.min(4 + s.level, 10)
      s.ball = { ...createBall(), vx: speed * (s.ball.vx > 0 ? 1 : -1), vy: -speed }
      setDisplayState((prev) => ({ ...prev, score: s.score, level: s.level }))
    }

    if (points > 0) {
      setDisplayState((prev) => ({ ...prev, score: s.score }))
    }

    draw()
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [draw])

  // Mouse/touch paddle control
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const scale = CANVAS_WIDTH / rect.width
      const mouseX = (e.clientX - rect.left) * scale
      stateRef.current.paddle.x = Math.max(
        0,
        Math.min(CANVAS_WIDTH - PADDLE_WIDTH, mouseX - PADDLE_WIDTH / 2)
      )
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const scale = CANVAS_WIDTH / rect.width
      const touchX = (e.touches[0].clientX - rect.left) * scale
      stateRef.current.paddle.x = Math.max(
        0,
        Math.min(CANVAS_WIDTH - PADDLE_WIDTH, touchX - PADDLE_WIDTH / 2)
      )
    }
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  const startGame = () => {
    stateRef.current = {
      ball: createBall(),
      paddle: createPaddle(),
      bricks: createBricks(),
      score: 0,
      lives: 3,
      running: true,
      gameOver: false,
      won: false,
      level: 1,
    }
    setDisplayState({ score: 0, lives: 3, running: true, gameOver: false, won: false, level: 1 })
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(gameLoop)
  }

  useEffect(() => {
    draw()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [draw])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-md items-center justify-between text-sm font-medium">
        <span>Score: {displayState.score}</span>
        <span>Level: {displayState.level}</span>
        <span>{'❤️'.repeat(displayState.lives)}</span>
      </div>

      <div
        className="relative overflow-hidden rounded-xl border-2 border-border"
        style={{ maxWidth: CANVAS_WIDTH }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block w-full cursor-none"
        />
        {!displayState.running && !displayState.gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
            <p className="text-2xl font-extrabold text-white">Breakout</p>
            <button
              onClick={startGame}
              className="rounded-lg bg-white px-6 py-2 font-bold text-zinc-900"
            >
              Start Game
            </button>
            <p className="text-xs text-white/70">Move mouse to control paddle</p>
          </div>
        )}
        {displayState.gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
            <p className="text-2xl font-extrabold text-white">Game Over</p>
            <p className="text-white">Final Score: {displayState.score}</p>
            <button
              onClick={startGame}
              className="rounded-lg bg-white px-6 py-2 font-bold text-zinc-900"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Move your mouse over the game to control the paddle
      </p>
    </div>
  )
}
