'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { GameMeta } from '@/data/games'
import { howToConfigs, type HowToStep } from '@/data/howToConfigs'
import { cn } from '@/lib/utils'
import styles from './GameHowTo.module.css'

interface GameHowToProps {
  game: GameMeta
  children: ReactNode
}

/**
 * Shared "How to play" intro, consistent across every game (mirrors the
 * Skribbl/Uno arcade HowToScreen). Renders a hero + numbered step cards, then
 * gates the game behind a Play button. Content comes from a curated override in
 * `howToConfigs` when present, otherwise it is derived from the game's metadata.
 */
export function GameHowTo({ game, children }: GameHowToProps) {
  const [started, setStarted] = useState(false)

  if (started) {
    return <>{children}</>
  }

  const config = howToConfigs[game.slug] ?? {}

  const tag =
    config.tag ??
    (game.category === 'online-multiplayer'
      ? `Multiplayer · ${game.players} players`
      : `Single player · ${game.genre}`)

  const tagline = config.tagline ?? game.short
  const sub = config.sub ?? game.description

  const meta =
    config.meta ??
    [
      game.minutes ? `~${game.minutes} min` : null,
      game.players ? `${game.players} player${game.players === '1' ? '' : 's'}` : null,
      game.rating ? `★ ${game.rating.toFixed(1)}` : null,
    ]
      .filter(Boolean)
      .join(' · ')

  const steps: HowToStep[] =
    config.steps ??
    game.rules.map((rule, i) => ({
      num: `${String(i + 1).padStart(2, '0')} · Step`,
      title: '',
      desc: rule,
      icon: STEP_ICONS[i % STEP_ICONS.length],
    }))

  return (
    <div className={styles.root}>
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <span className={cn(styles.tag, 'mono')}>{tag}</span>
          <h1 className={styles.heroTitle}>{renderTagline(game.title)}</h1>
          {tagline && <p className={styles.heroTagline}>{tagline}</p>}
          <p className={styles.heroCopy}>{sub}</p>
          <div className={styles.heroActions}>
            <button
              type="button"
              data-testid="play-game-button"
              onClick={() => setStarted(true)}
              className={styles.playButton}
            >
              Play now →
            </button>
            {meta && <span className={cn(styles.heroMeta, 'mono')}>{meta}</span>}
          </div>
        </div>

        <div className={styles.steps}>
          {steps.map((step, i) => (
            <article key={i} className={cn(styles.step, i === 1 && styles.stepAccent)}>
              <span className={cn(styles.stepNumber, 'mono')}>{step.num}</span>
              <div className={styles.stepIcon}>
                {step.icon ?? STEP_ICONS[i % STEP_ICONS.length]}
              </div>
              {step.title && <div className={styles.stepTitle}>{step.title}</div>}
              <div className={styles.stepDescription}>{step.desc}</div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Accent the final word of the title, the way Skribbl accents "Lose it." */
function renderTagline(text: string): ReactNode {
  const trimmed = text.trim()
  const lastSpace = trimmed.lastIndexOf(' ')
  if (lastSpace === -1) {
    return <span className={styles.heroTitleAccent}>{trimmed}</span>
  }
  return (
    <>
      {trimmed.slice(0, lastSpace)}{' '}
      <span className={styles.heroTitleAccent}>{trimmed.slice(lastSpace + 1)}</span>
    </>
  )
}

const ICON_PROPS = {
  viewBox: '0 0 32 32',
  width: 24,
  height: 24,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
} as const

const STEP_ICONS: ReactNode[] = [
  <svg key="target" {...ICON_PROPS}>
    <circle cx="16" cy="16" r="11" />
    <circle cx="16" cy="16" r="5" />
    <path d="M16 2 L16 7 M16 25 L16 30 M2 16 L7 16 M25 16 L30 16" />
  </svg>,
  <svg key="bolt" {...ICON_PROPS}>
    <path d="M18 4 L8 18 L15 18 L14 28 L24 14 L17 14 Z" />
  </svg>,
  <svg key="grid" {...ICON_PROPS}>
    <rect x="5" y="5" width="22" height="22" rx="1" />
    <path d="M5 12 L27 12 M5 20 L27 20 M12 5 L12 27 M20 5 L20 27" />
  </svg>,
  <svg key="trophy" {...ICON_PROPS}>
    <path d="M10 6 L22 6 L22 14 Q22 20 16 20 Q10 20 10 14 Z" />
    <path d="M13 22 L19 22 L20 26 L12 26 Z" />
    <path d="M10 8 L6 8 L6 12 Q6 14 10 14 M22 8 L26 8 L26 12 Q26 14 22 14" />
  </svg>,
  <svg key="flag" {...ICON_PROPS}>
    <path d="M8 4 L8 28 M8 6 L24 6 L20 12 L24 18 L8 18" />
  </svg>,
  <svg key="spark" {...ICON_PROPS}>
    <path d="M16 4 L18 14 L28 16 L18 18 L16 28 L14 18 L4 16 L14 14 Z" />
  </svg>,
]
