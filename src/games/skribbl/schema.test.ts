import { BroadcastMessageSchema, GameStateSchema, SNAPSHOT_CHUNK_SIZE } from './schema'

const validGameState = {
  phase: 'lobby' as const,
  players: [{ id: 'p1', name: 'Alice', isHost: true, score: 0, avatar: 0 }],
  currentDrawerIndex: 0,
  round: 0,
  totalRounds: 3,
  word: null,
  wordChoices: [],
  hint: '',
  messages: [],
  guessedPlayers: [],
  drawStartTime: null,
  turnDuration: 80,
  turnEndTime: null,
  scoreDeltas: {},
}

describe('skribbl GameStateSchema', () => {
  it('accepts a valid lobby state', () => {
    expect(GameStateSchema.safeParse(validGameState).success).toBe(true)
  })

  it('accepts a drawing state with messages', () => {
    const state = {
      ...validGameState,
      phase: 'drawing' as const,
      word: 'cat',
      hint: '_ _ _',
      drawStartTime: Date.now(),
      messages: [
        {
          id: 'msg1',
          playerId: 'p1',
          playerName: 'Alice',
          text: 'a guess',
          isCorrect: false,
          isClose: true,
        },
      ],
    }
    expect(GameStateSchema.safeParse(state).success).toBe(true)
  })

  it('rejects an unknown phase', () => {
    expect(GameStateSchema.safeParse({ ...validGameState, phase: 'waiting' }).success).toBe(false)
  })

  it('rejects a player missing score', () => {
    const invalid = {
      ...validGameState,
      players: [{ id: 'p1', name: 'Alice', isHost: true }],
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects a state that still carries strokes', () => {
    // Strokes are broadcast-only now; a room row must never grow a canvas again.
    const parsed = GameStateSchema.safeParse({
      ...validGameState,
      strokes: [{ points: [{ x: 1, y: 2 }], color: '#000', size: 4, tool: 'pen' }],
    })
    expect(parsed.success).toBe(true)
    expect(parsed.success && 'strokes' in parsed.data).toBe(false)
  })

  it('accepts a player name with an emoji', () => {
    const state = {
      ...validGameState,
      players: [{ id: 'p1', name: 'player 🎮', isHost: true, score: 0, avatar: 0 }],
    }
    expect(GameStateSchema.safeParse(state).success).toBe(true)
  })

  it('rejects a 21-char player name', () => {
    const invalid = {
      ...validGameState,
      players: [{ id: 'p1', name: 'a'.repeat(21), isHost: true, score: 0, avatar: 0 }],
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })
})

describe('skribbl BroadcastMessageSchema', () => {
  const stroke = { points: [{ x: 10, y: 20 }], color: '#000', size: 4, tool: 'pen' as const }

  it('accepts a stroke message', () => {
    expect(
      BroadcastMessageSchema.safeParse({ type: 'stroke', playerId: 'p1', stroke }).success
    ).toBe(true)
  })

  it('accepts undo and clear messages', () => {
    expect(BroadcastMessageSchema.safeParse({ type: 'undo', playerId: 'p1' }).success).toBe(true)
    expect(BroadcastMessageSchema.safeParse({ type: 'clear', playerId: 'p1' }).success).toBe(true)
  })

  it('accepts a snapshot chunk', () => {
    expect(
      BroadcastMessageSchema.safeParse({
        type: 'snapshot',
        playerId: 'p1',
        strokes: [stroke],
        reset: true,
      }).success
    ).toBe(true)
  })

  it('rejects a snapshot larger than one chunk', () => {
    expect(
      BroadcastMessageSchema.safeParse({
        type: 'snapshot',
        playerId: 'p1',
        strokes: Array.from({ length: SNAPSHOT_CHUNK_SIZE + 1 }, () => stroke),
        reset: true,
      }).success
    ).toBe(false)
  })

  it('rejects an invalid tool', () => {
    expect(
      BroadcastMessageSchema.safeParse({
        type: 'stroke',
        playerId: 'p1',
        stroke: { ...stroke, tool: 'spray' },
      }).success
    ).toBe(false)
  })

  it('rejects an unknown message type', () => {
    expect(BroadcastMessageSchema.safeParse({ type: 'wipe', playerId: 'p1' }).success).toBe(false)
  })
})
