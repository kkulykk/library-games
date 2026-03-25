import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { Game2048 } from '@/games/2048/Game2048'

const game = games.find((g) => g.slug === '2048')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function Game2048Page() {
  return (
    <GameLayout title="2048" slug="2048">
      <Game2048 />
    </GameLayout>
  )
}
