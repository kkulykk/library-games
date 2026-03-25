import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { MinesweeperGame } from '@/games/minesweeper/MinesweeperGame'

const game = games.find((g) => g.slug === 'minesweeper')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function MinesweeperPage() {
  return (
    <GameLayout title="Minesweeper" slug="minesweeper">
      <MinesweeperGame />
    </GameLayout>
  )
}
