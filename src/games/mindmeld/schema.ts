import { z } from 'zod'

const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  isHost: z.boolean(),
  score: z.number().int(),
})

const SpectrumSchema = z.object({
  left: z.string(),
  right: z.string(),
})

const RoundSchema = z.object({
  number: z.number().int().min(1),
  psychicId: z.string(),
  spectrum: SpectrumSchema,
  target: z.number().int().min(-1).max(100),
  clue: z.string().nullable(),
  guesses: z.record(z.string(), z.number().int().min(0).max(100)),
  roundScores: z.record(z.string(), z.number().int().min(0)),
  phase: z.enum(['clue', 'guessing', 'reveal']),
})

export const GameStateSchema = z.object({
  phase: z.enum(['lobby', 'playing', 'finished']),
  players: z.array(PlayerSchema),
  totalRounds: z.number().int().min(1),
  roundNumber: z.number().int().min(0),
  currentRound: RoundSchema.nullable(),
  log: z.array(z.string()),
})

export type GameState = z.infer<typeof GameStateSchema>
