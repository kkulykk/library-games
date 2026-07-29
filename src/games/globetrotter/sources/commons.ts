// Wikimedia Commons as a Random World panorama source.
//
// Commons' "Category:360° panoramas" holds over a million equirectangular
// photospheres (mostly Mapillary street imagery — suburbs, roadsides, random
// towns — plus landmark panoramas), each with a camera geotag. The API is free,
// keyless, and CORS-enabled (`origin=*`), so a static site can query it
// directly from the browser.
//
// Commons rate-limits anonymous bursts (HTTP 429) and rendering a large
// thumbnail is slow, so the pipeline is deliberately frugal: a cheap
// `generator=categorymembers` request returns a wide window of candidates with
// their coordinates and dimensions, and only the handful of files that actually
// make the deck get a thumbnail rendered — in a single follow-up request. The
// budget is spent on *wider* sweeps rather than more of them, because the limit
// counts requests and a wide window is what lets a deck span several uploaders
// instead of five frames of one photographer's series.
import { isValidGuess, shuffle } from '../logic'
import { farEnough } from './spread'
import type { PanoFind, PanoSource, PanoSourceDeps } from './types'

const API = 'https://commons.wikimedia.org/w/api.php'
const CATEGORY = 'Category:360° panoramas'
export const COMMONS_LABEL = 'Wikimedia Commons'
/**
 * Deck URLs are asked for at Wikimedia's widest standard rendition, and each
 * player's browser snaps that down to what its own screen can use
 * (`panoTexture.ts`). Asking for anything off the standard ladder is pointless
 * here — the API silently rounds *up* to the next standard width, so this used
 * to read 2560 while every deck was served 3840 anyway.
 *
 * @see https://www.mediawiki.org/wiki/Common_thumbnail_sizes
 */
const TEXTURE_WIDTH = 3840
const MIN_SOURCE_WIDTH = 2048
/** Equirectangular photospheres are 2:1; allow a little slack for odd crops. */
const ASPECT_TOLERANCE = 0.05
/** Cheap candidate sweeps per deck — each is one request returning `BATCH_SIZE` files. */
const MAX_BATCHES = 4
/**
 * Category members per sweep.
 *
 * Commons rate-limits by request, not by result, so a wide window is the cheap
 * way to see more of the category: 500 members is one request where ten sweeps
 * of 50 would be ten, and a deck drawn from a 500-file slice spans many more
 * uploaders than one drawn from a 50-file slice — which is usually a single
 * photographer's series.
 */
const BATCH_SIZE = 500
const REQUEST_TIMEOUT_MS = 12000
/** Breather between sweeps; a burst of requests is what trips Commons' 429. */
const BATCH_PAUSE_MS = 350
/**
 * Rounds one sweep may contribute before the deck moves to another window.
 *
 * A window is a contiguous run of the category, and contiguous runs are one
 * photographer's series — a hundred burial mounds, one library's reading rooms.
 * Those clear the separation rule (they are kilometres apart) while still
 * handing the player five versions of the same photograph, so a deck that comes
 * from one window is a deck that barely changes.
 *
 * Three per sweep costs a five-round deck a second window and leaves half the
 * sweep budget spare for windows that come back thin or rate-limited. Tighter
 * caps were measured and are worse: at two per sweep the deck needs three
 * windows, which trips Commons' burst limit often enough to land back on the
 * reserve — the very repetition the cap is here to prevent.
 */
const MAX_PER_BATCH = 3

// Category members can be walked two ways. By sort key the corpus is dominated
// by files named "Mapillary (<user>…", so most prefixes dive into street
// imagery at a random uploader and plain letters surface everything else
// (landmark panoramas, aerials). By timestamp a random date lands on whatever
// was categorized that week. Mixing both keeps decks varied.
const MAPILLARY_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
const PLAIN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const FIRST_YEAR = 2013

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

function sparesCanComplete(picked: Candidate[], spare: Candidate[], count: number): boolean {
  const trial = [...picked]
  for (const candidate of spare) {
    if (trial.length >= count) return true
    if (farEnough(candidate, trial)) trial.push(candidate)
  }
  return trial.length >= count
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sweep the category until `count` well-separated geotagged photospheres are
 * in hand (or the sweep budget runs out). Returns whatever it found — the
 * caller decides whether that is enough.
 */
async function collectCandidates(count: number, deps: PanoSourceDeps): Promise<Candidate[]> {
  const { fetchFn, random } = deps
  const picked: Candidate[] = []
  // Usable finds the per-sweep cap turned away. A later sweep that comes back
  // rate-limited would otherwise send the deck to the reserve while these sit
  // unspent, so they finish it instead — at the cost of no extra request.
  const spare: Candidate[] = []
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
          // The sweep's real bottleneck. `prop=coordinates` fills in only
          // `colimit` pages per request and that defaults to *10*, so all but
          // ten files of every window came back geotag-less and were dropped by
          // `readCandidates` as if Commons had never geotagged them. That left
          // too few usable finds to fill a deck, and the shortfall was topped
          // up from the 25-photo offline reserve — the same panoramas, game
          // after game.
          colimit: 'max',
        },
        deps.signal
      )) as PagesResponse
    } catch {
      // A rate-limited or flaky sweep is not fatal. If earlier windows already
      // left enough usable finds behind the diversity cap, use them now instead
      // of waiting through the rest of the request budget.
      if (sparesCanComplete(picked, spare, count)) break
      continue
    }
    let taken = 0
    for (const candidate of shuffle(readCandidates(response), random)) {
      if (picked.length >= count) break
      if (!farEnough(candidate, picked)) continue
      if (taken >= MAX_PER_BATCH) {
        spare.push(candidate)
        continue
      }
      picked.push(candidate)
      taken += 1
      deps.onFind?.()
    }
  }

  for (const candidate of spare) {
    if (picked.length >= count) break
    if (!farEnough(candidate, picked)) continue
    picked.push(candidate)
    deps.onFind?.()
  }
  return picked
}

/** One request renders every thumbnail the deck actually needs. */
async function resolveThumbnails(
  candidates: Candidate[],
  deps: PanoSourceDeps
): Promise<PanoFind[]> {
  if (candidates.length === 0) return []
  const response = (await commonsApi(
    deps.fetchFn,
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
  const finds: PanoFind[] = []
  for (const page of Object.values(response.query?.pages ?? {})) {
    const thumb = page.imageinfo?.[0]?.thumburl
    const candidate = page.title ? byTitle.get(page.title) : undefined
    if (!thumb || !candidate) continue
    finds.push({
      lat: candidate.lat,
      lng: candidate.lng,
      pano: {
        url: thumb,
        page: commonsPageUrl(candidate.title),
        author: candidate.author,
        license: candidate.license,
        source: COMMONS_LABEL,
      },
    })
  }
  return finds
}

export const commonsSource: PanoSource = {
  id: 'commons',
  label: COMMONS_LABEL,
  // The bigger, more varied archive of the two, and the one whose files are
  // already sized for a WebGL texture — so it carries most of a deck.
  weight: 3,
  async collect(count: number, deps: PanoSourceDeps): Promise<PanoFind[]> {
    const candidates = await collectCandidates(count, deps)
    return resolveThumbnails(candidates.slice(0, count), deps)
  },
}
