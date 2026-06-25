import type { ReactNode } from 'react'

/**
 * Curated "How to play" content, keyed by game slug. Optional — when a game has
 * no entry here, `GameHowTo` derives its intro from the game's `games.ts`
 * metadata (`short`, `description`, `rules`). Curated entries let a game supply
 * the polished tagline, meta line, and titled/illustrated step cards from its
 * design spec (e.g. Tetris).
 */
export interface HowToStep {
  num: string
  title: string
  desc: string
  icon?: ReactNode
}

export interface HowToConfig {
  tag?: string
  tagline?: string
  sub?: string
  meta?: string
  steps?: HowToStep[]
}

const iconProps = {
  viewBox: '0 0 32 32',
  width: 24,
  height: 24,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const howToConfigs: Record<string, HowToConfig> = {
  tetris: {
    tag: 'Arcade · Single player',
    tagline: 'Stack it. Clear it. Survive it.',
    sub: 'Seven shapes fall, one at a time. Slide and rotate each to pack the rows tight — complete a line and it vanishes. The deeper you go, the faster they drop.',
    meta: '10×20 · marathon · gravity climbs',
    steps: [
      {
        num: '01 · Move',
        title: 'Slide & rotate',
        desc: 'Arrows nudge the piece left and right. Up (or X / Z) spins it to fit the gap.',
        icon: (
          <svg {...iconProps}>
            <rect x="13" y="12" width="6" height="6" fill="currentColor" stroke="none" />
            <path d="M 9 15 L 4 15 M 7 12 L 4 15 L 7 18" />
            <path d="M 23 15 L 28 15 M 25 12 L 28 15 L 25 18" />
          </svg>
        ),
      },
      {
        num: '02 · Drop',
        title: 'Soft & hard drop',
        desc: 'Hold Down to speed the fall, or hit Space to slam it straight to the floor.',
        icon: (
          <svg {...iconProps}>
            <rect x="13" y="4" width="6" height="6" fill="currentColor" stroke="none" />
            <path d="M 16 12 L 16 23 M 11 18 L 16 23 L 21 18" />
            <path d="M 7 27 L 25 27" />
          </svg>
        ),
      },
      {
        num: '03 · Clear',
        title: 'Fill a row',
        desc: 'Complete a horizontal line to clear it. Four at once is a Tetris — max points.',
        icon: (
          <svg {...iconProps} strokeLinecap="butt">
            <rect x="4" y="14" width="6" height="6" />
            <rect x="11" y="14" width="6" height="6" />
            <rect x="18" y="14" width="6" height="6" fill="currentColor" stroke="none" />
            <path d="M 27 9 L 29 11 M 28 17 L 30 17 M 27 25 L 29 23" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        num: '04 · Climb',
        title: 'Levels speed up',
        desc: 'Every 10 lines bumps the level. Higher level, faster gravity, fatter score.',
        icon: (
          <svg {...iconProps}>
            <path d="M 7 19 L 16 10 L 25 19" />
            <path d="M 7 25 L 16 16 L 25 25" />
          </svg>
        ),
      },
    ],
  },
}
