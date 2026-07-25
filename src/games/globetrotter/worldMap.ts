// Real-world land geometry for Globetrotter, derived from Natural Earth
// 1:110m land polygons (public domain) — see scripts/generate-worldmap.mjs,
// which decodes the vendored TopoJSON into plain [lng, lat] rings. Pure data
// helpers — no React.
import landPolygons from './landPolygons.json'

/** [lng, lat] — GeoJSON axis order. */
export type LngLat = [number, number]
export type Ring = LngLat[]

export const LAND_RINGS: Ring[] = landPolygons.rings as Ring[]

/**
 * Even-odd point-in-polygon over every land ring. Natural Earth land polygons
 * do not overlap, so counting crossings across all rings at once handles both
 * exteriors and holes (e.g. the Caspian Sea) correctly.
 */
export function isLand(lat: number, lng: number): boolean {
  let inside = false
  for (const ring of LAND_RINGS) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
      if (crosses) inside = !inside
    }
  }
  return inside
}
