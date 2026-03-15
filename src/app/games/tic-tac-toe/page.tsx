import { GameLayout } from '@/components/GameLayout'
import { TicTacToeGame } from '@/games/tic-tac-toe/TicTacToeGame'

export default function TicTacToePage() {
  return (
    <GameLayout title="Tic-Tac-Toe" slug="tic-tac-toe">
      <TicTacToeGame />
    </GameLayout>
  )
}
