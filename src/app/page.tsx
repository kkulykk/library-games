import { games } from '@/data/games'
import { GameCard } from '@/components/GameCard'

export default function HomePage() {
  const liveGames = games.filter((g) => g.status === 'live')
  const comingSoonGames = games.filter((g) => g.status === 'coming-soon')

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-10 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Library Games
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            A collection of classic and modern games — no downloads, no accounts, just play.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        <section>
          <h2 className="mb-6 text-2xl font-bold text-foreground">Play Now</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {liveGames.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        </section>

        {comingSoonGames.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-2 text-2xl font-bold text-foreground">Coming Soon</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Online multiplayer games — backend in development.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {comingSoonGames.map((game) => (
                <GameCard key={game.slug} game={game} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="mt-20 border-t">
        <div className="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-muted-foreground">
          Open source on{' '}
          <a
            href="https://github.com/kkulykk/library-games"
            className="underline underline-offset-2 hover:text-foreground"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
