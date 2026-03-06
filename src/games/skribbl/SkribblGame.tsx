'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useSkribblRoom } from './useSkribblRoom'
import { getCurrentDrawer, type DrawStroke, type DrawPoint, type GameState } from './logic'

// ─── Drawing Canvas ───────────────────────────────────────────────────────────

const COLORS = [
  '#000000',
  '#FFFFFF',
  '#808080',
  '#C0C0C0',
  '#800000',
  '#FF0000',
  '#FF6600',
  '#FFCC00',
  '#FFFF00',
  '#00FF00',
  '#008000',
  '#00FFFF',
  '#0000FF',
  '#800080',
  '#FF00FF',
  '#FF69B4',
]

const BRUSH_SIZES = [3, 6, 12, 24]

interface CanvasProps {
  strokes: DrawStroke[]
  isDrawer: boolean
  onStrokeComplete: (stroke: DrawStroke) => void
  onClear: () => void
  onUndo: () => void
}

function DrawingCanvas({ strokes, isDrawer, onStrokeComplete, onClear, onUndo }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(6)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [isDrawing, setIsDrawing] = useState(false)
  const currentStrokeRef = useRef<DrawPoint[]>([])

  const drawAll = useCallback(
    (ctx: CanvasRenderingContext2D, allStrokes: DrawStroke[], currentPoints?: DrawPoint[]) => {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

      const toDraw = [...allStrokes]
      if (currentPoints && currentPoints.length > 0) {
        toDraw.push({ points: currentPoints })
      }

      for (const stroke of toDraw) {
        if (stroke.points.length === 0) continue
        ctx.beginPath()
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        const first = stroke.points[0]
        ctx.strokeStyle = first.tool === 'eraser' ? '#FFFFFF' : first.color
        ctx.lineWidth = first.size

        ctx.moveTo(first.x, first.y)
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
        }
        if (stroke.points.length === 1) {
          ctx.lineTo(first.x + 0.1, first.y + 0.1)
        }
        ctx.stroke()
      }
    },
    []
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawAll(ctx, strokes)
  }, [strokes, drawAll])

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function handleStart(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawer) return
    e.preventDefault()
    const pos = getPos(e)
    if (!pos) return
    setIsDrawing(true)
    const point: DrawPoint = {
      x: pos.x,
      y: pos.y,
      color: tool === 'eraser' ? '#FFFFFF' : color,
      size: brushSize,
      tool,
    }
    currentStrokeRef.current = [point]

    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawAll(ctx, strokes, currentStrokeRef.current)
  }

  function handleMove(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing || !isDrawer) return
    e.preventDefault()
    const pos = getPos(e)
    if (!pos) return
    const point: DrawPoint = {
      x: pos.x,
      y: pos.y,
      color: tool === 'eraser' ? '#FFFFFF' : color,
      size: brushSize,
      tool,
    }
    currentStrokeRef.current.push(point)

    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawAll(ctx, strokes, currentStrokeRef.current)
  }

  function handleEnd() {
    if (!isDrawing || !isDrawer) return
    setIsDrawing(false)
    if (currentStrokeRef.current.length > 0) {
      onStrokeComplete({ points: currentStrokeRef.current })
      currentStrokeRef.current = []
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border-2 border-border bg-white shadow-inner">
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className={cn(
            'h-auto w-full touch-none',
            isDrawer ? 'cursor-crosshair' : 'cursor-default'
          )}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
      </div>

      {isDrawer && (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-secondary/60 p-2">
          {/* Colors */}
          <div className="flex flex-wrap gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c)
                  setTool('pen')
                }}
                className={cn(
                  'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                  color === c && tool === 'pen'
                    ? 'scale-110 border-foreground'
                    : 'border-transparent'
                )}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>

          <div className="mx-1 h-6 w-px bg-border" />

          {/* Brush sizes */}
          <div className="flex items-center gap-1">
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setBrushSize(s)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                  brushSize === s ? 'bg-foreground/20' : 'hover:bg-foreground/10'
                )}
                title={`Size ${s}`}
              >
                <div
                  className="rounded-full bg-foreground"
                  style={{ width: Math.min(s, 20), height: Math.min(s, 20) }}
                />
              </button>
            ))}
          </div>

          <div className="mx-1 h-6 w-px bg-border" />

          {/* Tools */}
          <button
            onClick={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')}
            className={cn(
              'rounded-lg px-2 py-1 text-xs font-medium transition-colors',
              tool === 'eraser' ? 'bg-foreground/20 text-foreground' : 'hover:bg-foreground/10'
            )}
          >
            {tool === 'eraser' ? 'Eraser' : 'Eraser'}
          </button>
          <button
            onClick={onUndo}
            className="rounded-lg px-2 py-1 text-xs font-medium hover:bg-foreground/10"
          >
            Undo
          </button>
          <button
            onClick={onClear}
            className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Chat / Guess Panel ───────────────────────────────────────────────────────

interface ChatPanelProps {
  messages: GameState['messages']
  isDrawer: boolean
  hasGuessed: boolean
  onGuess: (text: string) => void
}

function ChatPanel({ messages, isDrawer, hasGuessed, onGuess }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    onGuess(input)
    setInput('')
  }

  const canGuess = !isDrawer && !hasGuessed

  return (
    <div className="flex max-h-[400px] flex-col rounded-xl border bg-background">
      <div className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">Chat</div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'mb-1 rounded-lg px-2 py-1 text-xs',
              msg.isCorrect &&
                'bg-emerald-100 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
              msg.isSystem && !msg.isCorrect && 'italic text-muted-foreground'
            )}
          >
            {!msg.isSystem && <span className="mr-1 font-semibold">{msg.playerName}:</span>}
            {msg.text}
          </div>
        ))}
        {messages.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {isDrawer ? 'Players will guess here' : 'Type your guesses below'}
          </p>
        )}
      </div>
      <form onSubmit={handleSubmit} className="border-t p-2">
        <div className="flex gap-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isDrawer ? "You're drawing!" : hasGuessed ? 'Already guessed!' : 'Type your guess...'
            }
            disabled={!canGuess}
            maxLength={50}
            className="flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canGuess || !input.trim()}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Scoreboard ───────────────────────────────────────────────────────────────

