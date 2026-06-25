'use client'

import { useReducer, useState, useEffect, useRef, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import {
  reduce,
  init,
  ghost as ghostOf,
  cells as pieceCells,
  gravityMs,
  COLORS,
  SHAPES,
  type Action,
  type Board,
  type GameState,
  type Piece,
  type PieceType,
} from './logic'
import styles from './TetrisGame.module.css'

type Dispatch = (action: Action) => void

const blk = (color: string): CSSProperties => ({ ['--blk']: color }) as CSSProperties

// ── Board + piece rendering (presentational) ───────────────────────────────
type Fill = { type: PieceType; ghost?: boolean } | null

function Cell({ fill }: { fill: Fill }) {
  if (!fill) return <div className={styles.cell} />
  const color = COLORS[fill.type]
  return (
    <div
      className={cn(styles.cell, fill.ghost ? styles.ghost : styles.filled)}
      style={blk(color)}
    />
  )
}

function Playfield({
  board,
  piece,
  showGhost,
}: {
  board: Board
  piece: Piece | null
  showGhost: boolean
}) {
  const grid: Fill[][] = board.map((row) => row.map((c) => (c ? { type: c } : null)))

  if (piece && showGhost) {
    const g = ghostOf(board, piece)
    for (const { x, y } of pieceCells(g)) {
      if (y >= 0 && !grid[y][x]) grid[y][x] = { type: piece.type, ghost: true }
    }
  }
  if (piece) {
    for (const { x, y } of pieceCells(piece)) {
      if (y >= 0) grid[y][x] = { type: piece.type }
    }
  }

  return (
    <div className={styles.field}>
      {grid.map((row, y) => row.map((fill, x) => <Cell key={`${y}-${x}`} fill={fill} />))}
    </div>
  )
}

function MiniPiece({ type }: { type: PieceType | null }) {
  if (!type) return <div className={cn(styles.mini, styles.miniEmpty)} />
  const m = SHAPES[type]
  let minR = 99,
    maxR = -1,
    minC = 99,
    maxC = -1
  for (let r = 0; r < m.length; r++)
    for (let c = 0; c < m[r].length; c++)
      if (m[r][c]) {
        minR = Math.min(minR, r)
        maxR = Math.max(maxR, r)
        minC = Math.min(minC, c)
        maxC = Math.max(maxC, c)
      }
  const rows = maxR - minR + 1
  const cols = maxC - minC + 1
  const color = COLORS[type]
  const out = []
  for (let r = minR; r <= maxR; r++)
    for (let c = minC; c <= maxC; c++)
      out.push(
        <div
          key={`${r}-${c}`}
          className={cn(styles.cell, m[r][c] && styles.filled)}
          style={m[r][c] ? blk(color) : undefined}
        />
      )

  return (
    <div className={styles.mini}>
      <div
        className={styles.miniGrid}
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          aspectRatio: `${cols} / ${rows}`,
        }}
      >
        {out}
      </div>
    </div>
  )
}

function Slot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={cn(styles.panel, styles.slot)}>
      <span className={styles.panelLabel}>{label}</span>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  )
}

// A button that fires once on press, then auto-repeats while held.
function HoldButton({
  className,
  title,
  onPress,
  repeat = false,
  children,
}: {
  className: string
  title: string
  onPress: () => void
  repeat?: boolean
  children: React.ReactNode
}) {
  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    onPress()
    if (!repeat) return
    let iv: ReturnType<typeof setInterval> | null = null
    const to = setTimeout(() => {
      iv = setInterval(onPress, 65)
    }, 170)
    const stop = () => {
      clearTimeout(to)
      if (iv) clearInterval(iv)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }
  return (
    <button
      type="button"
      className={className}
      title={title}
      onPointerDown={start}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  )
}

