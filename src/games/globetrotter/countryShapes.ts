// Country borders + label anchors for the world map, projected once into Web
// Mercator world coordinates. Pure data derived from the same Natural Earth
// 1:110m country polygons `countries.ts` uses for reverse geocoding.
//
// The projection is fixed, so this work happens once (lazily, on first render)
// and panning/zooming afterwards is only a viewBox change.
import countryPolygons from './countryPolygons.json'
import { project, WORLD_SIZE, type Point } from './mercator'
import type { Ring } from './worldMap'

export interface CountryShape {
  name: string
  /** SVG path of every ring, in world coordinates. */
  d: string
  /** Where to anchor the name label. */
  label: Point
  /** Square root of the largest ring's area — a rough on-map "size" in world units. */
  extent: number
  /** True when a ring crosses the antimeridian and needs a wrapped copy. */
  wraps: boolean
}

interface RawCountry {
  name: string
  rings: Ring[]
}

/**
 * Unwrap a ring's longitudes so one crossing the antimeridian (Russia, Fiji,
 * Antarctica) stays continuous instead of drawing a stripe across the map.
 * The caller redraws wrapped countries at ±WORLD_SIZE so the runaway part
 * reappears on the correct edge.
 */
function projectRing(ring: Ring): Point[] {
  const points: Point[] = []
  let previousLng = ring[0]?.[0] ?? 0
  for (const [rawLng, lat] of ring) {
    let lng = rawLng
    while (lng - previousLng > 180) lng -= 360
    while (lng - previousLng < -180) lng += 360
    previousLng = lng
    // project() clamps longitude, so unwrap in world units instead.
    const base = project(lat, 0)
    points.push({ x: ((lng + 180) / 360) * WORLD_SIZE, y: base.y })
  }
  return points
}

function ringPath(points: Point[]): string {
  return (
    points
      .map(
        (p, index) =>
          `${index === 0 ? 'M' : 'L'}${Math.round(p.x * 1000) / 1000} ${Math.round(p.y * 1000) / 1000}`
      )
      .join('') + 'Z'
  )
}

/** Signed area × 2 of a projected ring (shoelace). */
function signedArea(points: Point[]): number {
  let sum = 0
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j].x * points[i].y - points[i].x * points[j].y
  }
  return sum / 2
}

function centroid(points: Point[], area: number): Point {
  if (Math.abs(area) < 1e-9) {
    const sx = points.reduce((total, p) => total + p.x, 0)
    const sy = points.reduce((total, p) => total + p.y, 0)
    return { x: sx / points.length, y: sy / points.length }
  }
  let cx = 0
  let cy = 0
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const cross = points[j].x * points[i].y - points[i].x * points[j].y
    cx += (points[j].x + points[i].x) * cross
    cy += (points[j].y + points[i].y) * cross
  }
  return { x: cx / (6 * area), y: cy / (6 * area) }
}

function buildShapes(): CountryShape[] {
  const raw = countryPolygons.countries as RawCountry[]
  return raw.map((country) => {
    const projected = country.rings.filter((ring) => ring.length > 2).map(projectRing)
    let biggest: Point[] = projected[0] ?? []
    let biggestArea = 0
    let wraps = false
    for (const points of projected) {
      const area = Math.abs(signedArea(points))
      if (area > biggestArea) {
        biggestArea = area
        biggest = points
      }
      if (points.some((p) => p.x < 0 || p.x > WORLD_SIZE)) wraps = true
    }
    return {
      name: country.name,
      d: projected.map(ringPath).join(''),
      label: centroid(biggest, signedArea(biggest)),
      extent: Math.sqrt(biggestArea),
      wraps,
    }
  })
}

let cache: CountryShape[] | null = null

/** Memoized country shapes — built on first call, reused for every render. */
export function countryShapes(): CountryShape[] {
  if (!cache) cache = buildShapes()
  return cache
}
