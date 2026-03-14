import { z } from 'zod'

const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  isHost: z.boolean(),
  score: z.number(),
})

const DrawPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  color: z.string(),
  size: z.number(),
  tool: z.enum(['pen', 'eraser']),
})

const DrawStrokeSchema = z.object({
  points: z.array(DrawPointSchema),
})

const ChatMessageSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  playerName: z.string(),
  text: z.string(),
  isCorrect: z.boolean().optional(),
  isSystem: z.boolean().optional(),
})

export const GameStateSchema = z.object({
  phase: z.enum(['lobby', 'picking', 'drawing', 'round-end', 'finished']),
  players: z.array(PlayerSchema),
  currentDrawerIndex: z.number(),
  round: z.number(),
  totalRounds: z.number(),
  word: z.string().nullable(),
  wordChoices: z.array(z.string()),
  hint: z.string(),
  strokes: z.array(DrawStrokeSchema),
  messages: z.array(ChatMessageSchema),
  guessedPlayers: z.array(z.string()),
  drawStartTime: z.number().nullable(),
  turnDuration: z.number(),
  turnEndTime: z.number().nullable(),
})
