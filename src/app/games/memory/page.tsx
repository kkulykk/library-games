import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { MemoryGame } from '@/games/memory/MemoryGame'

const game = games.find((g) => g.slug === 'memory')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function MemoryPage() {
  return (
    <GameLayout title="Memory Pairs" slug="memory">
      <MemoryGame />
    </GameLayout>
  )
}
