// Country reveal names for Random World mode, from Natural Earth 1:110m
// countries (public domain) — see scripts/generate-worldmap.mjs. Pure data
// helpers — no React.
import countryPolygons from './countryPolygons.json'
import type { Ring } from './worldMap'

interface Country {
  name: string
  rings: Ring[]
}

const COUNTRIES: Country[] = countryPolygons.countries as Country[]

function insideRings(lat: number, lng: number, rings: Ring[]): boolean {
  let inside = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
      if (crosses) inside = !inside
    }
  }
  return inside
}

/**
 * Name the country containing the point, or null for open water / off-chart.
 * 1:110m borders are coarse — a point right on a coastline may miss its
 * country — so callers should treat null as "somewhere on Earth", not ocean.
 */
export function countryAt(lat: number, lng: number): string | null {
  for (const country of COUNTRIES) {
    if (insideRings(lat, lng, country.rings)) return country.name
  }
  return null
}
