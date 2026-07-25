// Reverse geocoding for the reveal: turn a Random World drop's coordinates
// into the town and country it actually landed in, so the answer reads
// "Ternberg · Austria" instead of just "Austria".
//
// Nominatim is OpenStreetMap's free, keyless, CORS-enabled geocoder. Its usage
// policy caps callers at one request per second, so this module is deliberately
// thin: one lookup per reveal, memoized per coordinate (in-flight promises
// included, so eight players in a room never queue duplicate work), timed out,
// and never throwing — a failed lookup just leaves the country-level answer the
// game already knows from its own polygons.
//
// Pure async data module — no React. `fetch` is injectable for tests.

const API = 'https://nominatim.openstreetmap.org/reverse'
const TIMEOUT_MS = 7000
/** Town-level detail: specific enough to name the spot, coarse enough to exist. */
const ZOOM = 12

export interface PlaceName {
  /** The most specific settlement name available, or null out in the wild. */
  place: string | null
  /** Country as OSM names it — may differ slightly from the polygon name. */
  country: string | null
}

export interface PlaceNameDeps {
  fetchFn?: typeof fetch
  signal?: AbortSignal
}

interface NominatimResponse {
  address?: Record<string, string>
}

// Most specific first: a hamlet is a better answer than its county.
const PLACE_KEYS = [
  'city',
  'town',
  'village',
  'hamlet',
  'municipality',
  'suburb',
  'city_district',
  'county',
  'state',
]

const cache = new Map<string, Promise<PlaceName | null>>()

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

async function lookup(lat: number, lng: number, deps: PlaceNameDeps): Promise<PlaceName | null> {
  const fetchFn = deps.fetchFn ?? fetch
  const query = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lng),
    zoom: String(ZOOM),
    'accept-language': 'en',
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onAbort = () => controller.abort()
  deps.signal?.addEventListener('abort', onAbort)
  try {
    const response = await fetchFn(`${API}?${query}`, { signal: controller.signal })
    if (!response.ok) return null
    const body = (await response.json()) as NominatimResponse
    const address = body.address
    if (!address) return null
    const place = PLACE_KEYS.map((key) => address[key]).find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    )
    const country = typeof address.country === 'string' ? address.country.trim() : ''
    if (!place && !country) return null
    return { place: place?.trim() ?? null, country: country || null }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    deps.signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Name the settlement at a coordinate, or null when it cannot be resolved
 * (open water, ice sheet, geocoder unreachable). Memoized per coordinate.
 */
export function reverseGeocode(
  lat: number,
  lng: number,
  deps: PlaceNameDeps = {}
): Promise<PlaceName | null> {
  const key = cacheKey(lat, lng)
  const cached = cache.get(key)
  if (cached) return cached
  const pending = lookup(lat, lng, deps).catch(() => null)
  cache.set(key, pending)
  return pending
}

/** Test seam — the module-level cache would otherwise leak between cases. */
export function clearPlaceNameCache(): void {
  cache.clear()
}
