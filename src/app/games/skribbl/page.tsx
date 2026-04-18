import type { Metadata } from 'next'
import { games } from '@/data/games'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SkribblGame } from '@/games/skribbl/SkribblGame'

const game = games.find((g) => g.slug === 'skribbl')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function SkribblPage() {
  return (
    <ErrorBoundary>
      <SkribblGame />
    </ErrorBoundary>
  )
}
