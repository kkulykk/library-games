'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/utils'
import { MAP_HEIGHT, MAP_WIDTH, project, unproject, type Guess } from './logic'
import { avatarHue } from './avatars'
import { LAND_RINGS } from './worldMap'

export interface MapPin {
  lat: number
  lng: number
  /** Roster index — colors the pin with the matching avatar hue. */
  hueIndex?: number
  isYou?: boolean
  pending?: boolean
}

export interface MapTarget {
  lat: number
  lng: number
}

interface WorldMapProps {
  pins?: MapPin[]
  /** Locked opponents' guesses shown as ghost dots while you still guess. */
  ghosts?: Guess[]
  /** Revealed answer: gold flag marker + dashed connectors to every pin. */
  target?: MapTarget | null
  onSelect?: (guess: Guess) => void
  interactive?: boolean
  testId?: string
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
const GRID_STEP = 15
// Screen-pixel movement below this is a click (drop a pin), above it a pan.
const CLICK_SLOP_PX = 5
const TROPIC_LAT = 23.44

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
  ghosts = [],
  target = null,
  onSelect,
  interactive = false,
  testId = 'globetrotter-map',
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
    for (let x = GRID_STEP; x < MAP_WIDTH; x += GRID_STEP) meridians.push(x)
    for (let y = GRID_STEP; y < MAP_HEIGHT; y += GRID_STEP) parallels.push(y)
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
    <div className="gt-mapwrap">
      <svg
        ref={svgRef}
        data-testid={testId}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={cn('gt-map-svg', interactive && 'is-pickable')}
      >
        <defs>
          <path id="globetrotter-land" d={LAND_PATH} />
          <clipPath id="globetrotter-map-clip">
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} />
          </clipPath>
        </defs>

        <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="gt-map-ocean" />

        {graticule.meridians.map((x) => (
          <line
            key={`m${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={MAP_HEIGHT}
            className="gt-map-grid-line"
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
            className="gt-map-grid-line"
            strokeWidth={s(0.4)}
          />
        ))}

        <g clipPath="url(#globetrotter-map-clip)" className="gt-map-land" strokeWidth={s(0.35)}>
          <use href="#globetrotter-land" x={-MAP_WIDTH} fillRule="evenodd" />
          <use href="#globetrotter-land" fillRule="evenodd" />
          <use href="#globetrotter-land" x={MAP_WIDTH} fillRule="evenodd" />
        </g>

        {/* equator + tropics for flavor */}
        <line x1={0} y1={90} x2={MAP_WIDTH} y2={90} className="gt-map-line" strokeWidth={s(0.5)} />
        <line
          x1={0}
          y1={90 - TROPIC_LAT}
          x2={MAP_WIDTH}
          y2={90 - TROPIC_LAT}
          className="gt-map-line-dash"
          strokeWidth={s(0.5)}
          strokeDasharray={`${s(1.6)} ${s(1.6)}`}
        />
        <line
          x1={0}
          y1={90 + TROPIC_LAT}
          x2={MAP_WIDTH}
          y2={90 + TROPIC_LAT}
          className="gt-map-line-dash"
          strokeWidth={s(0.5)}
          strokeDasharray={`${s(1.6)} ${s(1.6)}`}
        />

        {/* reveal: dashed connectors from each guess to the actual point */}
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
                className={cn('gt-map-connector', pin.isYou && 'is-you')}
                strokeWidth={s(pin.isYou ? 0.7 : 0.5)}
                strokeDasharray={`${s(1.4)} ${s(1.4)}`}
              />
            )
          })}

        {/* opponents already locked in (guess mode) — ghost dots */}
        {ghosts.map((ghost, index) => {
          const { x, y } = project(ghost.lat, ghost.lng)
          return (
            <circle key={`ghost-${index}`} cx={x} cy={y} r={s(1.8)} className="gt-map-ghostpin" />
          )
        })}

        {/* pins */}
        {pins.map((pin, index) => {
          const { x, y } = project(pin.lat, pin.lng)
          return (
            <g
              key={`pin-${index}`}
              className={cn('gt-map-pin', pin.isYou && 'is-you', pin.pending && 'is-pending')}
              style={
                pin.hueIndex !== undefined
                  ? ({ ['--pin-hue']: avatarHue(pin.hueIndex) } as React.CSSProperties)
                  : undefined
              }
            >
              <circle cx={x} cy={y} r={s(2.6)} className="gt-pin-dot" strokeWidth={s(0.55)} />
              <circle cx={x} cy={y} r={s(2.6)} className="gt-pin-ring" strokeWidth={s(0.35)} />
            </g>
          )
        })}

        {/* the actual answer, revealed — gold flag */}
        {targetXY && (
          <g
            data-testid="globetrotter-map-target"
            className="gt-map-actual"
            transform={`translate(${targetXY.x}, ${targetXY.y})`}
          >
            <path
              d={`M 0 ${s(-5.2)} L ${s(2.3)} ${s(-0.8)} L 0 ${s(1.6)} L ${s(-2.3)} ${s(-0.8)} Z`}
              className="gt-pin-flag"
              strokeWidth={s(0.55)}
            />
            <circle r={s(1.4)} className="gt-pin-flag-dot" />
          </g>
        )}
      </svg>

      <div className="gt-zoom">
        <button
          type="button"
          aria-label="Zoom in"
          data-testid="globetrotter-zoom-in"
          onClick={() => zoomCentered(1.6)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          data-testid="globetrotter-zoom-out"
          onClick={() => zoomCentered(1 / 1.6)}
        >
          −
        </button>
        {zoom > 1.01 && (
          <button
            type="button"
            aria-label="Reset zoom"
            data-testid="globetrotter-zoom-reset"
            onClick={() => setView(FULL_VIEW)}
          >
            ⤢
          </button>
        )}
      </div>
    </div>
  )
}
