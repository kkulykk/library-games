import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { TetrisGame } from '@/games/tetris/TetrisGame'

const game = games.find((g) => g.slug === 'tetris')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function TetrisPage() {
  return (
    <GameLayout title="Tetris" slug="tetris">
      <TetrisGame />
    </GameLayout>
  )
}
