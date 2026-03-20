import { z } from 'zod'

const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  isHost: z.boolean(),
  team: z.enum(['red', 'blue']).nullable(),
  role: z.enum(['spymaster', 'operative']).nullable(),
})

const BoardCardSchema = z.object({
  word: z.string(),
  type: z.enum(['red', 'blue', 'neutral', 'assassin']),
  revealed: z.boolean(),
})

const ClueSchema = z.object({
  word: z.string(),
  count: z.number(),
  team: z.enum(['red', 'blue']),
  guessesUsed: z.number(),
})

export const GameStateSchema = z.object({
  phase: z.enum(['lobby', 'playing', 'finished']),
  players: z.array(PlayerSchema),
  board: z.array(BoardCardSchema),
  currentTeam: z.enum(['red', 'blue']),
  turnPhase: z.enum(['giving_clue', 'guessing']),
  currentClue: ClueSchema.nullable(),
  redRemaining: z.number(),
  blueRemaining: z.number(),
  winningTeam: z.enum(['red', 'blue']).nullable(),
  log: z.array(z.string()),
})

export type GameState = z.infer<typeof GameStateSchema>
