import { games } from '@/data/games'
import { GameGrid } from '@/components/GameGrid'

export default function HomePage() {
  const liveCount = games.filter((g) => g.status === 'live').length
  const multiplayerCount = games.filter(
    (g) => g.category === 'online-multiplayer' && g.status === 'live'
  ).length
  const singleCount = games.filter(
    (g) => g.category === 'single-player' && g.status === 'live'
  ).length

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="border-b bg-gradient-to-b from-accent/60 to-background">
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-16 text-center">
          <div className="mb-4 text-6xl">🎮</div>
          <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">
            Library Games
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            A collection of classic and modern games — no downloads, no accounts, just play.
          </p>

          {/* Stats row */}
          <div className="mt-8 inline-flex flex-wrap justify-center gap-3">
            <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm shadow-sm">
              <span className="font-bold text-foreground">{liveCount}</span>
              <span className="text-muted-foreground">games ready to play</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm shadow-sm">
              <span className="text-blue-500">🧩</span>
              <span className="font-bold text-foreground">{singleCount}</span>
              <span className="text-muted-foreground">single player</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm shadow-sm">
              <span className="text-purple-500">👥</span>
              <span className="font-bold text-foreground">{multiplayerCount}</span>
              <span className="text-muted-foreground">multiplayer</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        <GameGrid games={games} />
      </main>

      <footer className="mt-20 border-t">
        <div className="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-muted-foreground">
          Open source on{' '}
          <a
            href="https://github.com/kkulykk/library-games"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
