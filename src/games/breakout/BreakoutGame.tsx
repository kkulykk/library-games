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

  const gameLoopRef = useRef<() => void>(() => {})

  const gameLoop = useCallback(() => {
    const s = stateRef.current
    if (!s.running) return

    let ball = moveBall(s.ball)
    ball = bounceWalls(ball)
    ball = checkPaddleCollision(ball, s.paddle)

    const { ball: collidedBall, bricks, points } = checkBrickCollisions(ball, s.bricks)
    ball = collidedBall
    const score = s.score + points
    let { lives, level } = s
    let newBricks = bricks

    if (isBallLost(ball)) {
      lives -= 1
      if (lives <= 0) {
        stateRef.current = {
          ...s,
          ball,
          bricks: newBricks,
          score,
          lives: 0,
          running: false,
          gameOver: true,
        }
        setDisplayState((prev) => ({ ...prev, lives: 0, running: false, gameOver: true }))
        draw()
        return
      }
      ball = createBall()
      setDisplayState((prev) => ({ ...prev, lives, score }))
    }

    if (isLevelComplete(newBricks)) {
      level += 1
      newBricks = createBricks()
      const speed = Math.min(4 + level, 10)
      ball = { ...createBall(), vx: speed * (ball.vx > 0 ? 1 : -1), vy: -speed }
      setDisplayState((prev) => ({ ...prev, score, level }))
    }

    stateRef.current = { ...s, ball, bricks: newBricks, score, lives, level }

    if (points > 0) {
      setDisplayState((prev) => ({ ...prev, score }))
    }

    draw()
    rafRef.current = requestAnimationFrame(() => gameLoopRef.current())
  }, [draw])

  useEffect(() => {
    gameLoopRef.current = gameLoop
  }, [gameLoop])

  // Mouse/touch paddle control
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const scale = CANVAS_WIDTH / rect.width
      const mouseX = (e.clientX - rect.left) * scale
      const x = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, mouseX - PADDLE_WIDTH / 2))
      stateRef.current = { ...stateRef.current, paddle: { ...stateRef.current.paddle, x } }
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const scale = CANVAS_WIDTH / rect.width
      const touchX = (e.touches[0].clientX - rect.left) * scale
      const x = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, touchX - PADDLE_WIDTH / 2))
      stateRef.current = { ...stateRef.current, paddle: { ...stateRef.current.paddle, x } }
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
        className="border-border relative overflow-hidden rounded-xl border-2"
        style={{ maxWidth: CANVAS_WIDTH }}
      >
        <canvas
          data-testid="breakout-board"
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
      <p className="text-muted-foreground text-xs">
        Move your mouse over the game to control the paddle
      </p>
    </div>
  )
}
