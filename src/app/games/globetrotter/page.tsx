import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { GlobetrotterGame } from '@/games/globetrotter/GlobetrotterGame'

const game = games.find((g) => g.slug === 'globetrotter')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function GlobetrotterPage() {
  return (
    <GameLayout title="Globetrotter" slug="globetrotter">
      <GlobetrotterGame />
    </GameLayout>
  )
}
