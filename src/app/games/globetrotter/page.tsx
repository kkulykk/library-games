import type { Metadata } from 'next'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { games } from '@/data/games'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GlobetrotterGame } from '@/games/globetrotter/GlobetrotterGame'
import './globetrotter-design.css'

// Design-system fonts (claude.ai/design Globetrotter.html), self-hosted at
// build time via next/font and exposed as CSS variables the .gt-scope tokens
// pick up.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--gt-font-display',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--gt-font-mono',
})

const game = games.find((g) => g.slug === 'globetrotter')!

export const metadata: Metadata = {
  title: game.title,
  description: game.description,
}

export default function GlobetrotterPage() {
  return (
    <div className={`gt-scope sk-shell ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <ErrorBoundary>
        <GlobetrotterGame />
      </ErrorBoundary>
    </div>
  )
}
