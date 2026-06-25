import {
  COLS,
  ROWS,
  TYPES,
  SHAPES,
  COLORS,
  emptyBoard,
  rotateMatrix,
  newBag,
  makePiece,
  cells,
  collides,
  ghost,
  merge,
  clearLines,
  init,
  reduce,
  gravityMs,
  type Board,
  type GameState,
  type Piece,
} from './logic'

describe('emptyBoard', () => {
  it('is 20 rows x 10 cols of null', () => {
    const b = emptyBoard()
    expect(b).toHaveLength(ROWS)
    expect(b[0]).toHaveLength(COLS)
    expect(b.flat().every((c) => c === null)).toBe(true)
  })
})

describe('rotateMatrix', () => {
  it('rotates a T clockwise then counter-clockwise differently', () => {
    const t = SHAPES.T
    const cw = rotateMatrix(t, 1)
    const ccw = rotateMatrix(t, -1)
    expect(cw).not.toEqual(ccw)
    // four clockwise rotations return to the original
    let m = t
    for (let i = 0; i < 4; i++) m = rotateMatrix(m, 1)
    expect(m).toEqual(t)
  })
})

describe('newBag', () => {
  it('is a permutation of all 7 piece types', () => {
    const bag = newBag()
    expect(bag).toHaveLength(7)
    expect([...bag].sort()).toEqual([...TYPES].sort())
  })
})

describe('makePiece', () => {
  it('spawns centred at the top', () => {
    const p = makePiece('O')
    expect(p.type).toBe('O')
    expect(p.y).toBe(0)
    expect(p.x).toBe(Math.floor((COLS - SHAPES.O[0].length) / 2))
  })
})

describe('cells', () => {
  it('returns absolute coordinates of filled squares', () => {
    const piece: Piece = { type: 'O', m: SHAPES.O, x: 2, y: 3 }
    expect(cells(piece)).toEqual([
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 2, y: 4 },
      { x: 3, y: 4 },
    ])
  })
})

describe('collides', () => {
  const board = emptyBoard()

  it('detects walls and floor', () => {
    expect(collides(board, { type: 'O', m: SHAPES.O, x: -1, y: 0 })).toBe(true)
    expect(collides(board, { type: 'O', m: SHAPES.O, x: COLS - 1, y: 0 })).toBe(true)
    expect(collides(board, { type: 'O', m: SHAPES.O, x: 0, y: ROWS - 1 })).toBe(true)
  })

  it('detects settled blocks but ignores cells above the top', () => {
    const b: Board = emptyBoard()
    b[5][4] = 'I'
    expect(collides(b, { type: 'O', m: SHAPES.O, x: 4, y: 4 })).toBe(true)
    expect(collides(board, { type: 'O', m: SHAPES.O, x: 4, y: -1 })).toBe(false)
  })
})

describe('ghost', () => {
  it('drops the piece to the floor', () => {
    const g = ghost(emptyBoard(), makePiece('O'))
    expect(g.y).toBe(ROWS - 2) // O is 2 tall
  })
})

describe('merge', () => {
  it('writes the piece type into the board', () => {
    const b = merge(emptyBoard(), { type: 'T', m: SHAPES.T, x: 0, y: 0 })
    expect(b[1][0]).toBe('T')
    expect(b[0][1]).toBe('T')
  })
})

describe('clearLines', () => {
  it('removes a full row and prepends an empty row', () => {
    const b = emptyBoard()
    b[ROWS - 1] = Array<string>(COLS).fill('Z') as Board[number]
    const { board, cleared } = clearLines(b)
    expect(cleared).toBe(1)
    expect(board).toHaveLength(ROWS)
    expect(board[0].every((c) => c === null)).toBe(true)
    expect(board[ROWS - 1].every((c) => c === null)).toBe(true)
  })

  it('clears four rows at once', () => {
    const b = emptyBoard()
    for (let r = ROWS - 4; r < ROWS; r++) b[r] = Array<string>(COLS).fill('I') as Board[number]
    expect(clearLines(b).cleared).toBe(4)
  })
})

