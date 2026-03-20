import { GameLayout } from '@/components/GameLayout'
import { CodenamesGame } from '@/games/codenames/CodenamesGame'

export default function CodenamesPage() {
  return (
    <GameLayout title="Codenames" slug="codenames">
      <CodenamesGame />
    </GameLayout>
  )
}
