import { GameStateSchema } from './schema'

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
})
