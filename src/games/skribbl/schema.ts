import { z } from 'zod'

import { playerNameSchema } from '@/lib/player-name'

const PlayerSchema = z.object({
  id: z.string(),
  name: playerNameSchema,
  isHost: z.boolean(),
  score: z.number(),
  avatar: z.number().int().min(0).max(7).default(0),
})

// A point is only a coordinate. `color`/`size`/`tool` are constant for the whole
// stroke, so they live on the stroke — repeating them per point roughly
// quintupled the wire size of every drawing.
const DrawPointSchema = z.object({
  x: z.number(),
  y: z.number(),
})

const DrawStrokeSchema = z.object({
  points: z.array(DrawPointSchema).max(4000),
  color: z.string().max(32),
  size: z.number(),
  tool: z.enum(['pen', 'eraser']),
})

const ChatMessageSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  playerName: z.string(),
  text: z.string(),
  isCorrect: z.boolean().optional(),
  isSystem: z.boolean().optional(),
  isClose: z.boolean().optional(),
})

// NOTE: `strokes` is deliberately NOT part of the persisted state. Drawing is the
// highest-frequency event in the game and every state write rewrites the whole
// jsonb blob, re-inserts it into realtime.messages, and is re-read by every
// player — so persisting a growing stroke array made a round cost O(strokes²) in
// database I/O. Strokes now travel over the ephemeral broadcast channel instead
// (see BroadcastMessageSchema) and never touch Postgres.
export const GameStateSchema = z.object({
  phase: z.enum(['lobby', 'picking', 'drawing', 'round-end', 'finished']),
  players: z.array(PlayerSchema),
  currentDrawerIndex: z.number(),
  round: z.number(),
  totalRounds: z.number(),
  word: z.string().nullable(),
  wordChoices: z.array(z.string()),
  hint: z.string(),
  messages: z.array(ChatMessageSchema),
  guessedPlayers: z.array(z.string()),
  drawStartTime: z.number().nullable(),
  turnDuration: z.number(),
  turnEndTime: z.number().nullable(),
  scoreDeltas: z.record(z.string(), z.number()).default({}),
})

// Max strokes carried by a single `snapshot` message. A full canvas is sent as
// however many chunks it takes, so one message can never exceed Realtime's
// payload ceiling no matter how much the drawer has scribbled.
export const SNAPSHOT_CHUNK_SIZE = 40

// The broadcast topic is public — any client that knows the room code can post to
// it. Receivers must therefore both `safeParse` this schema AND check that
// `playerId` is the current drawer before applying anything.
export const BroadcastMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stroke'),
    playerId: z.string(),
    stroke: DrawStrokeSchema,
  }),
  z.object({
    type: z.literal('undo'),
    playerId: z.string(),
  }),
  z.object({
    type: z.literal('clear'),
    playerId: z.string(),
  }),
  z.object({
    type: z.literal('snapshot'),
    playerId: z.string(),
    strokes: z.array(DrawStrokeSchema).max(SNAPSHOT_CHUNK_SIZE),
    // First chunk of a snapshot replaces the canvas; later chunks append to it.
    reset: z.boolean(),
  }),
])

export type GameState = z.infer<typeof GameStateSchema>
export type BroadcastMessage = z.infer<typeof BroadcastMessageSchema>
