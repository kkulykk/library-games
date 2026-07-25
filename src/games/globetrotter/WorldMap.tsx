'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/utils'
import type { Guess } from './logic'
import { avatarHue } from './avatars'
import { LAND_RINGS } from './worldMap'
import { countryShapes } from './countryShapes'
import {
  clampView,
  easeInOut,
  fitPoints,
  lerpView,
  project,
  tileBox,
  tileKey,
  tileZoom,
  unproject,
  visibleTiles,
  worldView,
  WORLD_SIZE,
  type Point,
  type Tile,
  type ViewBox,
} from './mercator'

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
  /** Revealed answer: gold flag marker + animated connectors to every pin. */
  target?: MapTarget | null
  onSelect?: (guess: Guess) => void
  interactive?: boolean
  /** Reveal mode: fly the camera to frame the guesses and the answer. */
  autoFit?: boolean
  /** Rendered beside your connector once the fly-to lands (e.g. "412 km"). */
  distanceLabel?: string | null
  testId?: string
  ariaLabel?: string
}

// Free, open basemap: OpenStreetMap standard raster tiles (ODbL). Rendered on
// top of the built-in vector world so the map still works — coastlines,
// borders and country names — when the tiles are blocked or offline.
const TILE_URL = (tile: Tile) => `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`
const MAX_TILE_ZOOM = 12
// E2E runs offline against a fake backend; skip the network so specs stay
// deterministic and fall back to the vector basemap.
const TILES_ENABLED = process.env.NEXT_PUBLIC_E2E_FAKE_SUPABASE !== '1'
// Give up on the raster layer after this many consecutive failures.
const TILE_ERROR_LIMIT = 6

// Screen-pixel movement below this is a click (drop a pin), above it a pan.
const CLICK_SLOP_PX = 5
const FLY_MS = 900
/** Name a country only once it is this wide on screen, and never crowd the map. */
const MIN_LABEL_PX = 58
const MAX_LABELS = 26

const LAND_PATH = LAND_RINGS.map((ring) => {
  let previousLng = ring[0][0]
  const d = ring.map(([rawLng, lat], index) => {
    let lng = rawLng
    while (lng - previousLng > 180) lng -= 360
    while (lng - previousLng < -180) lng += 360
    previousLng = lng
    const x = ((lng + 180) / 360) * WORLD_SIZE
    const y = project(lat, 0).y
    return `${index === 0 ? 'M' : 'L'}${Math.round(x * 1000) / 1000} ${Math.round(y * 1000) / 1000}`
  })
  return d.join('') + 'Z'
}).join('')

