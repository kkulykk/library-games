import { z } from 'zod'

import { playerNameSchema } from '@/lib/player-name'

const PlayerSchema = z.object({
  id: z.string(),
  name: playerNameSchema,
  isHost: z.boolean(),
  score: z.number().int().min(0),
})

const GuessSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const PanoSchema = z.object({
  url: z.string(),
  page: z.string(),
  author: z.string(),
  license: z.string(),
})

const LocationSchema = z.object({
  name: z.string(),
  country: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  emoji: z.string(),
  clues: z.array(z.string()),
  pano: PanoSchema.optional(),
})

const RoundSchema = z.object({
  number: z.number().int().min(1),
  location: LocationSchema,
  guesses: z.record(z.string(), GuessSchema),
  distances: z.record(z.string(), z.number().min(0)),
  roundScores: z.record(z.string(), z.number().int().min(0)),
  phase: z.enum(['guessing', 'reveal']),
})

export const GameStateSchema = z.object({
  phase: z.enum(['lobby', 'playing', 'finished']),
  players: z.array(PlayerSchema),
  totalRounds: z.number().int().min(1),
  roundNumber: z.number().int().min(0),
  deck: z.array(LocationSchema),
  currentRound: RoundSchema.nullable(),
  log: z.array(z.string()),
})

export type GameState = z.infer<typeof GameStateSchema>
