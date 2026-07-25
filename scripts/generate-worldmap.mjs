#!/usr/bin/env node
// Generates the Globetrotter geometry data files from the vendored Natural
// Earth 1:110m TopoJSON (scripts/data/*, via the world-atlas npm package —
// Natural Earth data is public domain):
//   * src/games/globetrotter/landPolygons.json    (land rings, map rendering)
//   * src/games/globetrotter/countryPolygons.json (named country rings, used
//     to name the reveal in Random World mode)
//
// The TopoJSON is decoded here (delta-encoded quantized arcs, ~40 lines) so
// the app needs no topojson runtime dependency: the output is plain lists of
// [lng, lat] rings.
//
// Usage:
//   node scripts/generate-worldmap.mjs           # write both files
//   node scripts/generate-worldmap.mjs --check   # exit 1 if either is stale

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'src', 'games', 'globetrotter')

const round = (value) => Math.round(value * 100) / 100

function decodeTopo(path) {
  const topo = JSON.parse(readFileSync(path, 'utf8'))
  const { scale, translate } = topo.transform
  // Decode each delta-encoded quantized arc into absolute [lng, lat] points.
  const arcs = topo.arcs.map((arc) => {
    let x = 0
    let y = 0
    return arc.map(([dx, dy]) => {
      x += dx
      y += dy
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]]
    })
  })
  // Stitch a ring from its arc indices. A negative index ~i means arc i
  // reversed. Consecutive arcs share their joint point — drop the duplicate.
  function stitchRing(arcIndexes) {
    const points = []
    for (const index of arcIndexes) {
      const arc = index >= 0 ? arcs[index] : [...arcs[~index]].reverse()
      points.push(...(points.length ? arc.slice(1) : arc))
    }
    return points
  }
  return { topo, stitchRing }
}

function ringsOf(geometry, stitchRing) {
  const polygons = geometry.type === 'Polygon' ? [geometry.arcs] : geometry.arcs
  const rings = []
  for (const polygon of polygons) {
    for (const ring of polygon) {
      rings.push(stitchRing(ring).map(([lng, lat]) => [round(lng), round(lat)]))
    }
  }
  return rings
}

// ── land (map silhouette) ────────────────────────────────────────────────────
const land = decodeTopo(join(__dirname, 'data', 'land-110m.json'))
const landRings = land.topo.objects.land.geometries.flatMap((g) => ringsOf(g, land.stitchRing))
const landOut = JSON.stringify({ rings: landRings }) + '\n'

// ── countries (Random World reveal names) ────────────────────────────────────
const world = decodeTopo(join(__dirname, 'data', 'countries-110m.json'))
const countries = world.topo.objects.countries.geometries
  .filter((g) => g.type === 'Polygon' || g.type === 'MultiPolygon')
  .map((g) => ({ name: g.properties.name, rings: ringsOf(g, world.stitchRing) }))
const countriesOut = JSON.stringify({ countries }) + '\n'

const OUTPUTS = [
  [join(OUT_DIR, 'landPolygons.json'), landOut, `${landRings.length} land rings`],
  [join(OUT_DIR, 'countryPolygons.json'), countriesOut, `${countries.length} countries`],
]

const check = process.argv.includes('--check')
let stale = false
for (const [path, generated, summary] of OUTPUTS) {
  if (check) {
    let current = ''
    try {
      current = readFileSync(path, 'utf8')
    } catch {
      console.error(`worldmap check: ${path} is missing. Run: node scripts/generate-worldmap.mjs`)
      stale = true
      continue
    }
    if (current !== generated) {
      console.error(
        `worldmap check: ${path} is out of date with scripts/generate-worldmap.mjs.\n` +
          'Run: node scripts/generate-worldmap.mjs'
      )
      stale = true
    }
  } else {
    writeFileSync(path, generated)
    console.log(`Wrote ${path} (${summary})`)
  }
}
if (check) {
  if (stale) process.exit(1)
  console.log('worldmap check: generated geometry files are up to date.')
}
