import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { SkribblGame } from '@/games/skribbl/SkribblGame'

const game = games.find((g) => g.slug === 'skribbl')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function SkribblPage() {
  return (
    <GameLayout title="Skribbl" slug="skribbl">
      <SkribblGame />
    </GameLayout>
  )
}
