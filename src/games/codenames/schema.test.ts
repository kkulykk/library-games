import { GameStateSchema } from './schema'

const validCard = { word: 'apple', type: 'neutral' as const, revealed: false }

const validGameState = {
  phase: 'lobby' as const,
  players: [
    { id: 'p1', name: 'Alice', isHost: true, team: 'red' as const, role: 'spymaster' as const },
  ],
  board: [],
  currentTeam: 'red' as const,
  turnPhase: 'giving_clue' as const,
  currentClue: null,
  redRemaining: 9,
  blueRemaining: 8,
  winningTeam: null,
  log: [],
}

describe('codenames GameStateSchema', () => {
  it('accepts a valid lobby state', () => {
    expect(GameStateSchema.safeParse(validGameState).success).toBe(true)
  })

  it('accepts a player with null team/role (unassigned)', () => {
    const state = {
      ...validGameState,
      players: [{ id: 'p1', name: 'Alice', isHost: true, team: null, role: null }],
    }
    expect(GameStateSchema.safeParse(state).success).toBe(true)
  })

  it('rejects an unknown phase', () => {
    expect(GameStateSchema.safeParse({ ...validGameState, phase: 'waiting' }).success).toBe(false)
  })

  it('rejects an invalid team enum', () => {
    const invalid = {
      ...validGameState,
      players: [{ id: 'p1', name: 'Alice', isHost: true, team: 'green', role: null }],
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })

  it('accepts a player name with an emoji', () => {
    const state = {
      ...validGameState,
      players: [{ id: 'p1', name: 'player 🎮', isHost: true, team: 'red' as const, role: null }],
    }
    expect(GameStateSchema.safeParse(state).success).toBe(true)
  })

  it('rejects a blank player name', () => {
    const invalid = {
      ...validGameState,
      players: [{ id: 'p1', name: '   ', isHost: true, team: 'red' as const, role: null }],
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects a 21-char player name', () => {
    const invalid = {
      ...validGameState,
      players: [{ id: 'p1', name: 'a'.repeat(21), isHost: true, team: 'red' as const, role: null }],
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })

  // board cell nested-structure cases (D-12 / TEST-03)
  it('accepts a full 25-card board of valid cells', () => {
    const state = { ...validGameState, board: Array.from({ length: 25 }, () => validCard) }
    expect(GameStateSchema.safeParse(state).success).toBe(true)
  })

  it('rejects a board cell with an invalid type', () => {
    const state = { ...validGameState, board: [{ ...validCard, type: 'gold' }] }
    expect(GameStateSchema.safeParse(state).success).toBe(false)
  })

  it('rejects a board cell with a non-boolean revealed', () => {
    const state = { ...validGameState, board: [{ ...validCard, revealed: 'yes' }] }
    expect(GameStateSchema.safeParse(state).success).toBe(false)
  })

  it('rejects a board cell missing word', () => {
    const state = { ...validGameState, board: [{ type: 'red' as const, revealed: false }] }
    expect(GameStateSchema.safeParse(state).success).toBe(false)
  })

  it('accepts each valid cell type', () => {
    const types = ['red', 'blue', 'neutral', 'assassin'] as const
    const state = { ...validGameState, board: types.map((type) => ({ ...validCard, type })) }
    expect(GameStateSchema.safeParse(state).success).toBe(true)
  })

  // currentClue / ClueSchema nested-structure cases (bonus within scope — D-12)
  it('accepts a valid currentClue', () => {
    const state = {
      ...validGameState,
      currentClue: { word: 'fruit', count: 2, team: 'red' as const, guessesUsed: 0 },
    }
    expect(GameStateSchema.safeParse(state).success).toBe(true)
  })

  it('rejects a currentClue with a negative count', () => {
    const state = {
      ...validGameState,
      currentClue: { word: 'fruit', count: -1, team: 'red' as const, guessesUsed: 0 },
    }
    expect(GameStateSchema.safeParse(state).success).toBe(false)
  })

  it('rejects a currentClue with an invalid team', () => {
    const state = {
      ...validGameState,
      currentClue: { word: 'fruit', count: 2, team: 'green', guessesUsed: 0 },
    }
    expect(GameStateSchema.safeParse(state).success).toBe(false)
  })
})
