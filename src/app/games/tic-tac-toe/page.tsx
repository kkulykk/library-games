import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { TicTacToeGame } from '@/games/tic-tac-toe/TicTacToeGame'

const game = games.find((g) => g.slug === 'tic-tac-toe')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function TicTacToePage() {
  return (
    <GameLayout title="Tic-Tac-Toe" slug="tic-tac-toe">
      <TicTacToeGame />
    </GameLayout>
  )
}
