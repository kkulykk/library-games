import { GameStateSchema, BroadcastMessageSchema } from './schema'

const validGameState = {
  phase: 'lobby' as const,
  players: [{ id: 'p1', name: 'Alice', isHost: true, color: '#FF073A' }],
  hostId: 'p1',
}

describe('agario GameStateSchema', () => {
  it('accepts a valid lobby state', () => {
    expect(GameStateSchema.safeParse(validGameState).success).toBe(true)
  })

  it('rejects missing hostId', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hostId: _hostId, ...invalid } = validGameState
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects an unknown phase', () => {
    expect(GameStateSchema.safeParse({ ...validGameState, phase: 'unknown' }).success).toBe(false)
  })

  it('rejects a player missing the color field', () => {
    const invalid = {
      ...validGameState,
      players: [{ id: 'p1', name: 'Alice', isHost: true }],
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })
})

describe('agario BroadcastMessageSchema', () => {
  it('accepts a snake_update message', () => {
    const msg = {
      type: 'snake_update',
      snake: {
        id: 'p1',
        name: 'Alice',
        color: '#FF073A',
        segments: [{ x: 100, y: 100 }],
        angle: 0,
        targetLength: 30,
        score: 0,
        alive: true,
        boosting: false,
        deathTime: null,
        foodEaten: 0,
      },
    }
    expect(BroadcastMessageSchema.safeParse(msg).success).toBe(true)
  })

  it('accepts a game_end message', () => {
    expect(BroadcastMessageSchema.safeParse({ type: 'game_end' }).success).toBe(true)
  })

  it('rejects an unknown message type', () => {
    expect(BroadcastMessageSchema.safeParse({ type: 'unknown_event' }).success).toBe(false)
  })

  it('rejects snake_update with missing snake fields', () => {
    const msg = { type: 'snake_update', snake: { id: 'p1', name: 'Alice' } }
    expect(BroadcastMessageSchema.safeParse(msg).success).toBe(false)
  })
})