interface ScoreboardProps {
  players: GameState['players']
  currentDrawerId: string | null
  guessedPlayers: string[]
  playerId: string
}

function Scoreboard({ players, currentDrawerId, guessedPlayers, playerId }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  return (
    <div className="rounded-xl border bg-background">
      <div className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">
        Scoreboard
      </div>
      <div className="p-2">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs',
              p.id === playerId && 'bg-primary/10'
            )}
          >
            <span className="w-4 text-center font-bold text-muted-foreground">{i + 1}</span>
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                p.id === currentDrawerId
                  ? 'bg-amber-400'
                  : guessedPlayers.includes(p.id)
                    ? 'bg-emerald-400'
                    : 'bg-gray-300'
              )}
            />
            <span className="flex-1 truncate font-medium">
              {p.name}
              {p.id === playerId && <span className="ml-1 text-muted-foreground">(you)</span>}
            </span>
            {p.id === currentDrawerId && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">drawing</span>
            )}
            <span className="font-bold tabular-nums">{p.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Timer ────────────────────────────────────────────────────────────────────

interface TimerProps {
  startTime: number
  duration: number
  onTimeUp: () => void
}

function Timer({ startTime, duration, onTimeUp }: TimerProps) {
  const [remaining, setRemaining] = useState(duration)
  const calledRef = useRef(false)

  useEffect(() => {
    calledRef.current = false
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      const left = Math.max(0, duration - elapsed)
      setRemaining(Math.ceil(left))
      if (left <= 0 && !calledRef.current) {
        calledRef.current = true
        onTimeUp()
      }
    }, 250)
    return () => clearInterval(interval)
  }, [startTime, duration, onTimeUp])

  const pct = (remaining / duration) * 100

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          'min-w-[2rem] text-center text-sm font-bold tabular-nums',
          remaining <= 10 && 'text-red-500'
        )}
      >
        {remaining}s
      </span>
    </div>
  )
}

// ─── Screens ──────────────────────────────────────────────────────────────────

