'use client'

import { useMemo } from 'react'
import type { MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import { MAP_HEIGHT, MAP_WIDTH, project, unproject, type Guess } from './logic'
import { landDots } from './worldMap'

export interface MapPin {
  lat: number
  lng: number
  color: string
  label?: string
}

export interface MapTarget {
  lat: number
  lng: number
}

interface WorldMapProps {
  pins?: MapPin[]
  /** Revealed answer: rendered as a pulsing marker with dashed lines to every pin. */
  target?: MapTarget | null
  onSelect?: (guess: Guess) => void
  interactive?: boolean
  testId?: string
  className?: string
  ariaLabel?: string
}

const GRATICULE_STEP = 30

export function WorldMap({
  pins = [],
  target = null,
  onSelect,
  interactive = false,
  testId = 'globetrotter-map',
  className,
  ariaLabel = 'World map',
}: WorldMapProps) {
  const dots = useMemo(() => landDots(3).map(({ lat, lng }) => project(lat, lng)), [])

  const meridians = useMemo(() => {
    const lines: number[] = []
    for (let lng = -180 + GRATICULE_STEP; lng < 180; lng += GRATICULE_STEP) {
      lines.push(project(0, lng).x)
    }
    return lines
  }, [])

  const parallels = useMemo(() => {
    const lines: number[] = []
    for (let lat = -90 + GRATICULE_STEP; lat < 90; lat += GRATICULE_STEP) {
      lines.push(project(lat, 0).y)
    }
    return lines
  }, [])

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    if (!interactive || !onSelect) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const x = ((event.clientX - rect.left) / rect.width) * MAP_WIDTH
    const y = ((event.clientY - rect.top) / rect.height) * MAP_HEIGHT
    onSelect(unproject(x, y))
  }

  const targetXY = target ? project(target.lat, target.lng) : null

  return (
    <svg
      data-testid={testId}
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      role="img"
      aria-label={ariaLabel}
      onClick={handleClick}
      className={cn('block w-full select-none', interactive && 'cursor-crosshair', className)}
      style={{ aspectRatio: '2 / 1' }}
    >
      <defs>
        <radialGradient id="globetrotter-ocean" cx="50%" cy="40%" r="80%">
          <stop offset="0%" stopColor="#0c2436" />
          <stop offset="100%" stopColor="#060e18" />
        </radialGradient>
      </defs>

      <rect width={MAP_WIDTH} height={MAP_HEIGHT} rx="6" fill="url(#globetrotter-ocean)" />

      {meridians.map((x) => (
        <line
          key={`m${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={MAP_HEIGHT}
          stroke="rgba(94,234,212,0.07)"
          strokeWidth="0.4"
        />
      ))}
      {parallels.map((y) => (
        <line
          key={`p${y}`}
          x1={0}
          y1={y}
          x2={MAP_WIDTH}
          y2={y}
          stroke="rgba(94,234,212,0.07)"
          strokeWidth="0.4"
        />
      ))}

      {dots.map(({ x, y }) => (
        <circle key={`${x}:${y}`} cx={x} cy={y} r="0.95" fill="rgba(110,231,183,0.55)" />
      ))}

      {targetXY &&
        pins.map((pin, index) => {
          const { x, y } = project(pin.lat, pin.lng)
          return (
            <line
              key={`line-${index}`}
              x1={x}
              y1={y}
              x2={targetXY.x}
              y2={targetXY.y}
              stroke={pin.color}
              strokeWidth="0.7"
              strokeDasharray="2 2"
              opacity="0.85"
            />
          )
        })}

      {pins.map((pin, index) => {
        const { x, y } = project(pin.lat, pin.lng)
        return (
          <g key={`pin-${index}`}>
            <circle cx={x} cy={y} r="3.2" fill={pin.color} stroke="#fff" strokeWidth="0.9" />
            {pin.label && (
              <text
                x={x}
                y={y - 5}
                textAnchor="middle"
                fontSize="6"
                fontWeight="700"
                fill="#f8fafc"
                stroke="rgba(2,6,23,0.85)"
                strokeWidth="0.6"
                paintOrder="stroke"
              >
                {pin.label}
              </text>
            )}
          </g>
        )
      })}

      {targetXY && (
        <g data-testid="globetrotter-map-target">
          <circle
            cx={targetXY.x}
            cy={targetXY.y}
            r="6"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="0.9"
            opacity="0.9"
          />
          <circle
            cx={targetXY.x}
            cy={targetXY.y}
            r="2.6"
            fill="#fbbf24"
            stroke="#0f172a"
            strokeWidth="0.7"
          />
        </g>
      )}
    </svg>
  )
}
