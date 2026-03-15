import { GameLayout } from '@/components/GameLayout'
import { SudokuGame } from '@/games/sudoku/SudokuGame'

export default function SudokuPage() {
  return (
    <GameLayout title="Sudoku" slug="sudoku">
      <SudokuGame />
    </GameLayout>
  )
}
