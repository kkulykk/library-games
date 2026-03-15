import { GameLayout } from '@/components/GameLayout'
import { UnoGame } from '@/games/uno/UnoGame'

export default function UnoPage() {
  return (
    <GameLayout title="UNO" slug="uno">
      <UnoGame />
    </GameLayout>
  )
}
