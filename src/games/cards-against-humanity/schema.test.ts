import { GameStateSchema } from './schema'

const validGameState = {
  phase: 'lobby' as const,
  players: [{ id: 'p1', name: 'Alice', isHost: true }],
  czarIndex: 0,
  blackCard: null,
  hands: {},
  submissions: {},
  submittedPlayerIds: [],
  shuffledSubmissions: [],
  revealOrder: [],
  revealIndex: -1,
  roundWinnerId: null,
  roundWinnerCards: [],
  scores: {},
  pointsToWin: 7,
  winnerId: null,
  blackDeck: [],
  whiteDeck: [],
  handSize: 10,
  _rm: '',
}

describe('CAH GameStateSchema', () => {
  it('accepts a valid lobby state', () => {
    expect(GameStateSchema.safeParse(validGameState).success).toBe(true)
  })

  it('accepts a state with a black card', () => {
    const state = { ...validGameState, blackCard: { text: 'Fill in the blank: ___', pick: 1 } }
    expect(GameStateSchema.safeParse(state).success).toBe(true)
  })

  it('rejects an unknown phase', () => {
    expect(GameStateSchema.safeParse({ ...validGameState, phase: 'waiting' }).success).toBe(false)
  })

  it('rejects missing czarIndex', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { czarIndex: _czarIndex, ...invalid } = validGameState
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects a player missing isHost', () => {
    const invalid = {
      ...validGameState,
      players: [{ id: 'p1', name: 'Alice' }],
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })
})