function Controls({ dispatch }: { dispatch: Dispatch }) {
  const d = (type: Action['type']) => () => dispatch({ type } as Action)
  return (
    <div className={styles.controls}>
      <HoldButton className={styles.cbtn} title="Rotate left (Z)" onPress={d('ccw')}>
        ⟲
      </HoldButton>
      <HoldButton className={styles.cbtn} title="Rotate right (X / ↑)" onPress={d('cw')}>
        ⟳
      </HoldButton>
      <HoldButton className={styles.cbtn} title="Hold (C)" onPress={d('hold')}>
        HOLD
      </HoldButton>
      <HoldButton className={styles.cbtn} title="Left (←)" onPress={d('left')} repeat>
        ←
      </HoldButton>
      <HoldButton className={styles.cbtn} title="Soft drop (↓)" onPress={d('soft')} repeat>
        ↓
      </HoldButton>
      <HoldButton className={styles.cbtn} title="Right (→)" onPress={d('right')} repeat>
        →
      </HoldButton>
      <HoldButton
        className={cn(styles.cbtn, styles.cbtnWide)}
        title="Hard drop (Space)"
        onPress={d('hard')}
      >
        ▼ HARD DROP
      </HoldButton>
    </div>
  )
}

function MobileControls({ dispatch, status }: { dispatch: Dispatch; status: GameState['status'] }) {
  const d = (type: Action['type']) => () => dispatch({ type } as Action)
  const paused = status === 'paused'
  return (
    <div className={styles.mpad}>
      <HoldButton className={styles.mbtn} title="Left" onPress={d('left')} repeat>
        ←
      </HoldButton>
      <HoldButton className={styles.mbtn} title="Soft drop" onPress={d('soft')} repeat>
        ↓
      </HoldButton>
      <HoldButton className={styles.mbtn} title="Right" onPress={d('right')} repeat>
        →
      </HoldButton>
      <HoldButton className={styles.mbtn} title="Hold" onPress={d('hold')}>
        HOLD
      </HoldButton>
      <HoldButton className={styles.mbtn} title="Rotate left" onPress={d('ccw')}>
        ⟲
      </HoldButton>
      <HoldButton className={styles.mbtn} title="Rotate right" onPress={d('cw')}>
        ⟳
      </HoldButton>
      <HoldButton
        className={cn(styles.mbtn, styles.mbtnDrop)}
        title="Hard drop"
        onPress={d('hard')}
      >
        ▼ HARD DROP
      </HoldButton>
      <button
        type="button"
        className={cn(styles.mbtn, styles.mbtnPause)}
        onClick={() => dispatch({ type: paused ? 'resume' : 'pause' })}
      >
        {paused ? '▶' : '❚❚'}
      </button>
    </div>
  )
}

function useIsMobile(query = '(max-width: 680px)') {
  const [m, setM] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const fn = () => setM(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [query])
  return m
}

const reducer = (s: GameState, a: Action): GameState => reduce(s, a) ?? s

