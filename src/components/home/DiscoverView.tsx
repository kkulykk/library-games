'use client'

import Link from 'next/link'
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { type GameMeta } from '@/data/games'
import { GamePoster } from './GamePoster'

const FEATURED_ORDER = [
  'skribbl',
  'uno',
  'cards-against-humanity',
  'agario',
  'codenames',
  'tetris',
  'mindmeld',
]

const HERO_INTERVAL_MS = 6000

function parsePlays(s: string): number {
  if (s === '—') return 0
  const n = parseFloat(s)
  if (s.includes('M')) return n * 1e6
  if (s.includes('K')) return n * 1e3
  return n
}

function useAutoplay(length: number, intervalMs: number, paused: boolean) {
  const [i, setI] = useState(0)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)

  useEffect(() => {
    if (paused || length <= 1) return
    startRef.current = performance.now()
    const tick = (t: number) => {
      const elapsed = t - startRef.current
      const p = Math.min(1, elapsed / intervalMs)
      setProgress(p)
      if (p >= 1) {
        setI((prev) => (prev + 1) % length)
        startRef.current = t
        setProgress(0)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [length, intervalMs, paused, i])

  const go = (next: number) => {
    setI(next)
    setProgress(0)
    startRef.current = performance.now()
  }
  return [i, progress, go] as const
}

interface HeroSlideProps {
  game: GameMeta
  active: boolean
}

function HeroSlide({ game, active }: HeroSlideProps) {
  const hue = game.hue
  const bg = `oklch(0.22 0.06 ${hue})`
  const tint = `oklch(0.58 0.2 ${hue})`
  const tintSoft = `oklch(0.7 0.18 ${hue})`
  return (
    <div className={`hero-slide ${active ? 'is-active' : ''}`} aria-hidden={!active}>
      <div className="hero-bg" style={{ background: bg }}>
        <div className="hero-grain" />
        <div
          className="hero-gradient"
          style={{
            background: `radial-gradient(60% 80% at 30% 40%, ${tintSoft}33, transparent 60%)`,
          }}
        />
      </div>

      <div className="hero-content">
        <div className="hero-meta">
          <span className="pill mono">NOW FEATURING</span>
          <span className="pill mono" style={{ color: tint, borderColor: tint }}>
            ● LIVE
          </span>
        </div>

        <h1 className="hero-title">{game.title}</h1>
        <p className="hero-tag" style={{ color: tint }}>
          {game.short}
        </p>
        <p className="hero-desc">{game.description}</p>

        <div className="hero-stats">
          <div className="stat">
            <span className="stat-label">GENRE</span>
            <span className="stat-val">{game.genre}</span>
          </div>
          <div className="stat">
            <span className="stat-label">PLAYERS</span>
            <span className="stat-val">{game.players}</span>
          </div>
          <div className="stat">
            <span className="stat-label">~TIME</span>
            <span className="stat-val">{game.minutes} MIN</span>
          </div>
          {game.rating !== null && (
            <div className="stat">
              <span className="stat-label">RATING</span>
              <span className="stat-val">{game.rating} ★</span>
            </div>
          )}
          <div className="stat">
            <span className="stat-label">PLAYS</span>
            <span className="stat-val">{game.plays}</span>
          </div>
        </div>

        <div className="hero-actions">
          <Link
            href={`/games/${game.slug}`}
            className="btn btn-primary"
            style={{ background: tintSoft, color: '#0a0a08' }}
          >
            <span className="btn-arrow">▶</span> PLAY NOW
          </Link>
          <Link href={`/games/${game.slug}`} className="btn btn-ghost">
            HOW TO PLAY
          </Link>
        </div>

        <div className="hero-tags">
          {game.tags.map((t) => (
            <span key={t} className="tag">
              #{t}
            </span>
          ))}
        </div>
      </div>

      <div className="hero-poster-wrap">
        <div className="hero-poster-frame" style={{ borderColor: tint }}>
          <div className="hero-poster-label mono">
            <span>POSTER · {game.slug.toUpperCase()}</span>
            <span>01</span>
          </div>
          <div className="hero-poster" style={{ background: `oklch(0.18 0.04 ${hue})` }}>
            <GamePoster slug={game.slug} />
          </div>
          <div className="hero-poster-label mono">
            <span>{game.genre}</span>
            <span className="blink">◉</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface DiscoverViewProps {
  games: GameMeta[]
  onOpenLibrary: () => void
}

export function DiscoverView({ games, onOpenLibrary }: DiscoverViewProps) {
  const featured = useMemo(() => {
    const live = games.filter((g) => g.status === 'live')
    const picked = FEATURED_ORDER.map((s) => live.find((g) => g.slug === s)).filter(
      (g): g is GameMeta => Boolean(g)
    )
    return picked.length > 0 ? picked : live.slice(0, 5)
  }, [games])

  const [i, progress, go] = useAutoplay(featured.length, HERO_INTERVAL_MS, false)

  const trending = useMemo(
    () =>
      games
        .filter((g) => g.status === 'live')
        .slice()
        .sort((a, b) => parsePlays(b.plays) - parsePlays(a.plays))
        .slice(0, 8),
    [games]
  )
  const quick = useMemo(() => games.filter((g) => g.status === 'live' && g.minutes <= 8), [games])
  const multi = useMemo(
    () => games.filter((g) => g.category === 'online-multiplayer' && g.status === 'live'),
    [games]
  )

  if (featured.length === 0) return null

  return (
    <div className="discover">
      <section className="hero">
        <div className="hero-slides">
          {featured.map((g, idx) => (
            <HeroSlide key={g.slug} game={g} active={idx === i} />
          ))}
        </div>

        <div className="hero-ticker">
          {featured.map((g, idx) => (
            <button
              key={g.slug}
              className={`ticker-item ${idx === i ? 'is-active' : ''}`}
              onClick={() => go(idx)}
            >
              <span className="ticker-num mono">{String(idx + 1).padStart(2, '0')}</span>
              <span className="ticker-title">{g.title}</span>
              <span className="ticker-bar">
                <span
                  className="ticker-fill"
                  style={{
                    width: idx < i ? '100%' : idx === i ? `${progress * 100}%` : '0%',
                  }}
                />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rail">
        <div className="rail-head">
          <h2 className="rail-title">TRENDING NOW</h2>
          <span className="rail-meta mono">Last 24h · {trending.length} titles</span>
        </div>
        <div className="rail-track">
          {trending.map((g, idx) => (
            <Link
              key={g.slug}
              className="rail-card"
              href={`/games/${g.slug}`}
              style={{ ['--hue' as string]: g.hue } as CSSProperties}
            >
              <div className="rail-rank mono">#{String(idx + 1).padStart(2, '0')}</div>
              <div className="rail-poster">
                <GamePoster slug={g.slug} />
              </div>
              <div className="rail-info">
                <div className="rail-name">{g.title}</div>
                <div className="rail-sub mono">
                  {g.genre} · {g.plays} plays
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rail rail-alt">
        <div className="rail-head">
          <h2 className="rail-title">
            QUICK PLAYS <span className="rail-title-alt">— under 10 min</span>
          </h2>
          <span className="rail-meta mono">Perfect for a coffee break</span>
        </div>
        <div className="quick-grid">
          {quick.map((g) => (
            <Link
              key={g.slug}
              className="quick-card"
              href={`/games/${g.slug}`}
              style={{ ['--hue' as string]: g.hue } as CSSProperties}
            >
              <div className="quick-time mono">{g.minutes}′</div>
              <div className="quick-poster">
                <GamePoster slug={g.slug} />
              </div>
              <div className="quick-info">
                <span className="quick-name">{g.title}</span>
                <span className="quick-arrow">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rail">
        <div className="rail-head">
          <h2 className="rail-title">MULTIPLAYER TONIGHT</h2>
          <span className="rail-meta mono">Grab your crew · {multi.length} live rooms</span>
        </div>
        <div className="multi-grid">
          {multi.map((g) => (
            <Link
              key={g.slug}
              className="multi-card"
              href={`/games/${g.slug}`}
              style={{ ['--hue' as string]: g.hue } as CSSProperties}
            >
              <div className="multi-poster">
                <GamePoster slug={g.slug} />
              </div>
              <div className="multi-body">
                <div className="multi-top mono">
                  <span>{g.players} PLAYERS</span>
                  <span className="live-dot">● LIVE</span>
                </div>
                <h3 className="multi-name">{g.title}</h3>
                <p className="multi-desc">{g.short}</p>
                <div className="multi-bottom">
                  <span className="mono">{g.genre}</span>
                  <span className="multi-join">JOIN →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="cta-strip">
        <div className="cta-inner">
          <div>
            <p className="mono cta-eyebrow">EXPLORE EVERYTHING</p>
            <h2 className="cta-title">The full library. {games.length} titles. All free.</h2>
          </div>
          <button className="btn btn-primary btn-big" onClick={onOpenLibrary}>
            OPEN LIBRARY →
          </button>
        </div>
      </section>
    </div>
  )
}
