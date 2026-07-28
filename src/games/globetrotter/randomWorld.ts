// Random World mode: sample random geotagged 360° panoramas from the open web
// at play time.
//
// Two archives feed a deck, both free, keyless and CORS-enabled, so a static
// site can query them straight from the browser:
//
//   * **Wikimedia Commons** — "Category:360° panoramas", over a million
//     equirectangular photospheres with camera geotags. Landmarks, interiors,
//     aerials, and a large seam of donated Mapillary street imagery.
//   * **Panoramax** — the open, federated Street View alternative (IGN,
//     OSM-France and independent instances), ~114M geotagged pictures under
//     CC-BY-SA and equivalents. Ordinary streets in ordinary towns.
//
// Neither can be relied on alone: Commons rate-limits anonymous bursts (HTTP
// 429) and Panoramax's coverage, while worldwide, is patchy. Splitting a deck
// between them means a bad day at one archive costs a share of a deck rather
// than the whole game — and a deck that mixes a landmark photosphere with
// somebody's street corner is simply a better round of guessing. When both come
// up short, `buildRandomWorldDeck` tops the deck up from the vendored reserve,
// so the mode is always playable.
//
// Other archives were considered and rejected: Mapillary needs a Meta access
// token on every request (a key a static site cannot keep), KartaView's current
// API answers "Restricted access!" without auth and its open legacy endpoint is
// almost entirely flat imagery, and 360Cities and Google Street View are paid,
// contract-gated, or built around a viewer that never hands over the pixels.
//
// Pure async data module — no React. `fetch` and `random` are injectable so the
// whole pipeline is unit-testable offline.
import { haversineKm, shuffle, type GeoLocation } from './logic'
import { countryAt } from './countries'
import { RESERVE_PANORAMAS, type ReservePanorama } from './randomWorldReserve'
import { commonsSource, COMMONS_LABEL } from './sources/commons'
import { panoramaxSource } from './sources/panoramax'
import { farEnough, MIN_SEPARATION_KM } from './sources/spread'
import type { PanoFind, PanoSource } from './sources/types'

/** The archives a deck is drawn from, in the order they are credited. */
export const PANO_SOURCES: readonly PanoSource[] = [commonsSource, panoramaxSource]

export interface RandomWorldDeps {
  fetchFn?: typeof fetch
  random?: () => number
  /** Called as the deck fills up, for the scouting progress readout. */
  onProgress?: (found: number, total: number) => void
  signal?: AbortSignal
  /** Injectable for tests; production always uses `PANO_SOURCES`. */
  sources?: readonly PanoSource[]
}

export type DeckSource = 'live' | 'mixed' | 'reserve'

export interface RandomWorldDeck {
  deck: GeoLocation[]
  source: DeckSource
}

function formatCoords(lat: number, lng: number): string {
  const ns = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`
  const ew = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`
  return `${ns}, ${ew}`
}

/** Shape a geotagged panorama into the location the game rounds consume. */
export function toGeoLocation(find: PanoFind): GeoLocation {
  return {
    name: countryAt(find.lat, find.lng) ?? 'Uncharted territory',
    country: formatCoords(find.lat, find.lng),
    lat: find.lat,
    lng: find.lng,
    emoji: '🌐',
    clues: [],
    pano: find.pano,
  }
}

/**
 * Split `count` rounds between the sources by weight, giving every source at
 * least one round so a deck always has more than one archive in it.
 */
export function shareOut(count: number, sources: readonly PanoSource[]): number[] {
  if (sources.length === 0) return []
  if (count <= sources.length) return sources.map(() => 1)
  const total = sources.reduce((sum, source) => sum + source.weight, 0)
  const shares = sources.map((source) => Math.max(1, Math.floor((count * source.weight) / total)))
  // Flooring leaves a remainder; hand it to the heaviest source.
  let spare = count - shares.reduce((sum, share) => sum + share, 0)
  const order = sources
    .map((_, index) => index)
    .sort((a, b) => sources[b].weight - sources[a].weight)
  for (let i = 0; spare > 0; i = (i + 1) % order.length) {
    shares[order[i]] += 1
    spare -= 1
  }
  return shares
}

