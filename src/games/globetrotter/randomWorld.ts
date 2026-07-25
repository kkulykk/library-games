// Random World mode: sample random geotagged 360° panoramas from Wikimedia
// Commons at play time. Commons' "Category:360° panoramas" holds over a
// million equirectangular photospheres (mostly Mapillary street imagery —
// suburbs, roadsides, random towns — plus landmark panoramas), each with a
// camera geotag. The API is free, keyless, and CORS-enabled (`origin=*`), so
// a static site can query it directly from the browser.
//
// Commons rate-limits anonymous bursts (HTTP 429) and rendering a large
// thumbnail is slow, so the pipeline is deliberately frugal: one cheap
// `generator=categorymembers` request returns up to 50 candidates with their
// coordinates and dimensions, and only the handful of files that actually make
// the deck get a thumbnail rendered — in a single follow-up request. When
// Commons is unreachable or too stingy, `buildRandomWorldDeck` tops the deck up
// from the vendored reserve so the mode is always playable.
//
// Pure async data module — no React. `fetch` and `random` are injectable so
// the whole pipeline is unit-testable offline.
import { haversineKm, isValidGuess, shuffle, type GeoLocation } from './logic'
import { countryAt } from './countries'
import { RESERVE_PANORAMAS, type ReservePanorama } from './randomWorldReserve'

const API = 'https://commons.wikimedia.org/w/api.php'
const CATEGORY = 'Category:360° panoramas'
/** Wide enough for a crisp WebGL texture, small enough that Commons renders it fast. */
const TEXTURE_WIDTH = 2560
const MIN_SOURCE_WIDTH = 2048
/** Equirectangular photospheres are 2:1; allow a little slack for odd crops. */
const ASPECT_TOLERANCE = 0.05
// Files from one Mapillary drive are seconds apart; keep rounds genuinely
// distinct by requiring pins at least this far apart.
const MIN_SEPARATION_KM = 50
/** Cheap candidate sweeps per deck — each is one request returning ~50 files. */
const MAX_BATCHES = 4
const BATCH_SIZE = 50
const REQUEST_TIMEOUT_MS = 12000
/** Breather between sweeps; a burst of requests is what trips Commons' 429. */
const BATCH_PAUSE_MS = 350

// Category members can be walked two ways. By sort key the corpus is dominated
// by files named "Mapillary (<user>…", so most prefixes dive into street
// imagery at a random uploader and plain letters surface everything else
// (landmark panoramas, aerials). By timestamp a random date lands on whatever
// was categorized that week. Mixing both keeps decks varied.
const MAPILLARY_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
const PLAIN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const FIRST_YEAR = 2013

export interface RandomWorldDeps {
  fetchFn?: typeof fetch
  random?: () => number
  /** Called as the deck fills up, for the scouting progress readout. */
  onProgress?: (found: number, total: number) => void
  signal?: AbortSignal
}

export type DeckSource = 'live' | 'mixed' | 'reserve'

export interface RandomWorldDeck {
  deck: GeoLocation[]
  source: DeckSource
}