// ── Main component ─────────────────────────────────────────────────────────
export function TetrisGame() {
  const [state, dispatch] = useReducer(reducer, 0, (lvl) => init(lvl))
  const [best, setBest] = useState(0)

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem('tetris-best') || 0))
    } catch {
      /* ignore */
    }
  }, [])

  const start = useCallback(() => dispatch({ type: 'init' }), [])

  // Gravity loop
  useEffect(() => {
    if (state.status !== 'playing') return
    const iv = setInterval(() => dispatch({ type: 'tick' }), gravityMs(state.level))
    return () => clearInterval(iv)
  }, [state.status, state.level])

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = stateRef.current
      if (st.status === 'over') {
        if (e.key === 'Enter' || e.key.toLowerCase() === 'r') {
          e.preventDefault()
          start()
        }
        return
      }
      switch (e.key) {
        case 'ArrowLeft':
          dispatch({ type: 'left' })
          break
        case 'ArrowRight':
          dispatch({ type: 'right' })
          break
        case 'ArrowDown':
          dispatch({ type: 'soft' })
          break
        case 'ArrowUp':
        case 'x':
        case 'X':
          dispatch({ type: 'cw' })
          break
        case 'z':
        case 'Z':
          dispatch({ type: 'ccw' })
          break
        case ' ':
          dispatch({ type: 'hard' })
          break
        case 'c':
        case 'C':
        case 'Shift':
          dispatch({ type: 'hold' })
          break
        case 'p':
        case 'P':
        case 'Escape':
          dispatch({ type: 'pause' })
          break
        default:
          return
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key))
        e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [start])

  // Persist high score
  useEffect(() => {
    if (state.status === 'over' && state.score > best) {
      setBest(state.score)
      try {
        localStorage.setItem('tetris-best', String(state.score))
      } catch {
        /* ignore */
      }
    }
  }, [state.status, state.score, best])

  const isMobile = useIsMobile()

  const fieldEl = (
    <div className={styles.fieldwrap} data-testid="tetris-board">
      <Playfield board={state.board} piece={state.piece} showGhost />
      {state.status === 'paused' && (
        <div className={styles.overlay}>
          <div className={styles.overCard}>
            <span className={cn(styles.overKicker, 'mono')}>Paused</span>
            <h2 className={styles.overTitle}>Take a breath</h2>
            <div className={styles.overActions}>
              <button className={styles.btn} onClick={() => dispatch({ type: 'resume' })}>
                Resume →
              </button>
              <button className={cn(styles.btn, styles.btnGhost)} onClick={start}>
                Restart
              </button>
            </div>
            <span className={cn(styles.overMeta, 'mono')}>P / Esc to toggle</span>
          </div>
        </div>
      )}
      {state.status === 'over' && (
        <div className={styles.overlay}>
          <div className={styles.overCard}>
            <span className={cn(styles.overKicker, 'mono')}>Game over</span>
            <h2 className={styles.overTitle}>{state.score.toLocaleString()}</h2>
            <div className={cn(styles.overStats, 'mono')}>
              <span>{state.lines} lines</span>
              <span>·</span>
              <span>level {state.level}</span>
              {state.score >= best && state.score > 0 && (
                <span className={styles.pb}>· new best</span>
              )}
            </div>
            <div className={styles.overActions}>
              <button className={styles.btn} onClick={start}>
                Play again →
              </button>
            </div>
            <span className={cn(styles.overMeta, 'mono')}>Enter / R to restart</span>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className={styles.root}>
      {isMobile ? (
        <div className={cn(styles.board, styles.mobile)}>
          <div className={styles.mbar}>
            <div className={styles.mslot}>
              <span className={styles.panelLabel}>Hold</span>
              <MiniPiece type={state.hold} />
            </div>
            <div className={styles.mstats}>
              <Stat label="Score" value={state.score.toLocaleString()} />
              <Stat label="Lines" value={state.lines} />
              <Stat label="Level" value={state.level} />
            </div>
            <div className={styles.mslot}>
              <span className={styles.panelLabel}>Next</span>
              <div className={styles.mnext}>
                {state.queue.slice(0, 2).map((tp, i) => (
                  <MiniPiece key={i} type={tp} />
                ))}
              </div>
            </div>
          </div>
          {fieldEl}
          <MobileControls dispatch={dispatch} status={state.status} />
        </div>
      ) : (
        <div className={styles.board}>
          {/* Left rail */}
          <div className={styles.rail}>
            <Slot label="Hold">
              <MiniPiece type={state.hold} />
            </Slot>
            <div className={cn(styles.panel, styles.stats)}>
              <Stat label="Score" value={state.score.toLocaleString()} />
              <Stat label="Lines" value={state.lines} />
              <Stat label="Level" value={state.level} />
              <Stat label="Best" value={Math.max(best, state.score).toLocaleString()} />
            </div>
          </div>

          {/* Playfield */}
          {fieldEl}

          {/* Right rail */}
          <div className={styles.rail}>
            <div className={cn(styles.panel, styles.slot)}>
              <span className={styles.panelLabel}>Next</span>
              <div className={styles.next}>
                {state.queue.slice(0, 3).map((tp, i) => (
                  <div key={i} className={cn(styles.nextRow, i === 0 && styles.nextLead)}>
                    <MiniPiece type={tp} />
                  </div>
                ))}
              </div>
            </div>
            <Controls dispatch={dispatch} />
            <button
              className={styles.pausebtn}
              onClick={() => dispatch({ type: state.status === 'paused' ? 'resume' : 'pause' })}
              disabled={state.status === 'over'}
            >
              {state.status === 'paused' ? '▶ Resume' : '❚❚ Pause'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
