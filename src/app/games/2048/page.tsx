import { GameLayout } from '@/components/GameLayout'
import { Game2048 } from '@/games/2048/Game2048'

export default function Game2048Page() {
  return (
    <GameLayout title="2048">
      <Game2048 />
    </GameLayout>
  )
}