/** A random slice of the category — either by sort key or by categorization date. */
function randomWindow(random: () => number): Record<string, string> {
  if (random() < 0.45) {
    const year = FIRST_YEAR + Math.floor(random() * (new Date().getUTCFullYear() - FIRST_YEAR + 1))
    const month = 1 + Math.floor(random() * 12)
    const day = 1 + Math.floor(random() * 28)
    return {
      gcmsort: 'timestamp',
      gcmdir: 'newer',
      gcmstart: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`,
    }
  }
  const prefix =
    random() < 0.7
      ? 'Mapillary (' + MAPILLARY_CHARS[Math.floor(random() * MAPILLARY_CHARS.length)]
      : PLAIN_CHARS[Math.floor(random() * PLAIN_CHARS.length)]
  return { gcmstartsortkeyprefix: prefix }
}

async function commonsApi(
  fetchFn: typeof fetch,
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<unknown> {
  const query = new URLSearchParams({ action: 'query', format: 'json', origin: '*', ...params })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const response = await fetchFn(`${API}?${query}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`Commons API ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

interface CommonsPage {
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

interface PagesResponse {
  query?: { pages?: Record<string, CommonsPage> }
}

function stripHtml(value: string): string {
  let text = value
  let previous: string

  do {
    previous = text
    text = text.replace(/<[^<>]*>/g, '')
  } while (text !== previous)

  return text.replace(/[<>]/g, '').trim()
}

/** Commons file page for a title, keeping the readable "File:" namespace colon. */
function commonsPageUrl(title: string): string {
  return (
    'https://commons.wikimedia.org/wiki/' +
    encodeURIComponent(title.replace(/ /g, '_')).replace(/%3A/g, ':')
  )
}

function formatCoords(lat: number, lng: number): string {
  const ns = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`
  const ew = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`
  return `${ns}, ${ew}`
}

/** Shape a geotagged panorama into the location the game rounds consume. */
export function toGeoLocation(
  lat: number,
  lng: number,
  pano: { url: string; page: string; author: string; license: string }
): GeoLocation {
  return {
    name: countryAt(lat, lng) ?? 'Uncharted territory',
    country: formatCoords(lat, lng),
    lat,
    lng,
    emoji: '🌐',
    clues: [],
    pano,
  }
}

interface Candidate {
  title: string
  lat: number
  lng: number
  author: string
  license: string
}

function readCandidates(response: PagesResponse): Candidate[] {
  const candidates: Candidate[] = []
  for (const page of Object.values(response.query?.pages ?? {})) {
    const info = page.imageinfo?.[0]
    const coord = page.coordinates?.[0]
    if (!info || !page.title) continue
    if (typeof coord?.lat !== 'number' || typeof coord?.lon !== 'number') continue
    const { width = 0, height = 1, mime } = info
    if (mime !== 'image/jpeg') continue
    if (width < MIN_SOURCE_WIDTH || Math.abs(width / height - 2) > ASPECT_TOLERANCE) continue
    if (!isValidGuess(coord.lat, coord.lon)) continue
    const md = info.extmetadata ?? {}
    candidates.push({
      title: page.title,
      lat: coord.lat,
      lng: coord.lon,
      author:
        stripHtml(md.Artist?.value ?? 'Unknown')
          .split('\n')[0]
          .slice(0, 60) || 'Unknown',
      license: stripHtml(md.LicenseShortName?.value ?? 'See file page'),
    })
  }
  return candidates
}

function farEnough(candidate: Candidate, taken: Candidate[]): boolean {
  return !taken.some(
    (t) =>
      haversineKm({ lat: candidate.lat, lng: candidate.lng }, { lat: t.lat, lng: t.lng }) <
      MIN_SEPARATION_KM
  )
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sweep the category until `count` well-separated geotagged photospheres are
 * in hand (or the sweep budget runs out). Returns whatever it found — the
 * caller decides whether that is enough.
 */
async function collectCandidates(
  count: number,
  fetchFn: typeof fetch,
  random: () => number,
  deps: RandomWorldDeps
): Promise<Candidate[]> {
  const picked: Candidate[] = []
  for (let batch = 0; batch < MAX_BATCHES && picked.length < count; batch++) {
    if (batch > 0) await pause(BATCH_PAUSE_MS)
    if (deps.signal?.aborted) break
    let response: PagesResponse
    try {
      response = (await commonsApi(
        fetchFn,
        {
          generator: 'categorymembers',
          gcmtitle: CATEGORY,
          gcmtype: 'file',
          gcmlimit: String(BATCH_SIZE),
          ...randomWindow(random),
          prop: 'imageinfo|coordinates',
          iiprop: 'size|mime|extmetadata',
          iiextmetadatafilter: 'Artist|LicenseShortName',
        },
        deps.signal
      )) as PagesResponse
    } catch {
      // A rate-limited or flaky sweep is not fatal — try the next window.
      continue
    }
    for (const candidate of shuffle(readCandidates(response), random)) {
      if (picked.length >= count) break
      if (!farEnough(candidate, picked)) continue
      picked.push(candidate)
      deps.onProgress?.(picked.length, count)
    }
  }
  return picked
}

/** One request renders every thumbnail the deck actually needs. */
async function resolveThumbnails(
  candidates: Candidate[],
  fetchFn: typeof fetch,
  deps: RandomWorldDeps
): Promise<GeoLocation[]> {
  if (candidates.length === 0) return []
  const response = (await commonsApi(
    fetchFn,
    {
      titles: candidates.map((c) => c.title).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: String(TEXTURE_WIDTH),
      iiextmetadatafilter: 'Artist|LicenseShortName',
    },
    deps.signal
  )) as PagesResponse

  const byTitle = new Map(candidates.map((c) => [c.title, c]))
  const located: GeoLocation[] = []
  for (const page of Object.values(response.query?.pages ?? {})) {
    const thumb = page.imageinfo?.[0]?.thumburl
    const candidate = page.title ? byTitle.get(page.title) : undefined
    if (!thumb || !candidate) continue
    located.push(
      toGeoLocation(candidate.lat, candidate.lng, {
        url: thumb,
        page: commonsPageUrl(candidate.title),
        author: candidate.author,
        license: candidate.license,
      })
    )
  }
  return located
}

/**
 * Assemble a deck of `count` random panorama locations straight from Commons.
 * Throws when Commons is unreachable or too few usable files were found —
 * `buildRandomWorldDeck` is the forgiving wrapper most callers want.
 */
export async function fetchRandomWorldDeck(
  count: number,
  deps: RandomWorldDeps = {}
): Promise<GeoLocation[]> {
  const fetchFn = deps.fetchFn ?? fetch
  const random = deps.random ?? Math.random
  const candidates = await collectCandidates(count, fetchFn, random, deps)
  const deck = await resolveThumbnails(candidates.slice(0, count), fetchFn, deps)
  if (deck.length < count) {
    throw new Error(`Only found ${deck.length} of ${count} random panoramas`)
  }
  return deck
}

function reserveToLocation(entry: ReservePanorama): GeoLocation {
  return toGeoLocation(entry.lat, entry.lng, {
    url: entry.url,
    page: entry.page,
    author: entry.author,
    license: entry.license,
  })
}

/** The offline deck: shuffled, spread out, always available. */
export function reserveDeck(count: number, random: () => number = Math.random): GeoLocation[] {
  const picked: ReservePanorama[] = []
  for (const entry of shuffle(RESERVE_PANORAMAS, random)) {
    if (picked.length >= count) break
    const far = !picked.some(
      (p) =>
        haversineKm({ lat: entry.lat, lng: entry.lng }, { lat: p.lat, lng: p.lng }) <
        MIN_SEPARATION_KM
    )
    if (far) picked.push(entry)
  }
  return picked.map(reserveToLocation)
}

/**
 * The deck the game actually starts with: live Commons finds first, topped up
 * from the vendored reserve whenever Commons is rate-limited, offline, or just
 * short of usable files. Never throws — Random World always has somewhere to go.
 */
export async function buildRandomWorldDeck(
  count: number,
  deps: RandomWorldDeps = {}
): Promise<RandomWorldDeck> {
  const fetchFn = deps.fetchFn ?? fetch
  const random = deps.random ?? Math.random
  let live: GeoLocation[] = []
  try {
    const candidates = await collectCandidates(count, fetchFn, random, deps)
    live = await resolveThumbnails(candidates.slice(0, count), fetchFn, deps)
  } catch {
    live = []
  }
  if (live.length >= count) return { deck: live.slice(0, count), source: 'live' }

  const fill = reserveDeck(count * 2, random).filter((spot) =>
    live.every(
      (found) =>
        haversineKm({ lat: spot.lat, lng: spot.lng }, { lat: found.lat, lng: found.lng }) >=
        MIN_SEPARATION_KM
    )
  )
  const deck = [...live, ...fill].slice(0, count)
  deps.onProgress?.(deck.length, count)
  return { deck, source: live.length === 0 ? 'reserve' : 'mixed' }
}
