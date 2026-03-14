import { z } from 'zod'

const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

const LobbyPlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  isHost: z.boolean(),
  color: z.string(),
})

export const GameStateSchema = z.object({
  phase: z.enum(['lobby', 'playing', 'finished']),
  players: z.array(LobbyPlayerSchema),
  hostId: z.string(),
})

const SnakeStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  segments: z.array(PositionSchema),
  angle: z.number(),
  targetLength: z.number(),
  score: z.number(),
  alive: z.boolean(),
  boosting: z.boolean(),
  deathTime: z.number().nullable(),
  foodEaten: z.number(),
})

const FoodSchema = z.object({
  id: z.number(),
  x: z.number(),
  y: z.number(),
  color: z.string(),
  size: z.number(),
})

export const BroadcastMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('snake_update'), snake: SnakeStateSchema }),
  z.object({ type: z.literal('food_sync'), food: z.array(FoodSchema), nextFoodId: z.number() }),
  z.object({ type: z.literal('eat_food'), playerId: z.string(), foodIds: z.array(z.number()) }),
  z.object({ type: z.literal('snake_killed'), killerId: z.string(), killedId: z.string() }),
  z.object({ type: z.literal('death_food'), food: z.array(FoodSchema) }),
  z.object({
    type: z.literal('game_start'),
    startTime: z.number(),
    food: z.array(FoodSchema),
    nextFoodId: z.number(),
  }),
  z.object({ type: z.literal('game_end') }),
])
