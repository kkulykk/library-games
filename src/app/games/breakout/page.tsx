import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { BreakoutGame } from '@/games/breakout/BreakoutGame'

const game = games.find((g) => g.slug === 'breakout')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function BreakoutPage() {
  return (
    <GameLayout title="Breakout" slug="breakout">
      <BreakoutGame />
    </GameLayout>
  )
}
