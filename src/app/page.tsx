import { games } from '@/data/games'
import { HomeExperience } from '@/components/home/HomeExperience'

export default function HomePage() {
  const liveCount = games.filter((g) => g.status === 'live').length
  const multiplayerCount = games.filter(
    (g) => g.category === 'online-multiplayer' && g.status === 'live'
  ).length
  const singleCount = games.filter(
    (g) => g.category === 'single-player' && g.status === 'live'
  ).length

  return (
    <div className="bg-background min-h-screen">
      <header className="from-accent/60 to-background border-b bg-gradient-to-b">
        <div className="mx-auto max-w-5xl px-4 pt-16 pb-12 text-center">
          <div className="mb-4 text-6xl">🎮</div>
          <h1 className="text-foreground text-5xl font-extrabold tracking-tight sm:text-6xl">
            Library Games
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">
            Discover what to play next, then jump into your library instantly.
          </p>

          <div className="mt-8 inline-flex flex-wrap justify-center gap-3">
            <div className="bg-card flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-sm">
              <span className="text-foreground font-bold">{liveCount}</span>
              <span className="text-muted-foreground">games ready to play</span>
            </div>
            <div className="bg-card flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-sm">
              <span className="text-blue-500">🧩</span>
              <span className="text-foreground font-bold">{singleCount}</span>
              <span className="text-muted-foreground">single player</span>
            </div>
            <div className="bg-card flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-sm">
              <span className="text-purple-500">👥</span>
              <span className="text-foreground font-bold">{multiplayerCount}</span>
              <span className="text-muted-foreground">multiplayer</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <HomeExperience games={games} />
      </main>

      <footer className="mt-20 border-t">
        <div className="text-muted-foreground mx-auto max-w-5xl px-4 py-6 text-center text-sm">
          Open source on{' '}
          <a
            href="https://github.com/kkulykk/library-games"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground underline underline-offset-2"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
