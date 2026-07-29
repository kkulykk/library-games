// Web Mercator map math for the Globetrotter world map. Pure functions, no
// React — the map component only owns the viewBox, everything geometric lives
// here so it can be unit tested.
//
// The world is a WORLD_SIZE × WORLD_SIZE square (the same convention slippy
// map tiles use at zoom 0, where one 256 px tile covers the planet). Because
// the projection is fixed, country geometry can be projected once at module
// load and panning/zooming is then just a viewBox change.

export const WORLD_SIZE = 256

/** Web Mercator cannot represent the poles; tiles stop at this latitude. */
export const MAX_MERCATOR_LAT = 85.0511287798066

/** Deepest zoom we allow: the world blown up to 2^12 × 256 px (street level). */
export const MAX_SCALE = 4096

export interface Point {
  x: number
  y: number
}

export interface LatLng {
  lat: number
  lng: number
}

export interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

export interface Tile {
  z: number
  x: number
  y: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** lat/lng → world square coordinates (x right from −180°, y down from north). */
export function project(lat: number, lng: number): Point {
  const clampedLat = clamp(lat, -MAX_MERCATOR_LAT, MAX_MERCATOR_LAT)
  const sin = Math.sin((clampedLat * Math.PI) / 180)
  return {
    x: ((clamp(lng, -180, 180) + 180) / 360) * WORLD_SIZE,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * WORLD_SIZE,
  }
}

/** Inverse of `project`, clamped to the representable world. */
export function unproject(x: number, y: number): LatLng {
  const nx = clamp(x, 0, WORLD_SIZE) / WORLD_SIZE
  const ny = clamp(y, 0, WORLD_SIZE) / WORLD_SIZE
  return {
    lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * ny))) * 180) / Math.PI,
    lng: nx * 360 - 180,
  }
}

/**
 * Keep a viewBox legal for a viewport of the given aspect ratio: the height
 * follows the width, zoom is bounded, and the view stays over the world —
 * once it is wider (or taller) than the world it centers instead of drifting.
 */
export function clampView(view: ViewBox, aspect: number): ViewBox {
  const safeAspect = aspect > 0 && Number.isFinite(aspect) ? aspect : 2
  const maxW = Math.max(WORLD_SIZE, WORLD_SIZE * safeAspect)
  const w = clamp(view.w, WORLD_SIZE / MAX_SCALE, maxW)
  const h = w / safeAspect
  return {
    w,
    h,
    x: w >= WORLD_SIZE ? (WORLD_SIZE - w) / 2 : clamp(view.x, 0, WORLD_SIZE - w),
    y: h >= WORLD_SIZE ? (WORLD_SIZE - h) / 2 : clamp(view.y, 0, WORLD_SIZE - h),
  }
}

/** Default view: the whole world edge to edge, vertically centered. */
export function worldView(aspect: number): ViewBox {
  const height = WORLD_SIZE / (aspect > 0 && Number.isFinite(aspect) ? aspect : 2)
  return clampView({ x: 0, y: (WORLD_SIZE - height) / 2, w: WORLD_SIZE, h: height }, aspect)
}

/** Zoom about a fixed point (in world coordinates) — used by wheel and buttons. */
export function zoomView(view: ViewBox, anchor: Point, factor: number, aspect: number): ViewBox {
  const next = clampView({ ...view, w: view.w / factor }, aspect)
  const ratio = next.w / view.w
  return clampView(
    {
      ...next,
      x: anchor.x - (anchor.x - view.x) * ratio,
      y: anchor.y - (anchor.y - view.y) * ratio,
    },
    aspect
  )
}

/**
 * Scroll distance that doubles (or halves) the zoom.
 *
 * A wheel notch is ~100 px of delta and a trackpad swipe arrives as a stream of
 * small ones, so a per-*event* zoom factor makes the two behave nothing alike:
 * one notch used to jump 1.4× while a single flick of a trackpad fired a dozen
 * events and shot straight to street level. Zooming by delta instead means one
 * notch is a gentle 1.26× step and a trackpad moves at the speed of the finger.
 */
