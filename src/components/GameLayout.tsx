import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GameRulesGate } from '@/components/GameRulesGate'
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
      <nav className="topnav">
        <Link href="/" className="game-back" data-testid="game-back">
          <ArrowLeft className="h-4 w-4" />
          BACK TO LIBRARY
        </Link>
        <div className="brand" style={{ fontSize: 16 }}>
          <span className="brand-mark" style={{ width: 28, height: 28, fontSize: 14 }}>
            L
          </span>
          <span>{title.toUpperCase()}</span>
          {game && <span className="brand-suffix">{game.genre}</span>}
        </div>
        <div className="nav-right">
          {score ? (
            <span className="mono nav-time">{score}</span>
          ) : (
            <span className="mono nav-time">/ NOW PLAYING</span>
          )}
        </div>
      </nav>

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
          {game ? (
            <GameRulesGate emoji={game.emoji} title={game.title} rules={game.rules}>
              {children}
            </GameRulesGate>
          ) : (
            children
          )}
        </ErrorBoundary>
      </main>
    </div>
  )
}
