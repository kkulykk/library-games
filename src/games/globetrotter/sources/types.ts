// What a Random World panorama source is.
//
// Random World draws its rounds from open photo archives at play time. Each
// archive is wrapped in a `PanoSource` so the deck builder can ask several of
// them for a share of a deck and merge the answers, and so one going down or
// rate-limiting only costs its share rather than the whole game.
//
// A source is pure async data: no React, and `fetch`/`random` arrive through
// deps so the whole pipeline is unit-testable offline.
import type { GeoPano } from '../locations'

/** A geotagged photosphere a source found, ready to become a round. */
export interface PanoFind {
  lat: number
  lng: number
  pano: GeoPano
}

export interface PanoSourceDeps {
  fetchFn: typeof fetch
  random: () => number
  signal?: AbortSignal
  /** Called once per accepted find, for the scouting progress readout. */
  onFind?: () => void
}

export interface PanoSource {
  /** Stable identifier, used in tests and diagnostics. */
  id: string
  /** Credit line shown on the panorama itself. */
  label: string
  /**
   * Relative share of a deck this source is asked for.
   *
   * Shares are a starting split, not a quota: whatever a source comes back
   * short of is offered to the others before the deck falls to the reserve.
   */
  weight: number
  /**
   * Find up to `count` well-separated photospheres. Returns whatever it got —
   * a thin result is normal, and throwing is reserved for a source that could
   * not be reached at all.
   */
  collect(count: number, deps: PanoSourceDeps): Promise<PanoFind[]>
}
