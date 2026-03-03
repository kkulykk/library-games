import GameLayout from '@/components/GameLayout'
import BounceGame from '@/games/bounce/BounceGame'

export default function BouncePage() {
  return (
    <GameLayout title="Bounce">
      <BounceGame />
    </GameLayout>
  )
}
