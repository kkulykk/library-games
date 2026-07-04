'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/utils'
import { MAP_HEIGHT, MAP_WIDTH, project, unproject, type Guess } from './logic'
import { LAND_RINGS } from './worldMap'

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
  /** Revealed answer: rendered as a gold marker with dashed lines to every pin. */
  target?: MapTarget | null
  onSelect?: (guess: Guess) => void
  interactive?: boolean
  testId?: string
  className?: string
  ariaLabel?: string
}

interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

const FULL_VIEW: ViewBox = { x: 0, y: 0, w: MAP_WIDTH, h: MAP_HEIGHT }
const MAX_ZOOM = 12
const GRATICULE_STEP = 30
// Screen-pixel movement below this is a click (drop a pin), above it a pan.
const CLICK_SLOP_PX = 5

function clampView(view: ViewBox): ViewBox {
  const w = Math.min(MAP_WIDTH, Math.max(MAP_WIDTH / MAX_ZOOM, view.w))
  const h = w / 2
  return {
    w,
    h,
    x: Math.min(MAP_WIDTH - w, Math.max(0, view.x)),
    y: Math.min(MAP_HEIGHT - h, Math.max(0, view.y)),
  }
}

// Natural Earth land rings → one SVG path (even-odd fill renders holes like
// the Caspian Sea as water). Longitudes are unwrapped so rings crossing the
// antimeridian (Chukotka, Fiji, Antarctica) stay continuous instead of drawing
// a line across the whole map; the path is then drawn at x offsets −360/0/+360
// inside a clip so the unwrapped part reappears on the correct edge.
// Module-level: the geometry never changes.
const LAND_PATH = LAND_RINGS.map((ring) => {
  let previousLng = ring[0][0]
  const d = ring.map(([rawLng, lat], index) => {
    let lng = rawLng
    while (lng - previousLng > 180) lng -= 360
    while (lng - previousLng < -180) lng += 360
    previousLng = lng
    const x = ((lng + 180) / 360) * MAP_WIDTH
    const y = ((90 - lat) / 180) * MAP_HEIGHT
    return `${index === 0 ? 'M' : 'L'}${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100}`
  })
  return d.join('') + 'Z'
}).join('')

