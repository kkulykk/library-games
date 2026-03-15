import { GameLayout } from '@/components/GameLayout'
import { SnakeGame } from '@/games/snake/SnakeGame'

export default function SnakePage() {
  return (
    <GameLayout title="Snake" slug="snake">
      <SnakeGame />
    </GameLayout>
  )
}
