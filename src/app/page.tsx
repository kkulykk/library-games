import { games } from '@/data/games'
import { HomeExperience } from '@/components/home/HomeExperience'

export default function HomePage() {
  return (
    <main>
      <HomeExperience games={games} />
    </main>
  )
}
