import { z } from 'zod'

const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  isHost: z.boolean(),
})

const CardSchema = z.object({
  id: z.string(),
  color: z.enum(['red', 'yellow', 'green', 'blue', 'wild']),
  value: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
    z.literal(8),
    z.literal(9),
    z.literal('skip'),
    z.literal('reverse'),
    z.literal('draw2'),
    z.literal('wild'),
    z.literal('wild4'),
  ]),
})

export const GameStateSchema = z.object({
  phase: z.enum(['lobby', 'playing', 'finished']),
  players: z.array(PlayerSchema),
  hands: z.record(z.string(), z.array(CardSchema)),
  drawPile: z.array(CardSchema),
  discardPile: z.array(CardSchema),
  currentPlayerIndex: z.number(),
  direction: z.union([z.literal(1), z.literal(-1)]),
  currentColor: z.enum(['red', 'yellow', 'green', 'blue']),
  pendingDrawCount: z.number(),
  calledUno: z.array(z.string()),
  winnerId: z.string().nullable(),
  drawnCardId: z.string().nullable(),
  unoWindow: z.record(z.string(), z.number()),
})

export type GameState = z.infer<typeof GameStateSchema>
