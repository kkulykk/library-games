'use client'

import { useEffect, useState } from 'react'
import { type GameMeta } from '@/data/games'
import { DiscoverView } from './DiscoverView'
import { LibraryView } from './LibraryView'

type HomeTab = 'discover' | 'library'

interface HomeExperienceProps {
  games: GameMeta[]
}

const STORAGE_KEY = 'library-games-tab'

export function HomeExperience({ games }: HomeExperienceProps) {
  const [tab, setTab] = useState<HomeTab>('discover')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'library' || saved === 'discover') setTab(saved)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, tab)
    } catch {}
  }, [tab])

  const liveCount = games.filter((g) => g.status === 'live').length

  return (
    <>
      <nav className="topnav">
        <div className="brand">
          <span className="brand-mark">L</span>
          <span>LIBRARY GAMES</span>
          <span className="brand-suffix">v0.7</span>
        </div>
        <div className="tabs">
          <button
            className={`tab ${tab === 'discover' ? 'is-on' : ''}`}
            onClick={() => setTab('discover')}
          >
            ▸ DISCOVER
          </button>
          <button
            className={`tab ${tab === 'library' ? 'is-on' : ''}`}
            onClick={() => setTab('library')}
          >
            ▸ LIBRARY
          </button>
        </div>
        <div className="nav-right">
          <span className="mono nav-time">
            {games.length} TITLES · {liveCount} LIVE
          </span>
        </div>
      </nav>

      {tab === 'discover' ? (
        <DiscoverView games={games} onOpenLibrary={() => setTab('library')} />
      ) : (
        <LibraryView games={games} />
      )}
    </>
  )
}
