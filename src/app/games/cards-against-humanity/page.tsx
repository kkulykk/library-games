import { GameLayout } from '@/components/GameLayout'
import { CardsAgainstHumanityGame } from '@/games/cards-against-humanity/CardsAgainstHumanityGame'

export default function CardsAgainstHumanityPage() {
  return (
    <GameLayout title="Cards Against Humanity" slug="cards-against-humanity">
      <CardsAgainstHumanityGame />
    </GameLayout>
  )
}