function SetupRequired() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-secondary/40 p-6 text-center">
      <div className="mb-3 text-4xl">🔧</div>
      <h2 className="mb-2 text-lg font-bold">Supabase setup required</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Online multiplayer requires a Supabase project. Create a free project at{' '}
        <span className="font-medium text-foreground">supabase.com</span>, run the schema from{' '}
        <code className="rounded bg-secondary px-1 text-xs">supabase-schema.sql</code>, then set:
      </p>
      <pre className="rounded-lg bg-secondary p-3 text-left text-xs">
        {`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}
      </pre>
    </div>
  )
}

interface EntryScreenProps {
  onCreate: (name: string) => void
  onJoin: (code: string, name: string) => void
  onRestore?: () => void
  savedSession: { roomCode: string; playerName: string } | null
  loading: boolean
  error: string | null
}

function EntryScreen({
  onCreate,
  onJoin,
  onRestore,
  savedSession,
  loading,
  error,
}: EntryScreenProps) {
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')

  if (mode === 'choose') {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <div className="mb-3 text-5xl">🎨</div>
          <h2 className="text-xl font-black tracking-tight">Skribbl Online</h2>
          <p className="text-sm text-muted-foreground">2-8 players &middot; Draw & Guess</p>
        </div>
        {savedSession && (
          <button
            onClick={onRestore}
            className="w-64 rounded-xl border-2 border-dashed border-primary/40 px-6 py-3 text-center text-sm transition-colors hover:bg-secondary"
          >
            <div className="font-semibold">Resume session</div>
            <div className="text-xs text-muted-foreground">
              {savedSession.playerName} &middot; Room {savedSession.roomCode}
            </div>
          </button>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => setMode('create')}
            className="flex w-36 flex-col items-center gap-2 rounded-2xl bg-secondary px-6 py-5 text-center font-semibold transition-all hover:bg-secondary/70 hover:shadow-lg active:scale-95"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <span className="text-2xl">+</span>
            </div>
            <span>Create Room</span>
            <span className="text-xs font-normal text-muted-foreground">Host a game</span>
          </button>
          <button
            onClick={() => setMode('join')}
            className="flex w-36 flex-col items-center gap-2 rounded-2xl bg-secondary px-6 py-5 text-center font-semibold transition-all hover:bg-secondary/70 hover:shadow-lg active:scale-95"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <span className="text-2xl">&rarr;</span>
            </div>
            <span>Join Room</span>
            <span className="text-xs font-normal text-muted-foreground">Enter a code</span>
          </button>
        </div>
      </div>
    )
  }

  const isCreate = mode === 'create'
  return (
    <div className="flex w-72 flex-col gap-4">
      <button
        onClick={() => setMode('choose')}
        className="self-start text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back
      </button>
      <h2 className="text-lg font-bold">{isCreate ? 'Create Room' : 'Join Room'}</h2>
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          maxLength={16}
          className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </label>
      {!isCreate && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Room code</span>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. AB12"
            maxLength={4}
            className="rounded-lg border bg-background px-3 py-2 text-sm uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
      )}
      <button
        disabled={loading || !name.trim() || (!isCreate && joinCode.length < 4)}
        onClick={() => {
          if (isCreate) onCreate(name.trim())
          else onJoin(joinCode, name.trim())
        }}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
      >
        {loading ? 'Connecting\u2026' : isCreate ? 'Create Room' : 'Join Room'}
      </button>
    </div>
  )
}

interface LobbyScreenProps {
  gameState: GameState
  playerId: string
  roomCode: string
  onStart: () => void
  onLeave: () => void
}

function LobbyScreen({ gameState, playerId, roomCode, onStart, onLeave }: LobbyScreenProps) {
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex w-80 flex-col gap-5">
      <div className="rounded-2xl bg-secondary p-5 text-center">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Room code &mdash; share with friends
        </p>
        <p className="mb-3 text-4xl font-black tracking-widest">{roomCode}</p>
        <button
          onClick={copyCode}
          className="rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors hover:bg-background"
        >
          {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Players ({gameState.players.length}/8)
        </p>
        {gameState.players.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span
              className={cn('h-2 w-2 rounded-full', p.isHost ? 'bg-amber-400' : 'bg-green-400')}
            />
            <span className="font-medium">{p.name}</span>
            {p.isHost && <span className="ml-auto text-xs text-muted-foreground">host</span>}
            {p.id === playerId && !p.isHost && (
              <span className="ml-auto text-xs text-muted-foreground">you</span>
            )}
          </div>
        ))}
      </div>

      {isHost && gameState.players.length < 2 && (
        <p className="text-center text-xs text-muted-foreground">
          Waiting for at least one more player&hellip;
        </p>
      )}

      <div className="flex gap-3">
        {isHost && (
          <button
            disabled={gameState.players.length < 2}
            onClick={onStart}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
          >
            Start Game
          </button>
        )}
        {!isHost && (
          <p className="flex-1 text-center text-sm text-muted-foreground">
            Waiting for host to start&hellip;
          </p>
        )}
        <button
          onClick={onLeave}
          className="rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
        >
          Leave
        </button>
      </div>
    </div>
  )
}

// ─── Word Picker ──────────────────────────────────────────────────────────────

interface WordPickerProps {
  words: string[]
  onPick: (word: string) => void
}

function WordPicker({ words, onPick }: WordPickerProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <h2 className="text-lg font-bold">Choose a word to draw</h2>
        <p className="text-sm text-muted-foreground">Pick one of the three options</p>
      </div>
      <div className="flex gap-3">
        {words.map((word) => (
          <button
            key={word}
            onClick={() => onPick(word)}
            className="rounded-xl bg-secondary px-6 py-4 text-sm font-bold transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-lg active:scale-95"
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Round End Screen ─────────────────────────────────────────────────────────

const ROUND_END_DELAY = 5

interface RoundEndProps {
  gameState: GameState
  playerId: string
  onNext: () => void
  onLeave: () => void
}

function RoundEndScreen({ gameState, playerId, onNext, onLeave }: RoundEndProps) {
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const drawer = getCurrentDrawer(gameState)
  const [countdown, setCountdown] = useState(ROUND_END_DELAY)
  const advancedRef = useRef(false)

  useEffect(() => {
    advancedRef.current = false
    setCountdown(ROUND_END_DELAY)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        const next = prev - 1
        if (next <= 0 && isHost && !advancedRef.current) {
          advancedRef.current = true
          onNext()
        }
        return Math.max(0, next)
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isHost, onNext])

  const allGuessed =
    gameState.guessedPlayers.length >= gameState.players.length - 1 && gameState.players.length > 1

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="text-center">
        <h2 className="text-xl font-bold">
          {allGuessed ? 'Everyone guessed it!' : 'Time\u2019s up!'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The word was: <span className="font-bold text-foreground">{gameState.word}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {drawer?.name} was drawing &middot; Round {gameState.round}/{gameState.totalRounds}
        </p>
      </div>

      <Scoreboard
        players={gameState.players}
        currentDrawerId={null}
        guessedPlayers={[]}
        playerId={playerId}
      />

      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-3">
          {isHost ? (
            <button
              onClick={() => {
                if (!advancedRef.current) {
                  advancedRef.current = true
                  onNext()
                }
              }}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground active:scale-95"
            >
              Next Turn ({countdown}s)
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">Next turn in {countdown}s&hellip;</p>
          )}
          <button
            onClick={onLeave}
            className="rounded-lg border px-5 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Finished Screen ──────────────────────────────────────────────────────────

interface FinishedScreenProps {
  gameState: GameState
  playerId: string
  onPlayAgain: () => void
  onLeave: () => void
}

function FinishedScreen({ gameState, playerId, onPlayAgain, onLeave }: FinishedScreenProps) {
  const isHost = gameState.players.find((p) => p.id === playerId)?.isHost ?? false
  const sorted = [...gameState.players].sort((a, b) => b.score - a.score)
  const winner = sorted[0]
  const isWinner = winner?.id === playerId

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-6xl">{isWinner ? '\uD83C\uDFC6' : '\uD83C\uDFAE'}</div>
      <div className="text-center">
        <h2 className="text-2xl font-black">
          {isWinner ? 'You win!' : `${winner?.name ?? '?'} wins!`}
        </h2>
        <p className="text-sm text-muted-foreground">Final score: {winner?.score ?? 0} points</p>
      </div>

      <div className="w-72">
        <Scoreboard
          players={gameState.players}
          currentDrawerId={null}
          guessedPlayers={[]}
          playerId={playerId}
        />
      </div>

      <div className="flex gap-3">
        {isHost ? (
          <button
            onClick={onPlayAgain}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground active:scale-95"
          >
            Play Again
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for host&hellip;</p>
        )}
        <button
          onClick={onLeave}
          className="rounded-lg border px-5 py-2.5 text-sm font-semibold hover:bg-secondary"
        >
          Leave
        </button>
      </div>
    </div>
  )
}

// ─── Game Board (drawing phase) ───────────────────────────────────────────────

interface GameBoardProps {
  gameState: GameState
  playerId: string
  dispatch: (action: Parameters<ReturnType<typeof useSkribblRoom>['dispatch']>[0]) => void
  onLeave: () => void
}

function GameBoardScreen({ gameState, playerId, dispatch, onLeave }: GameBoardProps) {
  const drawer = getCurrentDrawer(gameState)
  const isDrawer = drawer?.id === playerId
  const hasGuessed = gameState.guessedPlayers.includes(playerId)

  const handleTimeUp = useCallback(() => {
    dispatch({ type: 'END_TURN', playerId })
  }, [dispatch, playerId])

  return (
    <div className="flex w-full max-w-5xl flex-col gap-3 px-2">
      {/* Top bar: round, hint/word, timer */}
      <div className="flex items-center gap-3 rounded-xl bg-secondary/60 px-4 py-2">
        <span className="text-xs font-semibold text-muted-foreground">
          Round {gameState.round}/{gameState.totalRounds}
        </span>
        <div className="flex-1 text-center">
          {isDrawer ? (
            <span className="text-sm font-bold">
              Draw: <span className="text-primary">{gameState.word}</span>
            </span>
          ) : (
            <span className="text-lg font-bold tracking-[0.3em]">{gameState.hint}</span>
          )}
        </div>
        <div className="w-32">
          {gameState.drawStartTime && (
            <Timer
              startTime={gameState.drawStartTime}
              duration={gameState.turnDuration}
              onTimeUp={handleTimeUp}
            />
          )}
        </div>
      </div>

      {/* Main layout: scoreboard | canvas | chat */}
      <div className="flex flex-col gap-3 lg:flex-row">
        {/* Scoreboard */}
        <div className="w-full shrink-0 lg:w-44">
          <Scoreboard
            players={gameState.players}
            currentDrawerId={drawer?.id ?? null}
            guessedPlayers={gameState.guessedPlayers}
            playerId={playerId}
          />
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <DrawingCanvas
            strokes={gameState.strokes}
            isDrawer={isDrawer}
            onStrokeComplete={(stroke) => dispatch({ type: 'ADD_STROKE', playerId, stroke })}
            onClear={() => dispatch({ type: 'CLEAR_CANVAS', playerId })}
            onUndo={() => dispatch({ type: 'UNDO_STROKE', playerId })}
          />
        </div>

        {/* Chat */}
        <div className="w-full shrink-0 lg:w-56">
          <ChatPanel
            messages={gameState.messages}
            isDrawer={isDrawer}
            hasGuessed={hasGuessed}
            onGuess={(text) => dispatch({ type: 'GUESS', playerId, text })}
          />
        </div>
      </div>

      {/* Status + leave */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isDrawer
            ? "You're drawing!"
            : hasGuessed
              ? 'You guessed it! Waiting for others...'
              : `${drawer?.name} is drawing`}
        </p>
        <button
          onClick={onLeave}
          className="rounded-lg border px-3 py-1.5 text-xs hover:bg-secondary"
        >
          Leave
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SkribblGame() {
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
    leaveRoom,
  } = useSkribblRoom()

  if (!isSupabaseConfigured) return <SetupRequired />

  const isLoading = status === 'creating' || status === 'joining' || status === 'restoring'

  if (!gameState || !playerId || !roomCode) {
    return (
      <EntryScreen
        onCreate={createRoom}
        onJoin={joinRoom}
        onRestore={savedSession ? restoreSession : undefined}
        savedSession={savedSession}
        loading={isLoading}
        error={error}
      />
    )
  }

  if (gameState.phase === 'lobby') {
    return (
      <LobbyScreen
        gameState={gameState}
        playerId={playerId}
        roomCode={roomCode}
        onStart={() => dispatch({ type: 'START_GAME', playerId })}
        onLeave={leaveRoom}
      />
    )
  }

  if (gameState.phase === 'picking') {
    const drawer = getCurrentDrawer(gameState)
    const isDrawer = drawer?.id === playerId

    if (isDrawer) {
      return (
        <WordPicker
          words={gameState.wordChoices}
          onPick={(word) => dispatch({ type: 'PICK_WORD', playerId, word })}
        />
      )
    }

    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-5xl">🎨</div>
        <h2 className="text-lg font-bold">{drawer?.name} is picking a word...</h2>
        <p className="text-sm text-muted-foreground">Get ready to guess!</p>
      </div>
    )
  }

  if (gameState.phase === 'drawing') {
    return (
      <GameBoardScreen
        gameState={gameState}
        playerId={playerId}
        dispatch={dispatch}
        onLeave={leaveRoom}
      />
    )
  }

  if (gameState.phase === 'round-end') {
    return (
      <RoundEndScreen
        gameState={gameState}
        playerId={playerId}
        onNext={() => dispatch({ type: 'NEXT_TURN', playerId })}
        onLeave={leaveRoom}
      />
    )
  }

  if (gameState.phase === 'finished') {
    return (
      <FinishedScreen
        gameState={gameState}
        playerId={playerId}
        onPlayAgain={() => dispatch({ type: 'PLAY_AGAIN', playerId })}
        onLeave={leaveRoom}
      />
    )
  }

  return null
}
