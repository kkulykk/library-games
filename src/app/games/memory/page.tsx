import { GameLayout } from '@/components/GameLayout'
import { MemoryGame } from '@/games/memory/MemoryGame'

export default function MemoryPage() {
  return (
    <GameLayout title="Memory Pairs">
      <MemoryGame />
    </GameLayout>
  )
}
