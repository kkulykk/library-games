// Random World mode: sample random geotagged 360° panoramas from Wikimedia
// Commons at play time. Commons' "Category:360° panoramas" holds over a
// million equirectangular photospheres (mostly Mapillary street imagery —
// suburbs, roadsides, random towns — plus landmark panoramas), each with a
// camera geotag. The API is free, keyless, and CORS-enabled (`origin=*`), so
// a static site can query it directly from the browser.
//
// Pure async data module — no React. `fetch` and `random` are injectable so
// the whole pipeline is unit-testable offline.
import { haversineKm, isValidGuess, type GeoLocation } from './logic'
import { countryAt } from './countries'

const API = 'https://commons.wikimedia.org/w/api.php'
const CATEGORY = 'Category:360° panoramas'
const TEXTURE_WIDTH = 3840
const MIN_SOURCE_WIDTH = 2048
// Files from one Mapillary drive are seconds apart; keep rounds genuinely
// distinct by requiring pins at least this far apart.
const MIN_SEPARATION_KM = 50
const MAX_ATTEMPTS_PER_ROUND = 4

// Category members sort by filename. The corpus is dominated by files named
// "Mapillary (<user>…" — so most prefixes dive into street imagery at a random
// uploader, and plain letters surface everything else (landmark panoramas,
// aerials). One random prefix per round keeps rounds independent.
const MAPILLARY_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
const PLAIN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export interface RandomWorldDeps {
  fetchFn?: typeof fetch
  random?: () => number
}

function randomPrefix(random: () => number): string {
  if (random() < 0.7) {
    return 'Mapillary (' + MAPILLARY_CHARS[Math.floor(random() * MAPILLARY_CHARS.length)]
  }
  return PLAIN_CHARS[Math.floor(random() * PLAIN_CHARS.length)]
}

async function commonsApi(fetchFn: typeof fetch, params: Record<string, string>): Promise<unknown> {
  const query = new URLSearchParams({ action: 'query', format: 'json', origin: '*', ...params })
  const response = await fetchFn(`${API}?${query}`)
  if (!response.ok) throw new Error(`Commons API ${response.status}`)
  return response.json()
}

interface CategoryMembersResponse {
  query?: { categorymembers?: Array<{ title?: string }> }
}

interface ImageInfoResponse {
  query?: {
    pages?: Record<
      string,
      {
        title?: string
        imageinfo?: Array<{
          width?: number
          height?: number
          mime?: string
          thumburl?: string
          extmetadata?: Record<string, { value?: string }>
        }>
        coordinates?: Array<{ lat?: number; lon?: number }>
      }
    >
  }
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, '').trim()
}

/**
 * Fetch one random playable panorama location, or null if this prefix batch
 * had no usable file.
 */
async function fetchOneCandidate(
  fetchFn: typeof fetch,
  random: () => number,
  taken: GeoLocation[]
): Promise<GeoLocation | null> {
  const members = (await commonsApi(fetchFn, {
    list: 'categorymembers',
    cmtitle: CATEGORY,
    cmtype: 'file',
    cmlimit: '20',
    cmstartsortkeyprefix: randomPrefix(random),
  })) as CategoryMembersResponse

  const titles = (members.query?.categorymembers ?? [])
    .map((m) => m.title)
    .filter((t): t is string => typeof t === 'string')
  if (titles.length === 0) return null

  // One batch is often a single drive sequence — query a spread of it, then
  // pick one usable file at random.
  const sampled = [...titles].sort(() => random() - 0.5).slice(0, 8)
  const info = (await commonsApi(fetchFn, {
    titles: sampled.join('|'),
    prop: 'imageinfo|coordinates',
    iiprop: 'size|mime|url|extmetadata',
    iiurlwidth: String(TEXTURE_WIDTH),
  })) as ImageInfoResponse

  const usable: GeoLocation[] = []
  for (const page of Object.values(info.query?.pages ?? {})) {
    const ii = page.imageinfo?.[0]
    const coord = page.coordinates?.[0]
    if (!ii || !page.title || typeof coord?.lat !== 'number' || typeof coord?.lon !== 'number') {
      continue
    }
    const { width = 0, height = 1, mime, thumburl } = ii
    if (mime !== 'image/jpeg' || !thumburl) continue
    if (width < MIN_SOURCE_WIDTH || Math.abs(width / height - 2) > 0.02) continue
    if (!isValidGuess(coord.lat, coord.lon)) continue
    const spot = { lat: coord.lat, lng: coord.lon }
    if (taken.some((t) => haversineKm(spot, { lat: t.lat, lng: t.lng }) < MIN_SEPARATION_KM)) {
      continue
    }
    const md = ii.extmetadata ?? {}
    usable.push({
      name: countryAt(coord.lat, coord.lon) ?? 'Uncharted territory',
      country: `${Math.abs(coord.lat).toFixed(2)}°${coord.lat >= 0 ? 'N' : 'S'}, ${Math.abs(coord.lon).toFixed(2)}°${coord.lon >= 0 ? 'E' : 'W'}`,
      lat: coord.lat,
      lng: coord.lon,
      emoji: '🌐',
      clues: [],
      pano: {
        url: thumburl,
        page:
          'https://commons.wikimedia.org/wiki/' + encodeURIComponent(page.title.replace(/ /g, '_')),
        author:
          stripHtml(md.Artist?.value ?? 'Unknown')
            .split('\n')[0]
            .slice(0, 60) || 'Unknown',
        license: stripHtml(md.LicenseShortName?.value ?? 'See file page'),
      },
    })
  }

  if (usable.length === 0) return null
  return usable[Math.floor(random() * usable.length)]
}

/**
 * Assemble a deck of `count` random panorama locations. Throws when Commons
 * is unreachable or too few usable files were found — callers surface that
 * and let the player fall back to the landmark deck.
 */
export async function fetchRandomWorldDeck(
  count: number,
  deps: RandomWorldDeps = {}
): Promise<GeoLocation[]> {
  const fetchFn = deps.fetchFn ?? fetch
  const random = deps.random ?? Math.random
  const deck: GeoLocation[] = []
  let attempts = 0
  while (deck.length < count && attempts < count * MAX_ATTEMPTS_PER_ROUND) {
    attempts++
    const candidate = await fetchOneCandidate(fetchFn, random, deck)
    if (candidate) deck.push(candidate)
  }
  if (deck.length < count) {
    throw new Error(`Only found ${deck.length} of ${count} random panoramas`)
  }
  return deck
}
