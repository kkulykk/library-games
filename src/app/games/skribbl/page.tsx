import { GameLayout } from '@/components/GameLayout'
import { SkribblGame } from '@/games/skribbl/SkribblGame'

export default function SkribblPage() {
  return (
    <GameLayout title="Skribbl">
      <SkribblGame />
    </GameLayout>
  )
}
