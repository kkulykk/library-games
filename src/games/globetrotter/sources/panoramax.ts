// Panoramax as a Random World panorama source.
//
// Panoramax is the open, federated street-imagery archive run by IGN, OSM-France
// and a growing set of independent instances — the free-software answer to
// Street View, with ~114M pictures and no API key, no quota and no terms that
// forbid reusing the pixels. Every picture is geotagged (the upload is rejected
// otherwise), the catalog is a STAC-compatible REST API served with permissive
// CORS, and each item carries its own licence and contributor. That is exactly
// the shape Random World needs, and it complements Commons rather than
// duplicating it: Commons is landmarks and one-off photospheres, Panoramax is
// somebody's street on an ordinary Tuesday, which is the harder, better guess.
//
// Two things shape the code below:
//
//   * Search is bounding-box driven, and coverage is patchy — a young archive
//     of volunteer drives, not a planet-wide fleet. Random cells over land come
//     back empty far more often than not, so sweeps are aimed at the vendored
//     `PANORAMAX_COVERAGE` grid instead (see the generator script for how it is
//     probed).
//   * The federation serves pixels from whichever instance holds them, so an
//     asset URL can point at any host. The content-security-policy cannot name
//     a federation, so finds hosted outside `PANORAMAX_IMAGE_ORIGINS` are
//     dropped here — a blocked image is a dead round, and a dead round is worse
//     than a thinner deck.
import { PANORAMAX_IMAGE_ORIGINS } from '@/lib/csp'
import { isValidGuess, shuffle } from '../logic'
import { PANORAMAX_CELL_DEGREES, PANORAMAX_COVERAGE } from '../panoramaxCoverage'
import { farEnough } from './spread'
import type { PanoFind, PanoSource, PanoSourceDeps } from './types'

const API = 'https://api.panoramax.xyz/api/search'
/** Human-facing viewer for one picture — used for attribution. */
const VIEWER = 'https://api.panoramax.xyz/#focus=pic&pic='
export const PANORAMAX_LABEL = 'Panoramax'
/**
 * CQL2 filter for spherical pictures.
 *
 * Panoramax takes flat photos too — most of the archive is a dashcam or a bike
 * mount — and a flat frame in an equirectangular viewer is a smear. A 360°
 * field of view is how the API describes the photospheres, and it is one of the
 * only two properties the search endpoint can filter on.
 */
const SPHERICAL = 'field_of_view = 360'
/**
 * Pictures asked for per sweep.
 *
 * A bbox search returns the pictures nearest the box's centre first, so a
 * window this wide is a whole neighbourhood to shuffle through rather than the
 * same five frames of one sequence every game.
 */
const SWEEP_LIMIT = 50
/** Rounds one cell may contribute — a cell is a region, not a world. */
const MAX_PER_CELL = 2
/** Sweeps per deck, whatever they yield. Each sweep is one request. */
const MAX_SWEEPS = 6
const REQUEST_TIMEOUT_MS = 12000
const PAUSE_MS = 250
/**
 * Fraction of a coverage cell one sweep looks at.
 *
 * Searching the whole cell every time anchors on the same centre and hands back
 * the same neighbourhood, game after game. A smaller window slid to a random
 * offset moves the anchor around inside the cell; when it lands somewhere the
 * archive has not reached, the cell is swept whole on the next try.
 */
const WINDOW_FRACTION = 0.6
/** Equirectangular photospheres are 2:1; allow a little slack for odd crops. */
const ASPECT_TOLERANCE = 0.05

interface Bbox {
  west: number
  south: number
  east: number
  north: number
}

/** A random window inside a coverage cell, or the whole cell. */
function sweepBox(cell: readonly [number, number], random: () => number, whole: boolean): Bbox {
  const [west, south] = cell
  const size = whole ? PANORAMAX_CELL_DEGREES : PANORAMAX_CELL_DEGREES * WINDOW_FRACTION
  const slack = PANORAMAX_CELL_DEGREES - size
  const left = west + random() * slack
  const bottom = south + random() * slack
  return { west: left, south: bottom, east: left + size, north: bottom + size }
}

