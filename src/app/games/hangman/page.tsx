import { GameLayout } from '@/components/GameLayout'
import { HangmanGame } from '@/games/hangman/HangmanGame'

export default function HangmanPage() {
  return (
    <GameLayout title="Hangman">
      <HangmanGame />
    </GameLayout>
  )
}
