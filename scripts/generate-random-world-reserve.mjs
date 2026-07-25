#!/usr/bin/env node
// Generates src/games/globetrotter/randomWorldReserve.ts — the offline reserve
// deck Random World falls back to when the Wikimedia Commons API is
// unreachable, rate-limited (HTTP 429 on anonymous bursts), or short of usable
// files.
//
// Every entry is a freely licensed, geotagged, 2:1 equirectangular photosphere
// from Commons' "Category:360° panoramas", resolved to a hotlinkable thumbnail
// rendition. Commons rate-limits bursts hard, so this script is deliberately
// slow — it is a manual, occasional job and is NOT wired into CI (its result
// depends on the live archive, not on the commit).
//
// Usage:
//   node scripts/generate-random-world-reserve.mjs [targetCount]
//
// It merges into the existing deck rather than replacing it, so re-running
// widens the coverage instead of churning URLs.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'src', 'games', 'globetrotter', 'randomWorldReserve.ts')

const API = 'https://commons.wikimedia.org/w/api.php'
const CATEGORY = 'Category:360° panoramas'
const THUMB_WIDTH = 2560
const MIN_WIDTH = 2048
const ASPECT_TOLERANCE = 0.05
/** Reserve entries are kept this far apart so a five-round deck spans the globe. */
const MIN_SEPARATION_KM = 300
const TARGET = Number(process.argv[2] ?? 34)
const USER_AGENT = 'library-games-reserve-builder/1.0 (https://github.com/kkulykk/library-games)'

const MAPILLARY_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
const PLAIN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function api(params) {
  const query = new URLSearchParams({ action: 'query', format: 'json', origin: '*', ...params })
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetch(`${API}?${query}`, { headers: { 'user-agent': USER_AGENT } })
    if (response.ok) {
      await sleep(2500)
      return response.json()
    }
    if (response.status !== 429) throw new Error(`Commons API ${response.status}`)
    await sleep(8000 * (attempt + 1))
  }
  throw new Error('Commons API kept answering 429')
}

