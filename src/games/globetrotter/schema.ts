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
  /** Optional: the curated pool predates multi-archive decks and omits it. */
  source: z.string().max(60).optional(),
})

/**
 * Reverse-geocoded settlement for a Random World drop. Resolved once by the
 * host and shared through the room, so a reveal costs the geocoder one lookup
 * per round rather than one per player.
 */
const PlaceSchema = z.object({
  name: z.string().min(1).max(120),
  country: z.string().max(120).nullable(),
})

const LocationSchema = z.object({
  name: z.string(),
  country: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  emoji: z.string(),
  clues: z.array(z.string()),
  pano: PanoSchema.optional(),
  place: PlaceSchema.optional(),
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

/**
 * Ephemeral room chatter, sent on the broadcast channel rather than written to
 * the room row.
 *
 * Scouting a Random World deck takes the host's browser several seconds of
 * archive requests before there is any game to write, and until now the rest of
 * the room sat looking at an unchanged lobby. Progress is the definition of
 * throwaway — safe to miss, meaningless a second later, and never something to
 * trust — so it travels as a message instead of as state. The channel is public,
 * so it is parsed like everything else that crosses the network.
 */
export const BroadcastMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('scouting'),
    found: z.number().int().min(0).max(50),
    total: z.number().int().min(1).max(50),
  }),
  z.object({ type: z.literal('scouting_done') }),
])

export type BroadcastMessage = z.infer<typeof BroadcastMessageSchema>
