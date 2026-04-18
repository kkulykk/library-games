import { GameStateSchema } from './schema'

const validGameState = {
  phase: 'lobby' as const,
  players: [{ id: 'p1', name: 'Alice', isHost: true, score: 0, avatar: 0 }],
  currentDrawerIndex: 0,
  round: 0,
  totalRounds: 3,
  word: null,
  wordChoices: [],
  hint: '',
  strokes: [],
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

  it('accepts a drawing state with strokes and messages', () => {
    const state = {
      ...validGameState,
      phase: 'drawing' as const,
      word: 'cat',
      hint: '_ _ _',
      drawStartTime: Date.now(),
      strokes: [{ points: [{ x: 10, y: 20, color: '#000', size: 4, tool: 'pen' as const }] }],
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

  it('rejects a draw point with an invalid tool', () => {
    const invalid = {
      ...validGameState,
      strokes: [{ points: [{ x: 10, y: 20, color: '#000', size: 4, tool: 'spray' }] }],
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })
})
