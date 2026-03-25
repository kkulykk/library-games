import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { SnakeGame } from '@/games/snake/SnakeGame'

const game = games.find((g) => g.slug === 'snake')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function SnakePage() {
  return (
    <GameLayout title="Snake" slug="snake">
      <SnakeGame />
    </GameLayout>
  )
}
