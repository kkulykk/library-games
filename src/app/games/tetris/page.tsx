import { GameLayout } from '@/components/GameLayout'
import { TetrisGame } from '@/games/tetris/TetrisGame'

export default function TetrisPage() {
  return (
    <GameLayout title="Tetris">
      <TetrisGame />
    </GameLayout>
  )
}
