import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import BounceGame from '@/games/bounce/BounceGame'

const game = games.find((g) => g.slug === 'bounce')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function BouncePage() {
  return (
    <GameLayout title="Doodle Jump" slug="bounce">
      <BounceGame />
    </GameLayout>
  )
}
