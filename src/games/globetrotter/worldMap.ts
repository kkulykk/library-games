// Stylized world-map data for Globetrotter. The map is rendered as a dot
// matrix: a dot is drawn wherever the sample point falls inside a coarse
// land box and outside a water box. Deliberately low-fi — the game only needs
// a recognizable silhouette to aim at, not cartographic accuracy.

/** [latMin, latMax, lngMin, lngMax] */
export type GeoBox = [number, number, number, number]

export const LAND_BOXES: GeoBox[] = [
  // ── North America ──
  [58, 70, -166, -141], // Alaska
  [55, 60, -141, -130], // Alaska panhandle
  [49, 69, -130, -110], // western Canada
  [49, 73, -110, -88], // central Canada + arctic
  [62, 73, -88, -65], // Baffin / NE Canada
  [46, 62, -80, -57], // Quebec / Labrador
  [44, 49, -71, -60], // Maritimes / Gulf of St Lawrence shore
  [30, 49, -124, -75], // contiguous USA
  [38, 45, -78, -69], // US northeast corridor
  [25, 30, -85, -80], // Florida
  [23, 32, -115, -110], // Baja California
  [20, 30, -112, -97], // northern Mexico
  [15, 20, -105, -92], // southern Mexico
  [17, 21, -92, -87], // Yucatán
  [8, 15, -92, -80], // Central America
  [20, 23, -85, -75], // Cuba
  [18, 20, -74, -68], // Hispaniola
  // ── Greenland ──
  [60, 70, -50, -42],
  [68, 76, -58, -25],
  [76, 82, -60, -20],
  // ── South America ──
  [0, 11, -75, -52], // Colombia / Venezuela / Guianas
  [-5, 8, -80, -75], // Pacific coast north
  [-10, 0, -75, -35], // Amazon / Brazil bulge
  [-23, -10, -65, -38], // eastern Brazil
  [-18, -5, -78, -65], // Peru / Bolivia
  [-33, -23, -70, -48], // Paraguay / N Argentina / S Brazil
  [-42, -33, -73, -58], // central Chile / Argentina
  [-54, -42, -74, -64], // Patagonia
  // ── Africa ──
  [22, 35, -10, 25], // Maghreb / Sahara north
  [22, 32, 25, 35], // Egypt
  [10, 22, -17, 25], // Sahel / west bulge
  [4, 10, -13, 10], // Gulf of Guinea coast
  [-5, 10, 10, 30], // central Africa
  [10, 22, 25, 37], // Sudan
  [0, 15, 30, 43], // East Africa / Ethiopia
  [2, 11, 43, 51], // Horn of Africa
  [-15, 0, 12, 41], // Tanzania / DRC south / Mozambique north
  [-30, -15, 13, 36], // southern Africa
  [-35, -30, 17, 30], // South Africa tip
  [-25, -12, 43, 50], // Madagascar
  // ── Europe ──
  [36, 43, -9, 0], // Iberia
  [43, 51, -4, 7], // France
  [45, 55, 5, 25], // central Europe
  [38, 45, 8, 17], // Italy
  [37, 45, 17, 28], // Balkans / Greece
  [50, 58, -5, 1], // Great Britain
  [52, 55, -10, -6], // Ireland
  [56, 70, 5, 25], // Scandinavia
  [60, 69, 21, 31], // Finland
  [45, 58, 25, 40], // eastern Europe
  [63, 66, -23, -14], // Iceland
  // ── Asia ──
  [50, 68, 40, 60], // western Russia
  [50, 72, 60, 120], // Siberia
  [55, 70, 120, 170], // eastern Siberia
  [51, 62, 155, 163], // Kamchatka
  [37, 50, 50, 88], // Central Asia
  [36, 42, 26, 44], // Anatolia
  [25, 38, 34, 62], // Levant / Iraq / Iran
  [15, 30, 35, 55], // Arabia
  [13, 23, 43, 59], // Yemen / Oman
  [24, 36, 60, 78], // Pakistan / NW India
  [8, 28, 68, 88], // India
  [16, 28, 88, 98], // Bangladesh / Myanmar
  [30, 45, 75, 100], // Tibet / Xinjiang
  [43, 51, 88, 118], // Mongolia
  [22, 45, 98, 122], // eastern China
  [10, 22, 98, 109], // Indochina
  [1, 10, 98, 104], // Malay peninsula
  [34, 42, 126, 130], // Korea
  [31, 38, 130, 141], // Japan south
  [36, 45, 138, 145], // Japan north
  [6, 9, 79, 82], // Sri Lanka
  [-5, 5, 95, 106], // Sumatra
  [-9, -6, 105, 116], // Java / Bali
  [-4, 6, 108, 118], // Borneo
  [-5, 2, 118, 124], // Sulawesi
  [-9, 0, 130, 150], // New Guinea
  [6, 18, 120, 126], // Philippines
  // ── Oceania ──
  [-35, -12, 113, 153], // Australia
  [-38, -34, 136, 150], // SE Australia
  [-43, -40, 144, 149], // Tasmania
  [-41, -34, 172, 178], // New Zealand north
  [-47, -41, 166, 174], // New Zealand south
  // ── Antarctica (thin coastal band — a full-height block overwhelms the map) ──
  [-81, -71, -180, 180],
  [-71, -64, -66, -56], // peninsula
]

export const WATER_BOXES: GeoBox[] = [
  [51, 64, -95, -78], // Hudson Bay
  [37, 47, 47, 54], // Caspian Sea
  [41, 46, 28, 40], // Black Sea
  [54, 61, 15, 22], // Baltic Sea
  [24, 29, 48, 57], // Persian Gulf
  [15, 28, 34, 39], // Red Sea
  [-17, -12, 135, 141], // Gulf of Carpentaria
  [-35, -32, 122, 133], // Great Australian Bight
]

function inBox(lat: number, lng: number, [latMin, latMax, lngMin, lngMax]: GeoBox): boolean {
  return lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax
}

export function isLand(lat: number, lng: number): boolean {
  if (WATER_BOXES.some((box) => inBox(lat, lng, box))) return false
  return LAND_BOXES.some((box) => inBox(lat, lng, box))
}

export interface LandDot {
  lat: number
  lng: number
}

/** Sample the land mask on a regular grid (default 3°) for dot-matrix rendering. */
export function landDots(stepDeg = 3): LandDot[] {
  const dots: LandDot[] = []
  for (let lat = 90 - stepDeg / 2; lat > -90; lat -= stepDeg) {
    for (let lng = -180 + stepDeg / 2; lng < 180; lng += stepDeg) {
      if (isLand(lat, lng)) dots.push({ lat, lng })
    }
  }
  return dots
}
