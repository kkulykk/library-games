import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { SudokuGame } from '@/games/sudoku/SudokuGame'

const game = games.find((g) => g.slug === 'sudoku')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function SudokuPage() {
  return (
    <GameLayout title="Sudoku" slug="sudoku">
      <SudokuGame />
    </GameLayout>
  )
}
