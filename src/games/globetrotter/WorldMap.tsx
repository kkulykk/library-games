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
  lerpView,
  pinchView,
  project,
  tileBox,
  tileKey,
  revealTour,
  tileZoom,
  unproject,
  visibleTiles,
  wheelZoomFactor,
  worldView,
  zoomView,
  WORLD_SIZE,
  type Point,
  type Tile,
  type TourStep,
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
// A fingertip wobbles far more than a mouse, and it covers the point it is
// aiming at — hold a tap open wider on touch or every pin drop reads as a pan.
const TOUCH_CLICK_SLOP_PX = 12
/** Wait for the camera to rest this long before asking for tiles. */
const TILE_SETTLE_MS = 220
/** One press of +/− doubles or halves the scale, eased instead of snapped. */
const ZOOM_STEP = 2
const ZOOM_STEP_MS = 260
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

/** The CSS animations honour this via a media query; the camera tour cannot. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Holds a value still until it has stopped changing. Tiles are keyed off the
 * settled view so a drag or a reveal fly-through does not fire a request for
 * every zoom level it passes through.
 */
function useSettled<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return settled
}

/** Tracks which tiles have finished downloading, so only ready ones are drawn. */
function useTileLayer(tiles: Tile[], enabled: boolean) {
  const [, force] = useState(0)
  const ready = useRef(new Set<string>())
  const pending = useRef(new Set<string>())
  const failures = useRef(0)
  const mounted = useRef(true)
  // Last set of tiles that actually had pixels. A new zoom level starts with
  // none of its tiles downloaded, so without this the raster layer blinks off
  // to the vector basemap on every pan and comes back a moment later — the
  // flicker. Holding the previous level (tiles are placed in world
  // coordinates, so they stay geographically correct, just coarser) means the
  // new level fades in over a map instead of into a gap.
  const shown = useRef<Tile[]>([])
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const keys = tiles.map(tileKey).join(',')

  useEffect(() => {
    if (!enabled || broken) return
    for (const tile of tiles) {
      const key = tileKey(tile)
      if (ready.current.has(key) || pending.current.has(key)) continue
      pending.current.add(key)
      const image = new Image()
      image.decoding = 'async'
      // A tile that finishes after the camera moved on is still downloaded and
      // cached, so it is recorded either way — bailing out here would strand
      // the key in `pending` and the guard above would never re-request it.
      image.onload = () => {
        pending.current.delete(key)
        failures.current = 0
        ready.current.add(key)
        if (mounted.current) force((n) => n + 1)
      }
      image.onerror = () => {
        pending.current.delete(key)
        failures.current += 1
        if (mounted.current && failures.current >= TILE_ERROR_LIMIT) setBroken(true)
      }
      image.src = TILE_URL(tile)
    }
    // `keys` captures the tile set; `tiles` itself is a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, enabled, broken])

  if (!enabled || broken) shown.current = []
  else {
    const readyNow = tiles.filter((tile) => ready.current.has(tileKey(tile)))
    if (readyNow.length > 0) shown.current = readyNow
  }
  const readyTiles = shown.current
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
  // True from the moment the reveal tour starts until the camera has pulled
  // back to the overview — the distance overlays wait for that.
  const [touring, setTouring] = useState(autoFit)
  const flightRef = useRef<number | null>(null)
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelRef = useRef(false)
  // Mirrors `view` so a fly-to can read the live camera without re-subscribing.
  const viewRef = useRef(view)
  viewRef.current = view
  // Every pointer currently on the map, so two fingers can pinch and a lifted
  // finger can hand the gesture back to the one still down.
  const pointersRef = useRef(new Map<number, Point>())
  const gestureRef = useRef<{
    /** One pointer drags the map; two zoom and drag it together. */
    mode: 'pan' | 'pinch'
    /** Camera the gesture started from — every frame is measured against it. */
    origin: ViewBox
    startX: number
    startY: number
    startDistance: number
    moved: boolean
    /** A second finger joined at some point, so this can never end as a tap. */
    multi: boolean
    slop: number
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

  /**
   * Cancel the reveal tour. Any manual pan or zoom does this — the camera then
   * belongs to the player, and the overview overlays (connectors, distance)
   * are shown straight away rather than waiting for a tour that will not come.
   */
  const stopFlight = useCallback(() => {
    if (flightRef.current !== null) cancelAnimationFrame(flightRef.current)
    if (holdRef.current !== null) clearTimeout(holdRef.current)
    flightRef.current = null
    holdRef.current = null
    cancelRef.current = true
    setFlying(false)
    setTouring((current) => (current ? false : current))
  }, [])

  /**
   * Ease the camera to a view. Used by the zoom buttons: a snapped 2× jump
   * loses the eye, whereas a quarter-second tween keeps the world continuous.
   * Deliberately not part of the reveal tour — it leaves `touring` alone, so
   * zooming during a reveal does not re-hide the connectors.
   */
  const glideTo = useCallback(
    (to: ViewBox) => {
      stopFlight()
      if (prefersReducedMotion()) {
        setView(to)
        return
      }
      cancelRef.current = false
      const from = viewRef.current
      const startedAt = performance.now()
      const frame = (now: number) => {
        if (cancelRef.current) return
        const t = Math.min(1, (now - startedAt) / ZOOM_STEP_MS)
        setView(lerpView(from, to, easeInOut(t)))
        flightRef.current = t < 1 ? requestAnimationFrame(frame) : null
      }
      flightRef.current = requestAnimationFrame(frame)
    },
    [stopFlight]
  )

  /** Walk the camera through a script of destinations, holds and all. */
  const runTour = useCallback(
    (steps: TourStep[]) => {
      stopFlight()
      cancelRef.current = false
      setFlying(true)
      setTouring(true)
      let index = 0

      const nextStep = () => {
        if (cancelRef.current) return
        const step = steps[index]
        if (!step) {
          setFlying(false)
          setTouring(false)
          return
        }
        const isLast = index === steps.length - 1
        index += 1
        const from = viewRef.current
        const startedAt = performance.now()

        const frame = (now: number) => {
          if (cancelRef.current) return
          const t = step.travelMs > 0 ? Math.min(1, (now - startedAt) / step.travelMs) : 1
          setView(lerpView(from, step.view, easeInOut(t)))
          if (t < 1) {
            flightRef.current = requestAnimationFrame(frame)
            return
          }
          flightRef.current = null
          // The pull-back has landed: the whole miss is on screen now.
          if (isLast) setTouring(false)
          if (step.holdMs > 0) holdRef.current = setTimeout(nextStep, step.holdMs)
          else nextStep()
        }

        flightRef.current = requestAnimationFrame(frame)
      }

      nextStep()
    },
    [stopFlight]
  )

  useEffect(() => stopFlight, [stopFlight])

  // Reveal: open on the player's pin, travel to the real spot, hold, pull back.
  const fitKey = autoFit ? JSON.stringify([target, pins.map((p) => [p.lat, p.lng])]) : 'none'
  useEffect(() => {
    if (!autoFit || !target) return
    const yours = pins.find((pin) => pin.isYou) ?? pins[0] ?? null
    const guess = yours ? { lat: yours.lat, lng: yours.lng } : null
    const others = pins
      .filter((pin) => pin !== yours)
      .map((pin) => ({ lat: pin.lat, lng: pin.lng }))
    const steps = revealTour(target, guess, others, aspect)

    // Anyone who asked for less motion gets the answer, not the flight.
    if (prefersReducedMotion()) {
      setView(steps[steps.length - 1].view)
      setTouring(false)
      return
    }

    setView(steps[0].view)
    // One frame of settle so the opening close-up paints before the tour runs.
    const timer = setTimeout(() => runTour(steps), 120)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, aspect, autoFit, runTour])

  const zoom = WORLD_SIZE / view.w
  /** CSS pixels → view-box units, so markers keep a constant on-screen size. */
  const px = useCallback(
    (value: number) => (value * view.w) / Math.max(1, size.width),
    [view.w, size.width]
  )

  // Only fetch tiles for a camera that has come to rest — and never while one
  // is animating. A reveal tour crosses a dozen zoom levels and pauses at each
  // end long enough to look settled, so the naive version fired off a request
  // per level and painted each half-loaded batch over the flight: the flicker.
  // Freezing the tile set for the duration keeps the detail already on screen
  // (tiles sit in world coordinates, so they travel with the camera) and loads
  // the close-up detail once, after the camera lands.
  const settledView = useSettled(view, TILE_SETTLE_MS)
  const animating = flying || touring
  const tileViewRef = useRef(settledView)
  // `useSettled` hands back the live view object once it has stopped changing,
  // so identity is the test for "the camera is really parked here" — a value
  // left over from a pause mid-flight does not qualify.
  if (!animating && settledView === view) tileViewRef.current = settledView
  const tileView = tileViewRef.current
  const z = tileZoom(tileView, size.width, MAX_TILE_ZOOM)
  const tiles = useMemo(() => (TILES_ENABLED ? visibleTiles(tileView, z) : []), [tileView, z])
  // The reveal tour is the one camera move that spans the whole zoom range, so
  // there is no level of raster detail that suits it: world tiles stretched
  // over a street-level close-up are mush. It flies over the clean vector world
  // instead, and the photographic detail arrives when the camera stops.
  const { readyTiles, active: tilesActive } = useTileLayer(tiles, TILES_ENABLED && !touring)

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

  // Read off the frozen tile camera rather than the live one: re-picking labels
  // every frame of a fly-through both costs a pass over ~180 shapes and pops
  // names in and out of existence as the camera crosses each size threshold.
  const labels = useMemo(() => {
    if (tilesActive) return []
    // Only name countries that are actually big enough on screen to read —
    // the same map is a 280 px minimap and a full-size panel.
    const pxPerUnit = Math.max(1, size.width) / tileView.w
    return countryShapes()
      .filter(
        (country) =>
          country.extent * pxPerUnit >= MIN_LABEL_PX &&
          country.label.x > tileView.x &&
          country.label.x < tileView.x + tileView.w &&
          country.label.y > tileView.y &&
          country.label.y < tileView.y + tileView.h
      )
      .sort((a, b) => b.extent - a.extent)
      .slice(0, MAX_LABELS)
  }, [tilesActive, tileView, size.width])

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
    setView((current) => zoomView(current, anchor, factor, aspect))
  }

  function zoomCentered(factor: number) {
    const current = viewRef.current
    const anchor = { x: current.x + current.w / 2, y: current.y + current.h / 2 }
    glideTo(zoomView(current, anchor, factor, aspect))
  }

  // Wheel zoom needs a non-passive listener (preventDefault stops page scroll),
  // so it is attached manually instead of via React's onWheel.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomAt(event.clientX, event.clientY, wheelZoomFactor(event.deltaY, event.deltaMode))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  })

  /** Midpoint and spread of whatever is currently touching the map. */
  function pointerStats() {
    const points = [...pointersRef.current.values()]
    if (points.length === 0) return { count: 0, midX: 0, midY: 0, distance: 0 }
    const midX = points.reduce((sum, point) => sum + point.x, 0) / points.length
    const midY = points.reduce((sum, point) => sum + point.y, 0) / points.length
    const distance =
      points.length >= 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0
    return { count: points.length, midX, midY, distance }
  }

  /**
   * (Re)anchor the gesture on the pointers that are down right now. Called
   * whenever a finger joins or leaves, so the map picks up from where it is
   * instead of snapping back to where the gesture originally started.
   */
  function restartGesture(seed: { moved: boolean; multi: boolean; slop: number }) {
    const stats = pointerStats()
    if (stats.count === 0) {
      gestureRef.current = null
      return
    }
    gestureRef.current = {
      mode: stats.count >= 2 ? 'pinch' : 'pan',
      origin: viewRef.current,
      startX: stats.midX,
      startY: stats.midY,
      startDistance: stats.distance,
      ...seed,
    }
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    stopFlight()
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)
    const previous = gestureRef.current
    const multi = pointersRef.current.size > 1 || (previous?.multi ?? false)
    restartGesture({
      moved: multi || (previous?.moved ?? false),
      multi,
      slop: event.pointerType === 'mouse' ? CLICK_SLOP_PX : TOUCH_CLICK_SLOP_PX,
    })
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const gesture = gestureRef.current
    const rect = svgRef.current?.getBoundingClientRect()
    if (!gesture || !rect || rect.width === 0 || rect.height === 0) return
    const stats = pointerStats()

    if (gesture.mode === 'pinch' && stats.count >= 2 && gesture.startDistance > 0) {
      gesture.moved = true
      setView(
        pinchView(
          gesture.origin,
          {
            from: {
              x: (gesture.startX - rect.left) / rect.width,
              y: (gesture.startY - rect.top) / rect.height,
            },
            to: {
              x: (stats.midX - rect.left) / rect.width,
              y: (stats.midY - rect.top) / rect.height,
            },
            scale: stats.distance / gesture.startDistance,
          },
          aspect
        )
      )
      return
    }

    const dxPx = stats.midX - gesture.startX
    const dyPx = stats.midY - gesture.startY
    if (!gesture.moved && Math.hypot(dxPx, dyPx) < gesture.slop) return
    gesture.moved = true
    const unitsPerPx = gesture.origin.w / rect.width
    setView(
      clampView(
        {
          ...gesture.origin,
          x: gesture.origin.x - dxPx * unitsPerPx,
          y: gesture.origin.y - dyPx * unitsPerPx,
        },
        aspect
      )
    )
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointersRef.current.delete(event.pointerId)) return
    const gesture = gestureRef.current
    if (pointersRef.current.size > 0) {
      // One finger of a pinch lifted: carry on panning with what is left,
      // still disqualified from dropping a pin when it finally comes up.
      restartGesture({ moved: true, multi: true, slop: gesture?.slop ?? CLICK_SLOP_PX })
      return
    }
    gestureRef.current = null
    if (!gesture || gesture.moved || gesture.multi || !interactive || !onSelect) return
    const point = toWorldPoint(event.clientX, event.clientY)
    if (!point) return
    onSelect(unproject(point.x, point.y))
  }

  /** A cancelled pointer (browser took the gesture over) drops a pin nowhere. */
  function handlePointerCancel(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointersRef.current.delete(event.pointerId)) return
    if (pointersRef.current.size > 0) {
      restartGesture({ moved: true, multi: true, slop: gestureRef.current?.slop ?? CLICK_SLOP_PX })
      return
    }
    gestureRef.current = null
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
        onPointerCancel={handlePointerCancel}
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

        {/* reveal: connectors drawn from each guess to the actual point, once
            the camera has pulled back far enough to show the whole distance */}
        {targetXY &&
          !touring &&
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
        {targetXY && yourXY && distanceLabel && !touring && (
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
          onClick={() => zoomCentered(ZOOM_STEP)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          data-testid="globetrotter-zoom-out"
          onClick={() => zoomCentered(1 / ZOOM_STEP)}
        >
          −
        </button>
        {zoom > 1.01 && (
          <button
            type="button"
            aria-label="Reset zoom"
            data-testid="globetrotter-zoom-reset"
            onClick={() => glideTo(worldView(aspect))}
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
