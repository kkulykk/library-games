import { GameLayout } from '@/components/GameLayout'
import { UnoGame } from '@/games/uno/UnoGame'

export default function UnoPage() {
  return (
    <GameLayout title="UNO">
      <UnoGame />
    </GameLayout>
  )
}