export const WHEEL_ZOOM_DISTANCE_PX = 300
/**
 * Biggest delta a single event may contribute. Firefox reports scrolls in lines
 * and some mice send one enormous delta per notch; without a cap either lands
 * several zoom levels away from where the hand thought it was going.
 */
const MAX_WHEEL_DELTA_PX = 180
/** Rough px equivalents for the non-pixel `deltaMode`s of a wheel event. */
const LINE_HEIGHT_PX = 16
const PAGE_HEIGHT_PX = 400

/**
 * Zoom factor for one wheel event: > 1 zooms in, < 1 zooms out. Normalising
 * `deltaY` (and its unit) rather than counting events is what keeps a mouse, a
 * trackpad and a "smooth scrolling" browser at the same speed.
 */
export function wheelZoomFactor(deltaY: number, deltaMode = 0): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return 1
  const scale = deltaMode === 1 ? LINE_HEIGHT_PX : deltaMode === 2 ? PAGE_HEIGHT_PX : 1
  const px = clamp(deltaY * scale, -MAX_WHEEL_DELTA_PX, MAX_WHEEL_DELTA_PX)
  return 2 ** (-px / WHEEL_ZOOM_DISTANCE_PX)
}

/** A two-finger gesture, in fractions of the map element (0 = left/top, 1 = right/bottom). */
export interface PinchGesture {
  /** Where the midpoint between the fingers sat when the gesture began. */
  from: Point
  /** Where that midpoint sits now. */
  to: Point
  /** Current finger separation ÷ the separation the gesture began at. */
  scale: number
}

/**
 * Zoom and pan in one step, the way a pinch actually behaves: the piece of the
 * world the fingers grabbed stays pinned under them, so spreading zooms in and
 * sliding both fingers drags the map at the same time.
 */
export function pinchView(origin: ViewBox, gesture: PinchGesture, aspect: number): ViewBox {
  const scale = gesture.scale > 0 && Number.isFinite(gesture.scale) ? gesture.scale : 1
  const zoomed = clampView({ ...origin, w: origin.w / scale }, aspect)
  const anchorX = origin.x + gesture.from.x * origin.w
  const anchorY = origin.y + gesture.from.y * origin.h
  return clampView(
    {
      ...zoomed,
      x: anchorX - gesture.to.x * zoomed.w,
      y: anchorY - gesture.to.y * zoomed.h,
    },
    aspect
  )
}

/** Roughly 25 km across at the equator — close enough to read streets. */
export const CLOSE_VIEW_WIDTH = (WORLD_SIZE * 25) / 40075

/**
 * Smallest view that shows every point with `pad` of breathing room on each
 * side (0.25 = 25% of the span). Used to fly the map to the guess + answer.
 * A near-bullseye never zooms tighter than a close-up, so the pull-back always
 * has somewhere to pull back to.
 */
export function fitPoints(points: LatLng[], aspect: number, pad = 0.35): ViewBox {
  if (points.length === 0) return worldView(aspect)
  const projected = points.map((p) => project(p.lat, p.lng))
  const minX = Math.min(...projected.map((p) => p.x))
  const maxX = Math.max(...projected.map((p) => p.x))
  const minY = Math.min(...projected.map((p) => p.y))
  const maxY = Math.max(...projected.map((p) => p.y))
  const spanX = Math.max(maxX - minX, CLOSE_VIEW_WIDTH)
  const spanY = Math.max(maxY - minY, CLOSE_VIEW_WIDTH)
  const w = Math.max(spanX * (1 + pad * 2), spanY * (1 + pad * 2) * aspect)
  return clampView(
    { w, h: w / aspect, x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - w / aspect / 2 },
    aspect
  )
}

// ─── Reveal camera tour ──────────────────────────────────────────────────────

/** Below this ratio the two pins are near neighbours; skip the travel arc. */
const ARC_RATIO = 6

export const GUESS_HOLD_MS = 900
export const TRAVEL_MS = 1700
export const ANSWER_HOLD_MS = 2000
export const ZOOM_OUT_MS = 1200