function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** A random slice of the category — by categorization date or by sort key. */
function randomWindow() {
  if (Math.random() < 0.45) {
    const year = 2013 + Math.floor(Math.random() * (new Date().getUTCFullYear() - 2012))
    const month = 1 + Math.floor(Math.random() * 12)
    const day = 1 + Math.floor(Math.random() * 28)
    return {
      gcmsort: 'timestamp',
      gcmdir: 'newer',
      gcmstart: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`,
    }
  }
  const prefix =
    Math.random() < 0.6
      ? 'Mapillary (' + MAPILLARY_CHARS[Math.floor(Math.random() * MAPILLARY_CHARS.length)]
      : PLAIN_CHARS[Math.floor(Math.random() * PLAIN_CHARS.length)]
  return { gcmstartsortkeyprefix: prefix }
}

function stripHtml(value) {
  let text = value ?? ''
  let previous
  do {
    previous = text
    text = text.replace(/<[^<>]*>/g, '')
  } while (text !== previous)
  return text.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim()
}

/** Parse the entries already vendored so re-runs extend instead of replacing. */
function readExisting() {
  if (!existsSync(OUT)) return []
  const source = readFileSync(OUT, 'utf8')
  const start = source.indexOf('[')
  const end = source.lastIndexOf(']')
  if (start < 0 || end < 0) return []
  const body = source
    .slice(start, end + 1)
    .replace(/(\w+):/g, '"$1":')
    .replace(/'/g, '"')
    .replace(/,(\s*[}\]])/g, '$1')
  try {
    return JSON.parse(body)
  } catch {
    return []
  }
}

async function sweep(held) {
  const data = await api({
    generator: 'categorymembers',
    gcmtitle: CATEGORY,
    gcmtype: 'file',
    gcmlimit: '50',
    ...randomWindow(),
    prop: 'imageinfo|coordinates',
    iiprop: 'size|mime|extmetadata',
    iiextmetadatafilter: 'Artist|LicenseShortName',
  })
  const usable = []
  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = page.imageinfo?.[0]
    const coord = page.coordinates?.[0]
    if (!info || !coord || typeof coord.lat !== 'number' || typeof coord.lon !== 'number') continue
    if (info.mime !== 'image/jpeg') continue
    if (!(info.width >= MIN_WIDTH)) continue
    if (Math.abs(info.width / info.height - 2) > ASPECT_TOLERANCE) continue
    usable.push({ title: page.title, lat: coord.lat, lng: coord.lon })
  }
  // At most two per sweep: one batch is usually a single camera drive.
  const taken = []
  for (const candidate of usable.sort(() => Math.random() - 0.5)) {
    if (taken.length >= 2) break
    if ([...held, ...taken].some((p) => haversineKm(p, candidate) < MIN_SEPARATION_KM)) continue
    taken.push(candidate)
  }
  return taken
}

async function resolveThumbnails(candidates) {
  const resolved = []
  for (let i = 0; i < candidates.length; i += 8) {
    const slice = candidates.slice(i, i + 8)
    let data
    try {
      data = await api({
        titles: slice.map((c) => c.title).join('|'),
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        iiurlwidth: String(THUMB_WIDTH),
        iiextmetadatafilter: 'Artist|LicenseShortName',
      })
    } catch (error) {
      console.error(`  thumbnail batch failed: ${error.message}`)
      continue
    }
    for (const page of Object.values(data.query?.pages ?? {})) {
      const info = page.imageinfo?.[0]
      const source = slice.find((c) => c.title === page.title)
      if (!info?.thumburl || !source) continue
      const md = info.extmetadata ?? {}
      resolved.push({
        lat: Math.round(source.lat * 1e6) / 1e6,
        lng: Math.round(source.lng * 1e6) / 1e6,
        url: info.thumburl,
        page:
          'https://commons.wikimedia.org/wiki/' +
          encodeURIComponent(source.title.replace(/ /g, '_')).replace(/%3A/g, ':'),
        author: stripHtml(md.Artist?.value).split('\n')[0].slice(0, 60) || 'Unknown',
        license: stripHtml(md.LicenseShortName?.value) || 'See file page',
      })
    }
  }
  return resolved
}

export function emit(entries) {
  const rows = entries
    .map(
      (entry) =>
        `  {\n` +
        `    lat: ${entry.lat},\n` +
        `    lng: ${entry.lng},\n` +
        `    url: '${entry.url.replace(/'/g, "\\'")}',\n` +
        `    page: '${entry.page.replace(/'/g, "\\'")}',\n` +
        `    author: '${entry.author.replace(/'/g, "\\'")}',\n` +
        `    license: '${entry.license.replace(/'/g, "\\'")}',\n` +
        `  },`
    )
    .join('\n')
  return `// Offline reserve deck for Random World — generated by
// scripts/generate-random-world-reserve.mjs. Do not hand-edit.
//
// Freely licensed, geotagged 2:1 photospheres from Wikimedia Commons'
// "Category:360° panoramas", used when the Commons API is unreachable or
// rate-limited at play time so the mode always has somewhere to drop you.
// Attribution travels with each entry and is shown on the panorama.

export interface ReservePanorama {
  lat: number
  lng: number
  url: string
  page: string
  author: string
  license: string
}

export const RESERVE_PANORAMAS: ReservePanorama[] = [
${rows}
]
`
}

async function main() {
  const existing = readExisting()
  console.error(`starting from ${existing.length} entries, target ${TARGET}`)
  const held = existing.map((entry) => ({ lat: entry.lat, lng: entry.lng }))
  const found = []

  for (let attempt = 0; attempt < 40 && existing.length + found.length < TARGET; attempt++) {
    let taken
    try {
      taken = await sweep([...held, ...found])
    } catch (error) {
      console.error(`  sweep failed: ${error.message}`)
      continue
    }
    for (const candidate of taken) {
      found.push(candidate)
      console.error(`  +${existing.length + found.length}: ${candidate.title}`)
    }
  }

  console.error(`resolving ${found.length} thumbnails…`)
  const merged = [...existing, ...(await resolveThumbnails(found))]
  // Final safety pass: the reserve must stay spread out even across runs.
  const deck = []
  for (const entry of merged) {
    if (deck.some((kept) => haversineKm(kept, entry) < MIN_SEPARATION_KM)) continue
    deck.push(entry)
  }
  writeFileSync(OUT, emit(deck))
  console.error(`wrote ${deck.length} entries to ${OUT}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