/** Tracks which tiles have finished downloading, so only ready ones are drawn. */
function useTileLayer(tiles: Tile[], enabled: boolean) {
  const [, force] = useState(0)
  const ready = useRef(new Set<string>())
  const pending = useRef(new Set<string>())
  const failures = useRef(0)
  const [broken, setBroken] = useState(false)

  const keys = tiles.map(tileKey).join(',')

  useEffect(() => {
    if (!enabled || broken) return
    let cancelled = false
    for (const tile of tiles) {
      const key = tileKey(tile)
      if (ready.current.has(key) || pending.current.has(key)) continue
      pending.current.add(key)
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => {
        if (cancelled) return
        pending.current.delete(key)
        failures.current = 0
        ready.current.add(key)
        force((n) => n + 1)
      }
      image.onerror = () => {
        if (cancelled) return
        pending.current.delete(key)
        failures.current += 1
        if (failures.current >= TILE_ERROR_LIMIT) setBroken(true)
      }
      image.src = TILE_URL(tile)
    }
    return () => {
      cancelled = true
    }
    // `keys` captures the tile set; `tiles` itself is a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, enabled, broken])

  const readyTiles =
    enabled && !broken ? tiles.filter((tile) => ready.current.has(tileKey(tile))) : []
  return { readyTiles, active: readyTiles.length > 0 }
}

export function WorldMap({
  pins = [],
  ghosts = [],
  target = null,
  onSelect,
  interactive = false,
  autoFit = false,
  distanceLabel = null,
  testId = 'globetrotter-map',
  ariaLabel = 'World map',
}: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [size, setSize] = useState({ width: 640, height: 360 })
  const aspect = size.height > 0 ? size.width / size.height : 2
  const [view, setView] = useState<ViewBox>(() => worldView(2))
  const [flying, setFlying] = useState(false)
  const flightRef = useRef<number | null>(null)
  // Mirrors `view` so a fly-to can read the live camera without re-subscribing.
  const viewRef = useRef(view)
  viewRef.current = view
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origin: ViewBox
    moved: boolean
  } | null>(null)

  // Measure the element: the projection is square, so the viewBox height has to
  // follow the real aspect ratio or the world comes out stretched.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const measure = () => {
      const rect = svg.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setSize((current) =>
          current.width === rect.width && current.height === rect.height
            ? current
            : { width: rect.width, height: rect.height }
        )
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setView((current) => clampView(current, aspect))
  }, [aspect])

  const stopFlight = useCallback(() => {
    if (flightRef.current !== null) cancelAnimationFrame(flightRef.current)
    flightRef.current = null
    setFlying(false)
  }, [])

  const flyTo = useCallback(
    (destination: ViewBox) => {
      stopFlight()
      setFlying(true)
      const from = viewRef.current
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / FLY_MS)
        setView(lerpView(from, destination, easeInOut(t)))
        if (t < 1) {
          flightRef.current = requestAnimationFrame(step)
        } else {
          flightRef.current = null
          setFlying(false)
        }
      }
      flightRef.current = requestAnimationFrame(step)
    },
    [stopFlight]
  )

  useEffect(() => stopFlight, [stopFlight])

  // Reveal: frame every guess together with the answer, then hold that view.
  const fitKey = autoFit ? JSON.stringify([target, pins.map((p) => [p.lat, p.lng])]) : 'none'
  useEffect(() => {
    if (!autoFit || !target) return
    const points = [target, ...pins.map((pin) => ({ lat: pin.lat, lng: pin.lng }))]
    setView(worldView(aspect))
    const timer = setTimeout(() => flyTo(fitPoints(points, aspect)), 420)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, aspect, autoFit, flyTo])

  const zoom = WORLD_SIZE / view.w
  /** CSS pixels → view-box units, so markers keep a constant on-screen size. */
  const px = useCallback(
    (value: number) => (value * view.w) / Math.max(1, size.width),
    [view.w, size.width]
  )

  const z = tileZoom(view, size.width, MAX_TILE_ZOOM)
  const tiles = useMemo(() => (TILES_ENABLED ? visibleTiles(view, z) : []), [view, z])
  const { readyTiles, active: tilesActive } = useTileLayer(tiles, TILES_ENABLED)

  // Country outlines never move (the projection is fixed), so build the paths
  // once — a pan would otherwise diff ~180 elements every frame.
  const borderPaths = useMemo(() => {
    const shapes = countryShapes()
    return (
      <>
        {shapes.map((country) => (
          <path key={country.name} d={country.d} />
        ))}
        {shapes
          .filter((country) => country.wraps)
          .map((country) => (
            <path
              key={`${country.name}-wrap`}
              d={country.d}
              transform={`translate(${WORLD_SIZE})`}
            />
          ))}
      </>
    )
  }, [])

  const labels = useMemo(() => {
    if (tilesActive) return []
    // Only name countries that are actually big enough on screen to read —
    // the same map is a 280 px minimap and a full-size panel.
    const pxPerUnit = Math.max(1, size.width) / view.w
    return countryShapes()
      .filter(
        (country) =>
          country.extent * pxPerUnit >= MIN_LABEL_PX &&
          country.label.x > view.x &&
          country.label.x < view.x + view.w &&
          country.label.y > view.y &&
          country.label.y < view.y + view.h
      )
      .sort((a, b) => b.extent - a.extent)
      .slice(0, MAX_LABELS)
  }, [tilesActive, view, size.width])

  function toWorldPoint(clientX: number, clientY: number): Point | null {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    return {
      x: view.x + ((clientX - rect.left) / rect.width) * view.w,
      y: view.y + ((clientY - rect.top) / rect.height) * view.h,
    }
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const anchor = toWorldPoint(clientX, clientY)
    if (!anchor) return
    stopFlight()
    setView((current) => {
      const next = clampView({ ...current, w: current.w / factor }, aspect)
      const ratio = next.w / current.w
      return clampView(
        {
          ...next,
          x: anchor.x - (anchor.x - current.x) * ratio,
          y: anchor.y - (anchor.y - current.y) * ratio,
        },
        aspect
      )
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
      zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.4 : 1 / 1.4)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  })

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    stopFlight()
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
      clampView(
        {
          ...drag.origin,
          x: drag.origin.x - dxPx * unitsPerPx,
          y: drag.origin.y - dyPx * unitsPerPx,
        },
        aspect
      )
    )
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (drag.moved || !interactive || !onSelect) return
    const point = toWorldPoint(event.clientX, event.clientY)
    if (!point) return
    onSelect(unproject(point.x, point.y))
  }

  const targetXY = target ? project(target.lat, target.lng) : null
  const yourPin = pins.find((pin) => pin.isYou) ?? pins[0]
  const yourXY = yourPin ? project(yourPin.lat, yourPin.lng) : null

  return (
    <div className="gt-mapwrap">
      <svg
        ref={svgRef}
        data-testid={testId}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={cn('gt-map-svg', interactive && 'is-pickable', flying && 'is-flying')}
      >
        <defs>
          <path id="globetrotter-land" d={LAND_PATH} />
        </defs>

        <rect
          x={-WORLD_SIZE}
          y={-WORLD_SIZE}
          width={WORLD_SIZE * 3}
          height={WORLD_SIZE * 3}
          className="gt-map-ocean"
        />

        {/* Vector basemap — always drawn, so a blocked tile server still leaves
            a readable world underneath. */}
        <g className="gt-map-land">
          <use href="#globetrotter-land" x={-WORLD_SIZE} fillRule="evenodd" />
          <use href="#globetrotter-land" fillRule="evenodd" />
          <use href="#globetrotter-land" x={WORLD_SIZE} fillRule="evenodd" />
        </g>
        <g className="gt-map-borders" strokeWidth={px(0.6)}>
          {borderPaths}
        </g>

        {/* OpenStreetMap raster tiles fade in over the vector base. */}
        {readyTiles.map((tile) => {
          const box = tileBox(tile)
          return (
            <image
              key={tileKey(tile)}
              className="gt-map-tile"
              href={TILE_URL(tile)}
              x={box.x}
              y={box.y}
              width={box.w}
              height={box.h}
              preserveAspectRatio="none"
            />
          )
        })}

        {labels.map((country) => (
          <text
            key={`label-${country.name}`}
            x={country.label.x}
            y={country.label.y}
            className="gt-map-country-label"
            fontSize={px(11)}
            strokeWidth={px(2.4)}
          >
            {country.name}
          </text>
        ))}

        {/* reveal: connectors drawn from each guess to the actual point */}
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
                pathLength={100}
                strokeDasharray={100}
                className={cn('gt-map-connector', pin.isYou && 'is-you')}
                strokeWidth={px(pin.isYou ? 2.4 : 1.6)}
              />
            )
          })}

        {/* opponents already locked in (guess mode) — ghost dots */}
        {ghosts.map((ghost, index) => {
          const { x, y } = project(ghost.lat, ghost.lng)
          return (
            <circle key={`ghost-${index}`} cx={x} cy={y} r={px(5)} className="gt-map-ghostpin" />
          )
        })}

        {/* pins */}
        {pins.map((pin, index) => {
          const { x, y } = project(pin.lat, pin.lng)
          return (
            <g
              key={`pin-${index}`}
              transform={`translate(${x} ${y})`}
              className={cn('gt-map-pin', pin.isYou && 'is-you', pin.pending && 'is-pending')}
              style={
                pin.hueIndex !== undefined
                  ? ({ ['--pin-hue']: avatarHue(pin.hueIndex) } as React.CSSProperties)
                  : undefined
              }
            >
              {pin.pending && <circle r={px(9)} className="gt-pin-ripple" strokeWidth={px(1.6)} />}
              <g className="gt-pin-anim">
                <circle r={px(7)} className="gt-pin-dot" strokeWidth={px(1.6)} />
                <circle r={px(2.4)} className="gt-pin-core" />
              </g>
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
            <g className="gt-pin-anim">
              <circle r={px(14)} className="gt-pin-flag-halo" />
              <path
                d={`M 0 ${px(-16)} L ${px(7)} ${px(-2.5)} L 0 ${px(5)} L ${px(-7)} ${px(-2.5)} Z`}
                className="gt-pin-flag"
                strokeWidth={px(1.6)}
              />
              <circle r={px(4)} className="gt-pin-flag-dot" />
            </g>
          </g>
        )}

        {/* distance readout riding the midpoint of your connector */}
        {targetXY && yourXY && distanceLabel && (
          <g
            className="gt-map-distance"
            transform={`translate(${(targetXY.x + yourXY.x) / 2} ${(targetXY.y + yourXY.y) / 2})`}
          >
            <text
              className="gt-map-distance-text"
              fontSize={px(13)}
              strokeWidth={px(4)}
              y={px(-8)}
              textAnchor="middle"
            >
              {distanceLabel}
            </text>
          </g>
        )}
      </svg>

      <div className="gt-zoom">
        <button
          type="button"
          aria-label="Zoom in"
          data-testid="globetrotter-zoom-in"
          onClick={() => zoomCentered(1.8)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          data-testid="globetrotter-zoom-out"
          onClick={() => zoomCentered(1 / 1.8)}
        >
          −
        </button>
        {zoom > 1.01 && (
          <button
            type="button"
            aria-label="Reset zoom"
            data-testid="globetrotter-zoom-reset"
            onClick={() => {
              stopFlight()
              setView(worldView(aspect))
            }}
          >
            ⤢
          </button>
        )}
      </div>

      {readyTiles.length > 0 && (
        <a
          className="gt-map-attribution mono"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap
        </a>
      )}
    </div>
  )
}
