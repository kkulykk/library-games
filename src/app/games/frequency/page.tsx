import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { FrequencyGame } from '@/games/frequency/FrequencyGame'

const game = games.find((g) => g.slug === 'frequency')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function FrequencyPage() {
  return (
    <GameLayout title="Frequency" slug="frequency">
      <FrequencyGame />
    </GameLayout>
  )
}
