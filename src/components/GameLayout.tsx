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
    <div className="bg-background flex min-h-screen flex-col">
      <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-foreground text-sm font-semibold">{title}</h1>
          </div>
          {score && <div className="text-sm font-medium">{score}</div>}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
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
