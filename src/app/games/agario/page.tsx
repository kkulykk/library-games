import { GameLayout } from '@/components/GameLayout'
import { AgarioGame } from '@/games/agario/AgarioGame'

export default function AgarioPage() {
  return (
    <GameLayout title="Slither.io" slug="agario">
      <AgarioGame />
    </GameLayout>
  )
}
