import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GameHowTo } from '@/components/GameHowTo'
import { GameTopNav } from '@/components/GameTopNav'
import { games } from '@/data/games'

interface GameLayoutProps {
  title: string
  slug: string
  children: React.ReactNode
  score?: React.ReactNode
}

export function GameLayout({ title, slug, children, score }: GameLayoutProps) {
  const game = games.find((g) => g.slug === slug)

  return (
    <div className="game-page">
      <GameTopNav title={title} suffix={game?.genre} right={score} />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
        }}
      >
        <ErrorBoundary>
          {game ? <GameHowTo game={game}>{children}</GameHowTo> : children}
        </ErrorBoundary>
      </main>
    </div>
  )
}