describe('gravityMs', () => {
  it('decreases with level and floors at 70ms', () => {
    expect(gravityMs(0)).toBe(800)
    expect(gravityMs(1)).toBeLessThan(gravityMs(0))
    expect(gravityMs(50)).toBe(70)
  })
})

describe('init', () => {
  it('produces a playing state with a spawned piece', () => {
    const s = init(3)
    expect(s.status).toBe('playing')
    expect(s.piece).not.toBeNull()
    expect(s.level).toBe(3)
    expect(s.baseLevel).toBe(3)
    expect(s.queue.length).toBeGreaterThanOrEqual(6)
  })
})

describe('reduce', () => {
  it('init action creates a fresh game', () => {
    expect(reduce(null, { type: 'init' })?.status).toBe('playing')
  })

  it('ignores actions on null/over state', () => {
    expect(reduce(null, { type: 'left' })).toBeNull()
    const over: GameState = { ...init(), status: 'over' }
    expect(reduce(over, { type: 'left' })).toBe(over)
  })

  it('moves left and right within bounds', () => {
    const s = init()
    const x0 = s.piece!.x
    expect(reduce(s, { type: 'right' })!.piece!.x).toBe(x0 + 1)
    expect(reduce(s, { type: 'left' })!.piece!.x).toBe(x0 - 1)
  })

  it('toggles pause and resume and blocks movement while paused', () => {
    const s = init()
    const paused = reduce(s, { type: 'pause' })!
    expect(paused.status).toBe('paused')
    expect(reduce(paused, { type: 'resume' })!.status).toBe('playing')
    expect(reduce(paused, { type: 'left' })).toBe(paused)
  })

  it('soft drop moves down and adds a point', () => {
    const s = init()
    const y0 = s.piece!.y
    const soft = reduce(s, { type: 'soft' })!
    expect(soft.piece!.y).toBe(y0 + 1)
    expect(soft.score).toBe(1)
  })

  it('rotates the active piece', () => {
    const s = init()
    const rotated = reduce(s, { type: 'cw' })!
    expect(rotated.piece!.m).not.toEqual(s.piece!.m)
  })

  it('hard drop locks the piece, scores, and spawns a new one', () => {
    const s = init()
    const after = reduce(s, { type: 'hard' })!
    expect(after.score).toBeGreaterThan(0)
    expect(after.board.flat().some((c) => c !== null)).toBe(true)
    expect(after.piece).not.toBeNull()
  })

  it('hold swaps the active piece and blocks a second hold', () => {
    const s = init()
    const held = reduce(s, { type: 'hold' })!
    expect(held.hold).toBe(s.piece!.type)
    expect(held.canHold).toBe(false)
    expect(reduce(held, { type: 'hold' })).toBe(held)
  })

  it('hold swaps back a previously held piece', () => {
    const s = init()
    const first = reduce(s, { type: 'hold' })! // hold = type A, new active B
    // simulate canHold reset (as a lock would do)
    const reset: GameState = { ...first, canHold: true }
    const second = reduce(reset, { type: 'hold' })!
    expect(second.hold).toBe(reset.piece!.type)
    expect(second.piece!.type).toBe(first.hold)
  })

  it('tick locks when the piece cannot fall further', () => {
    const base = init()
    const resting: GameState = {
      ...base,
      piece: { type: 'O', m: SHAPES.O, x: 4, y: ROWS - 2 },
    }
    const ticked = reduce(resting, { type: 'tick' })!
    expect(ticked.board.flat().some((c) => c === 'O')).toBe(true)
  })

  it('detects game over when a fresh piece collides at spawn', () => {
    const base = init()
    const board = emptyBoard()
    // Block the central spawn zone but leave edge gaps so these rows are not
    // full lines (otherwise they'd clear on lock and free the top).
    for (let r = 0; r < 3; r++) for (let c = 2; c < 8; c++) board[r][c] = 'I'
    const resting: GameState = {
      ...base,
      board,
      piece: { type: 'O', m: SHAPES.O, x: 0, y: ROWS - 2 },
    }
    expect(reduce(resting, { type: 'hard' })!.status).toBe('over')
  })
})

describe('palette', () => {
  it('defines a colour for every type', () => {
    for (const t of TYPES) expect(COLORS[t]).toMatch(/^oklch/)
  })
})
