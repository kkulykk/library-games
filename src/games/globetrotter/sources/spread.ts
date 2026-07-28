// The one rule every panorama source and the deck builder share: two rounds of
// the same trip must not be neighbours.
//
// Archives are built from drives and walks, so consecutive files are seconds
// and metres apart. Without a separation rule a "world" deck is five frames of
// one street.
import { haversineKm } from '../logic'

/** Minimum distance between two rounds of one deck. */
export const MIN_SEPARATION_KM = 50

export interface Spot {
  lat: number
  lng: number
}

/** True when `spot` is far enough from everything already picked. */
export function farEnough(spot: Spot, taken: readonly Spot[]): boolean {
  return !taken.some((other) => haversineKm(spot, other) < MIN_SEPARATION_KM)
}
