import type { Metadata } from 'next'
import { games } from '@/data/games'
import { GameLayout } from '@/components/GameLayout'
import { CardsAgainstHumanityGame } from '@/games/cards-against-humanity/CardsAgainstHumanityGame'

const game = games.find((g) => g.slug === 'cards-against-humanity')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function CardsAgainstHumanityPage() {
  return (
    <GameLayout title="Cards Against Humanity" slug="cards-against-humanity">
      <CardsAgainstHumanityGame />
    </GameLayout>
  )
}
