import { GameStateSchema } from './schema'

const validGameState = {
  phase: 'lobby' as const,
  players: [{ id: 'p1', name: 'Alice', isHost: true, score: 0 }],
  totalRounds: 5,
  roundNumber: 0,
  currentRound: null,
  log: [],
}

describe('mindmeld GameStateSchema', () => {
  it('accepts a valid lobby state', () => {
    expect(GameStateSchema.safeParse(validGameState).success).toBe(true)
  })

  it('accepts a playing state with a current round', () => {
    const state = {
      ...validGameState,
      phase: 'playing' as const,
      roundNumber: 1,
      currentRound: {
        number: 1,
        psychicId: 'p1',
        spectrum: { left: 'Cold', right: 'Hot' },
        target: 50,
        clue: null,
        teamGuess: null,
        guessLockedBy: null,
        guesses: {},
        roundScores: {},
        phase: 'clue' as const,
      },
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

  it('accepts a player name with an emoji', () => {
    const state = {
      ...validGameState,
      players: [{ id: 'p1', name: 'player 🎮', isHost: true, score: 0 }],
    }
    expect(GameStateSchema.safeParse(state).success).toBe(true)
  })

  it('rejects a blank player name', () => {
    const invalid = {
      ...validGameState,
      players: [{ id: 'p1', name: '   ', isHost: true, score: 0 }],
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects a 21-char player name', () => {
    const invalid = {
      ...validGameState,
      players: [{ id: 'p1', name: 'a'.repeat(21), isHost: true, score: 0 }],
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })
})
