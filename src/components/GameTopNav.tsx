import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

interface GameTopNavProps {
  /** Game title, rendered uppercased next to the shared library mark. */
  title: string
  /** Optional muted suffix after the title (e.g. the game's genre). Hidden on mobile. */
  suffix?: ReactNode
  /** Right-aligned status slot (score, timer, or a live crumb). Defaults to "/ NOW PLAYING". */
  right?: ReactNode
  backHref?: string
}

/**
 * The single top navigation bar shared by every game page — both the
 * single-player `GameLayout` and the online-multiplayer `ArcadeShell` render it
 * so the back link, library mark, and status slot look identical everywhere.
 */
export function GameTopNav({ title, suffix, right, backHref = '/' }: GameTopNavProps) {
  return (
    <nav className="topnav">
      <Link href={backHref} className="game-back" data-testid="game-back">
        <ArrowLeft className="h-4 w-4" />
        BACK TO LIBRARY
      </Link>
      <div className="brand" style={{ fontSize: 16 }}>
        <span className="brand-mark" style={{ width: 28, height: 28, fontSize: 14 }}>
          L
        </span>
        <span>{title.toUpperCase()}</span>
        {suffix ? <span className="brand-suffix">{suffix}</span> : null}
      </div>
      <div className="nav-right">
        <span className="mono nav-time">{right ?? '/ NOW PLAYING'}</span>
      </div>
    </nav>
  )
}
