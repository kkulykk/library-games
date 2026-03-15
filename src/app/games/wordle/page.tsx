import { GameLayout } from '@/components/GameLayout'
import { WordleGame } from '@/games/wordle/WordleGame'

export default function WordlePage() {
  return (
    <GameLayout title="Wordle" slug="wordle">
      <WordleGame />
    </GameLayout>
  )
}
