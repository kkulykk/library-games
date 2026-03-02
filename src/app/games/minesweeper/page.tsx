import { GameLayout } from '@/components/GameLayout'
import { MinesweeperGame } from '@/games/minesweeper/MinesweeperGame'

export default function MinesweeperPage() {
  return (
    <GameLayout title="Minesweeper">
      <MinesweeperGame />
    </GameLayout>
  )
}