async function search(box: Bbox, deps: PanoSourceDeps): Promise<unknown> {
  // Off `deps` first: calling `deps.fetchFn(…)` passes `deps` as the receiver,
  // and the browser's own `fetch` refuses any receiver that is not a window.
  const { fetchFn } = deps
  const query = new URLSearchParams({
    bbox: [box.west, box.south, box.east, box.north].map((v) => v.toFixed(4)).join(','),
    limit: String(SWEEP_LIMIT),
    filter: SPHERICAL,
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  deps.signal?.addEventListener('abort', onAbort)
  try {
    const response = await fetchFn(`${API}?${query}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`Panoramax API ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
    deps.signal?.removeEventListener('abort', onAbort)
  }
}

interface PanoramaxAsset {
  href?: string
  type?: string
}

interface PanoramaxFeature {
  id?: string
  geometry?: { coordinates?: unknown }
  assets?: Record<string, PanoramaxAsset | undefined>
  providers?: Array<{ name?: string; roles?: string[] }>
  properties?: {
    license?: string
    'geovisio:producer'?: string
    'pers:interior_orientation'?: {
      field_of_view?: number
      sensor_array_dimensions?: unknown
    }
  }
}

interface SearchResponse {
  features?: PanoramaxFeature[]
}

/** Keep attribution to one short, markup-free line. */
function clean(value: string): string {
  return value.replace(/[<>]/g, '').trim().split('\n')[0].slice(0, 60)
}

function producerOf(feature: PanoramaxFeature): string {
  const provider = feature.providers?.find((p) => p.roles?.includes('producer') && p.name)
  const name = provider?.name ?? feature.properties?.['geovisio:producer'] ?? ''
  return clean(name) || 'Unknown'
}

/** True for a picture whose pixels a player is actually allowed to fetch. */
function servedFromKnownInstance(url: string): boolean {
  try {
    return PANORAMAX_IMAGE_ORIGINS.includes(new URL(url).origin)
  } catch {
    return false
  }
}

/**
 * The rendition a round plays: a fixed 2048×1024 derivative every instance
 * generates. The `hd` asset is the contributor's untouched original — often
 * 6000px and several megabytes, sometimes far more — which is more than a
 * phone can hold and far more than the viewer needs.
 */
function sphericalAsset(feature: PanoramaxFeature): string | null {
  const href = feature.assets?.sd?.href
  if (typeof href !== 'string' || !href.startsWith('https://')) return null
  return servedFromKnownInstance(href) ? href : null
}

/** Defence in depth: the search filter already asks for these, so re-check cheaply. */
function isSpherical(feature: PanoramaxFeature): boolean {
  const optics = feature.properties?.['pers:interior_orientation']
  if (optics?.field_of_view !== 360) return false
  const dims = optics.sensor_array_dimensions
  if (Array.isArray(dims) && dims.length === 2) {
    const [width, height] = dims
    if (typeof width === 'number' && typeof height === 'number' && height > 0) {
      if (Math.abs(width / height - 2) > ASPECT_TOLERANCE) return false
    }
  }
  return true
}

function readFinds(body: unknown): PanoFind[] {
  const finds: PanoFind[] = []
  for (const feature of (body as SearchResponse)?.features ?? []) {
    const coords = feature.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) continue
    const [lng, lat] = coords
    if (typeof lat !== 'number' || typeof lng !== 'number' || !isValidGuess(lat, lng)) continue
    if (!feature.id || !isSpherical(feature)) continue
    const url = sphericalAsset(feature)
    if (!url) continue
    finds.push({
      lat,
      lng,
      pano: {
        url,
        page: VIEWER + encodeURIComponent(feature.id),
        author: producerOf(feature),
        license: clean(feature.properties?.license ?? '') || 'See picture page',
        source: PANORAMAX_LABEL,
      },
    })
  }
  return finds
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function collect(count: number, deps: PanoSourceDeps): Promise<PanoFind[]> {
  const { random } = deps
  const queue = shuffle([...PANORAMAX_COVERAGE], random).map((cell) => ({ cell, whole: false }))
  const finds: PanoFind[] = []
  let sweeps = 0

  while (queue.length > 0 && finds.length < count && sweeps < MAX_SWEEPS) {
    if (deps.signal?.aborted) break
    if (sweeps > 0) await pause(PAUSE_MS)
    const { cell, whole } = queue.shift()!
    sweeps += 1

    let body: unknown
    try {
      body = await search(sweepBox(cell, random, whole), deps)
    } catch {
      // One unreachable or rate-limited sweep is not fatal; move to another
      // cell rather than spending the rest of the budget on this one.
      continue
    }

    const found = shuffle(readFinds(body), random)
    if (found.length === 0) {
      // The window missed; the cell itself answered when the grid was probed,
      // so give it one more try at full width before moving on.
      if (!whole) queue.unshift({ cell, whole: true })
      continue
    }

    let taken = 0
    for (const find of found) {
      if (finds.length >= count || taken >= MAX_PER_CELL) break
      if (!farEnough(find, finds)) continue
      finds.push(find)
      taken += 1
      deps.onFind?.()
    }
  }
  return finds
}

export const panoramaxSource: PanoSource = {
  id: 'panoramax',
  label: PANORAMAX_LABEL,
  // A smaller archive than Commons and one sweep per round rather than one per
  // three, so it takes the lighter share — but it is the one that puts a player
  // on an anonymous street corner.
  weight: 2,
  collect,
}