/** Merge finds into an existing deck, keeping rounds apart. */
function absorb(deck: PanoFind[], finds: readonly PanoFind[], count: number): PanoFind[] {
  for (const find of finds) {
    if (deck.length >= count) break
    if (!farEnough(find, deck)) continue
    deck.push(find)
  }
  return deck
}

/**
 * Ask every source for its share in parallel, then let whoever still has
 * something to give cover what the others missed.
 *
 * Progress is reported off a single running counter rather than per source, so
 * the scouting readout climbs once from 0 to `count` no matter how many
 * archives are answering at the same time.
 */
async function collectLive(count: number, deps: RandomWorldDeps): Promise<PanoFind[]> {
  const sources = deps.sources ?? PANO_SOURCES
  // Bound, and reached through `globalThis`: a source that calls it as
  // `deps.fetchFn(…)` would otherwise hand the browser's `fetch` a receiver it
  // rejects outright, and naming the bare identifier would break the jsdom
  // tests, which have no `fetch` at all and never need one.
  const fetchFn = deps.fetchFn ?? globalThis.fetch?.bind(globalThis)
  const random = deps.random ?? Math.random
  let reported = 0
  const onFind = () => {
    if (reported >= count) return
    reported += 1
    deps.onProgress?.(reported, count)
  }
  const sourceDeps = { fetchFn, random, signal: deps.signal, onFind }
  const ask = (source: PanoSource, want: number) =>
    want <= 0 ? Promise.resolve<PanoFind[]>([]) : source.collect(want, sourceDeps).catch(() => [])

  const shares = shareOut(count, sources)
  const harvest = await Promise.all(sources.map((source, index) => ask(source, shares[index])))

  const deck: PanoFind[] = []
  for (const finds of harvest) absorb(deck, shuffle(finds, random), count)
  if (deck.length >= count) return deck

  // Second pass: a source that filled its share is the one most likely to have
  // more, so the shortfall goes to whoever yielded most first.
  const byYield = sources
    .map((source, index) => ({ source, yielded: harvest[index].length }))
    .sort((a, b) => b.yielded - a.yielded)
  for (const { source, yielded } of byYield) {
    if (deck.length >= count) break
    if (yielded === 0) continue
    absorb(deck, shuffle(await ask(source, count - deck.length), random), count)
  }
  return deck
}

/**
 * Assemble a deck of `count` random panorama locations straight from the live
 * archives. Throws when they are unreachable or too few usable files were found
 * — `buildRandomWorldDeck` is the forgiving wrapper most callers want.
 */
export async function fetchRandomWorldDeck(
  count: number,
  deps: RandomWorldDeps = {}
): Promise<GeoLocation[]> {
  const finds = await collectLive(count, deps)
  if (finds.length < count) {
    throw new Error(`Only found ${finds.length} of ${count} random panoramas`)
  }
  return finds.slice(0, count).map(toGeoLocation)
}

function reserveToLocation(entry: ReservePanorama): GeoLocation {
  return toGeoLocation({
    lat: entry.lat,
    lng: entry.lng,
    pano: {
      url: entry.url,
      page: entry.page,
      author: entry.author,
      license: entry.license,
      // Every vendored entry is a Commons file; the generator script only
      // knows how to fetch from there.
      source: COMMONS_LABEL,
    },
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
 * The deck the game actually starts with: live finds first, topped up from the
 * vendored reserve whenever the archives are rate-limited, offline, or just
 * short of usable files. Never throws — Random World always has somewhere to go.
 */
export async function buildRandomWorldDeck(
  count: number,
  deps: RandomWorldDeps = {}
): Promise<RandomWorldDeck> {
  const random = deps.random ?? Math.random
  let live: GeoLocation[] = []
  try {
    live = (await collectLive(count, deps)).slice(0, count).map(toGeoLocation)
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
