import type { Metadata } from 'next'
import { games } from '@/data/games'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { UnoGame } from '@/games/uno/UnoGame'

const game = games.find((g) => g.slug === 'uno')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function UnoPage() {
  return (
    <ErrorBoundary>
      <UnoGame />
    </ErrorBoundary>
  )
}
