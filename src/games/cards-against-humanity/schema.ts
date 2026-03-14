import { z } from 'zod'

const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  isHost: z.boolean(),
})

const BlackCardSchema = z.object({
  text: z.string(),
  pick: z.number(),
})

export const GameStateSchema = z.object({
  phase: z.enum(['lobby', 'playing', 'judging', 'reveal', 'finished']),
  players: z.array(PlayerSchema),
  czarIndex: z.number(),
  blackCard: BlackCardSchema.nullable(),
  hands: z.record(z.string(), z.array(z.number())),
  submissions: z.record(z.string(), z.array(z.number())),
  revealOrder: z.array(z.string()),
  revealIndex: z.number(),
  roundWinnerId: z.string().nullable(),
  scores: z.record(z.string(), z.number()),
  pointsToWin: z.number(),
  winnerId: z.string().nullable(),
  blackDeck: z.array(z.number()),
  whiteDeck: z.array(z.number()),
  handSize: z.number(),
})
