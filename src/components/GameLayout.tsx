import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface GameLayoutProps {
  title: string
  children: React.ReactNode
  score?: React.ReactNode
}

export function GameLayout({ title, children, score }: GameLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          </div>
          {score && <div className="text-sm font-medium">{score}</div>}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">{children}</main>
    </div>
  )
}
