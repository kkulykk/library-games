import { GameStateSchema } from './schema'

const validGameState = {
  phase: 'lobby' as const,
  players: [{ id: 'p1', name: 'Alice', isHost: true, score: 0 }],
  totalRounds: 5,
  roundNumber: 0,
  currentRound: null,
  log: [],
}

const validRound = {
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
}

const playing = { ...validGameState, phase: 'playing' as const, roundNumber: 1 }

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

  // currentRound nested-structure cases (D-12 / TEST-03)
  it('rejects a currentRound target above 100', () => {
    const s = { ...playing, currentRound: { ...validRound, target: 101 } }
    expect(GameStateSchema.safeParse(s).success).toBe(false)
  })

  it('rejects a currentRound target below -1', () => {
    const s = { ...playing, currentRound: { ...validRound, target: -2 } }
    expect(GameStateSchema.safeParse(s).success).toBe(false)
  })

  it('rejects a currentRound spectrum missing right', () => {
    const s = { ...playing, currentRound: { ...validRound, spectrum: { left: 'Cold' } } }
    expect(GameStateSchema.safeParse(s).success).toBe(false)
  })

  it('rejects an unknown currentRound phase', () => {
    const s = { ...playing, currentRound: { ...validRound, phase: 'scoring' } }
    expect(GameStateSchema.safeParse(s).success).toBe(false)
  })

  it('accepts a currentRound with populated guesses and roundScores maps', () => {
    const s = {
      ...playing,
      currentRound: { ...validRound, guesses: { p1: 40 }, roundScores: { p1: 3 } },
    }
    expect(GameStateSchema.safeParse(s).success).toBe(true)
  })

  it('rejects a currentRound guess value above 100', () => {
    const s = { ...playing, currentRound: { ...validRound, guesses: { p1: 200 } } }
    expect(GameStateSchema.safeParse(s).success).toBe(false)
  })

  it('rejects a currentRound negative roundScore', () => {
    const s = { ...playing, currentRound: { ...validRound, roundScores: { p1: -1 } } }
    expect(GameStateSchema.safeParse(s).success).toBe(false)
  })
})
