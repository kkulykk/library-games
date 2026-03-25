import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { WordleGame } from '@/games/wordle/WordleGame'

const game = games.find((g) => g.slug === 'wordle')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function WordlePage() {
  return (
    <GameLayout title="Wordle" slug="wordle">
      <WordleGame />
    </GameLayout>
  )
}