export interface TourStep {
  /** Where the camera ends up. */
  view: ViewBox
  /** Time to travel there from the previous step (0 jumps straight there). */
  travelMs: number
  /** Time to sit still once it arrives. */
  holdMs: number
}

/** A close-up centered on one point. */
export function closeView(point: LatLng, aspect: number): ViewBox {
  const center = project(point.lat, point.lng)
  const w = CLOSE_VIEW_WIDTH
  return clampView({ x: center.x - w / 2, y: center.y - w / aspect / 2, w, h: w / aspect }, aspect)
}

/**
 * The reveal camera script: open tight on the player's pin, travel to the real
 * spot (arcing out over the distance when the two are far apart), hold there,
 * then pull back to frame the whole miss.
 */
export function revealTour(
  target: LatLng,
  guess: LatLng | null,
  others: LatLng[],
  aspect: number
): TourStep[] {
  const overview = fitPoints([target, ...(guess ? [guess] : []), ...others], aspect)

  if (!guess) {
    return [
      { view: closeView(target, aspect), travelMs: 0, holdMs: ANSWER_HOLD_MS },
      { view: overview, travelMs: ZOOM_OUT_MS, holdMs: 0 },
    ]
  }

  const start = closeView(guess, aspect)
  const answer = closeView(target, aspect)
  const steps: TourStep[] = [{ view: start, travelMs: 0, holdMs: GUESS_HOLD_MS }]

  if (overview.w > start.w * ARC_RATIO) {
    // Too far to pan at street level — lift over the gap and drop back in.
    steps.push({
      view: fitPoints([guess, target], aspect, 0.05),
      travelMs: TRAVEL_MS / 2,
      holdMs: 0,
    })
    steps.push({ view: answer, travelMs: TRAVEL_MS / 2, holdMs: ANSWER_HOLD_MS })
  } else {
    steps.push({ view: answer, travelMs: TRAVEL_MS, holdMs: ANSWER_HOLD_MS })
  }

  steps.push({ view: overview, travelMs: ZOOM_OUT_MS, holdMs: 0 })
  return steps
}

/** Linear interpolation between two views — one frame of a fly-to animation. */
export function lerpView(from: ViewBox, to: ViewBox, t: number): ViewBox {
  const k = clamp(t, 0, 1)
  const mix = (a: number, b: number) => a + (b - a) * k
  return { x: mix(from.x, to.x), y: mix(from.y, to.y), w: mix(from.w, to.w), h: mix(from.h, to.h) }
}

/** Ease-in-out cubic — used for view transitions and count-up animations. */
export function easeInOut(t: number): number {
  const k = clamp(t, 0, 1)
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
}

/**
 * Tile pyramid level whose 256 px tiles land closest to 256 CSS px on screen,
 * bounded so a single frame never asks for an unreasonable number of tiles.
 */
export function tileZoom(view: ViewBox, viewportWidthPx: number, maxZoom = 12): number {
  if (!(viewportWidthPx > 0) || !(view.w > 0)) return 0
  const scale = viewportWidthPx / view.w
  return clamp(Math.round(Math.log2(scale)), 0, maxZoom)
}

/** Every tile of `z` intersecting the view, in draw order. */
export function visibleTiles(view: ViewBox, z: number): Tile[] {
  const count = 2 ** z
  const size = WORLD_SIZE / count
  const minX = Math.max(0, Math.floor(view.x / size))
  const maxX = Math.min(count - 1, Math.ceil((view.x + view.w) / size) - 1)
  const minY = Math.max(0, Math.floor(view.y / size))
  const maxY = Math.min(count - 1, Math.ceil((view.y + view.h) / size) - 1)
  const tiles: Tile[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) tiles.push({ z, x, y })
  }
  return tiles
}

/** World-coordinate box a tile occupies. */
export function tileBox(tile: Tile): ViewBox {
  const size = WORLD_SIZE / 2 ** tile.z
  return { x: tile.x * size, y: tile.y * size, w: size, h: size }
}

export function tileKey(tile: Tile): string {
  return `${tile.z}/${tile.x}/${tile.y}`
}