export function WorldMap({
  pins = [],
  target = null,
  onSelect,
  interactive = false,
  testId = 'globetrotter-map',
  className,
  ariaLabel = 'World map',
}: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [view, setView] = useState<ViewBox>(FULL_VIEW)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origin: ViewBox
    moved: boolean
  } | null>(null)

  const zoom = MAP_WIDTH / view.w

  const graticule = useMemo(() => {
    const meridians: number[] = []
    const parallels: number[] = []
    for (let lng = -180 + GRATICULE_STEP; lng < 180; lng += GRATICULE_STEP) {
      meridians.push(project(0, lng).x)
    }
    for (let lat = -90 + GRATICULE_STEP; lat < 90; lat += GRATICULE_STEP) {
      parallels.push(project(lat, 0).y)
    }
    return { meridians, parallels }
  }, [])

  function toViewBoxPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    return {
      x: view.x + ((clientX - rect.left) / rect.width) * view.w,
      y: view.y + ((clientY - rect.top) / rect.height) * view.h,
    }
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const point = toViewBoxPoint(clientX, clientY)
    if (!point) return
    setView((current) => {
      const w = Math.min(MAP_WIDTH, Math.max(MAP_WIDTH / MAX_ZOOM, current.w / factor))
      const ratio = w / current.w
      return clampView({
        w,
        h: w / 2,
        x: point.x - (point.x - current.x) * ratio,
        y: point.y - (point.y - current.y) * ratio,
      })
    })
  }

  function zoomCentered(factor: number) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor)
  }

  // Wheel zoom needs a non-passive listener (preventDefault stops page scroll),
  // so it is attached manually instead of via React's onWheel.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.35 : 1 / 1.35)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  })

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: view,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const dxPx = event.clientX - drag.startX
    const dyPx = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(dxPx, dyPx) < CLICK_SLOP_PX) return
    drag.moved = true
    const unitsPerPx = drag.origin.w / rect.width
    setView(
      clampView({
        ...drag.origin,
        x: drag.origin.x - dxPx * unitsPerPx,
        y: drag.origin.y - dyPx * unitsPerPx,
      })
    )
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (drag.moved || !interactive || !onSelect) return
    const point = toViewBoxPoint(event.clientX, event.clientY)
    if (!point) return
    onSelect(unproject(point.x, point.y))
  }

  const targetXY = target ? project(target.lat, target.lng) : null
  // Divide by zoom so markers keep a constant on-screen size while zooming.
  const s = (value: number) => value / zoom

  return (
    <div className={cn('relative', className)}>
      <svg
        ref={svgRef}
        data-testid={testId}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={cn(
          'block w-full touch-none select-none',
          interactive ? 'cursor-crosshair' : 'cursor-grab'
        )}
        style={{ aspectRatio: '2 / 1' }}
      >
        <defs>
          <radialGradient id="globetrotter-ocean" cx="50%" cy="40%" r="80%">
            <stop offset="0%" stopColor="#0e2a40" />
            <stop offset="100%" stopColor="#071120" />
          </radialGradient>
          <path id="globetrotter-land" d={LAND_PATH} />
          <clipPath id="globetrotter-map-clip">
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} />
          </clipPath>
        </defs>

        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#globetrotter-ocean)" />

        {graticule.meridians.map((x) => (
          <line
            key={`m${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={MAP_HEIGHT}
            stroke="rgba(125,211,252,0.08)"
            strokeWidth={s(0.4)}
          />
        ))}
        {graticule.parallels.map((y) => (
          <line
            key={`p${y}`}
            x1={0}
            y1={y}
            x2={MAP_WIDTH}
            y2={y}
            stroke="rgba(125,211,252,0.08)"
            strokeWidth={s(0.4)}
          />
        ))}

        <g
          clipPath="url(#globetrotter-map-clip)"
          fill="#1d4a3f"
          fillRule="evenodd"
          stroke="#67e8c8"
          strokeOpacity="0.55"
          strokeWidth={s(0.35)}
          strokeLinejoin="round"
        >
          <use href="#globetrotter-land" x={-MAP_WIDTH} />
          <use href="#globetrotter-land" />
          <use href="#globetrotter-land" x={MAP_WIDTH} />
        </g>

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
                strokeWidth={s(0.7)}
                strokeDasharray={`${s(2)} ${s(2)}`}
                opacity="0.85"
              />
            )
          })}

        {pins.map((pin, index) => {
          const { x, y } = project(pin.lat, pin.lng)
          return (
            <g key={`pin-${index}`}>
              <circle
                cx={x}
                cy={y}
                r={s(3.2)}
                fill={pin.color}
                stroke="#fff"
                strokeWidth={s(0.9)}
              />
              {pin.label && (
                <text
                  x={x}
                  y={y - s(5)}
                  textAnchor="middle"
                  fontSize={s(6)}
                  fontWeight="700"
                  fill="#f8fafc"
                  stroke="rgba(2,6,23,0.85)"
                  strokeWidth={s(0.6)}
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
              r={s(6)}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={s(0.9)}
              opacity="0.9"
            />
            <circle
              cx={targetXY.x}
              cy={targetXY.y}
              r={s(2.6)}
              fill="#fbbf24"
              stroke="#0f172a"
              strokeWidth={s(0.7)}
            />
          </g>
        )}
      </svg>

      <div className="absolute right-2 bottom-2 flex flex-col gap-1">
        <button
          type="button"
          aria-label="Zoom in"
          data-testid="globetrotter-zoom-in"
          onClick={() => zoomCentered(1.6)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-slate-900/80 text-sm font-bold text-white/80 transition hover:bg-slate-800"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          data-testid="globetrotter-zoom-out"
          onClick={() => zoomCentered(1 / 1.6)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-slate-900/80 text-sm font-bold text-white/80 transition hover:bg-slate-800"
        >
          −
        </button>
        {zoom > 1.01 && (
          <button
            type="button"
            aria-label="Reset zoom"
            data-testid="globetrotter-zoom-reset"
            onClick={() => setView(FULL_VIEW)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-slate-900/80 text-[10px] font-bold text-white/80 transition hover:bg-slate-800"
          >
            ⤢
          </button>
        )}
      </div>
    </div>
  )
}
