import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { MindmeldGame } from '@/games/mindmeld/MindmeldGame'

const game = games.find((g) => g.slug === 'mindmeld')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function MindmeldPage() {
  return (
    <GameLayout title="Mindmeld" slug="mindmeld">
      <MindmeldGame />
    </GameLayout>
  )
}
