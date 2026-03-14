import { GameStateSchema } from './schema'

const validCard = { id: '1', color: 'red' as const, value: 5 as const }
const validWildCard = { id: '2', color: 'wild' as const, value: 'wild' as const }

const validGameState = {
  phase: 'lobby' as const,
  players: [{ id: 'p1', name: 'Alice', isHost: true }],
  hands: {},
  drawPile: [],
  discardPile: [],
  currentPlayerIndex: 0,
  direction: 1 as const,
  currentColor: 'red' as const,
  pendingDrawCount: 0,
  calledUno: [],
  winnerId: null,
  drawnCardId: null,
  unoWindow: {},
}

describe('UNO GameStateSchema', () => {
  it('accepts a valid lobby state', () => {
    expect(GameStateSchema.safeParse(validGameState).success).toBe(true)
  })

  it('accepts a playing state with cards', () => {
    const state = {
      ...validGameState,
      phase: 'playing' as const,
      hands: { p1: [validCard] },
      drawPile: [validWildCard],
      discardPile: [validCard],
    }
    expect(GameStateSchema.safeParse(state).success).toBe(true)
  })

  it('rejects an unknown phase', () => {
    expect(GameStateSchema.safeParse({ ...validGameState, phase: 'dealing' }).success).toBe(false)
  })

  it('rejects an invalid card value', () => {
    const invalid = {
      ...validGameState,
      hands: { p1: [{ id: '1', color: 'red', value: 99 }] },
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects an invalid direction', () => {
    expect(GameStateSchema.safeParse({ ...validGameState, direction: 0 }).success).toBe(false)
  })

  it('rejects an invalid card color', () => {
    const invalid = {
      ...validGameState,
      discardPile: [{ id: '1', color: 'purple', value: 5 }],
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })
})
