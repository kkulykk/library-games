import { GameLayout } from '@/components/GameLayout'
import { BreakoutGame } from '@/games/breakout/BreakoutGame'

export default function BreakoutPage() {
  return (
    <GameLayout title="Breakout">
      <BreakoutGame />
    </GameLayout>
  )
}
