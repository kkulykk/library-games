import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { HangmanGame } from '@/games/hangman/HangmanGame'

const game = games.find((g) => g.slug === 'hangman')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function HangmanPage() {
  return (
    <GameLayout title="Hangman" slug="hangman">
      <HangmanGame />
    </GameLayout>
  )
}
