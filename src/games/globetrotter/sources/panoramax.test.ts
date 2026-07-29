import { panoramaxSource } from './panoramax'
import { MIN_SEPARATION_KM } from './spread'
import type { PanoSourceDeps } from './types'
import { haversineKm } from '../logic'
import { PANORAMAX_CELL_DEGREES, PANORAMAX_COVERAGE } from '../panoramaxCoverage'

interface FeatureOptions {
  id?: string
  lat?: number
  lng?: number
  /** Host serving the picture — anything off the CSP allowlist is unplayable. */
  host?: string
  fieldOfView?: number
  dimensions?: [number, number]
  license?: string
  producer?: string
}

/** One STAC item, shaped like Panoramax's `/api/search` response. */
function feature(options: FeatureOptions = {}) {
  const id = options.id ?? 'aaaaaaaa-1111-2222-3333-444444444444'
  const host = options.host ?? 'https://panoramax.openstreetmap.fr'
  return {
    id,
    geometry: { type: 'Point', coordinates: [options.lng ?? 2.35, options.lat ?? 48.85] },
    assets: {
      hd: { href: `${host}/images/${id}.jpg`, type: 'image/jpeg' },
      sd: { href: `${host}/derivates/${id}/sd.jpg`, type: 'image/jpeg' },
      thumb: { href: `${host}/derivates/${id}/thumb.jpg`, type: 'image/jpeg' },
    },
    providers: [{ name: options.producer ?? 'zorglubu', roles: ['producer'] }],
    properties: {
      license: options.license ?? 'CC-BY-SA-4.0',
      'geovisio:producer': options.producer ?? 'zorglubu',
      'pers:interior_orientation': {
        field_of_view: options.fieldOfView ?? 360,
        sensor_array_dimensions: options.dimensions ?? [5760, 2880],
      },
    },
  }
}

interface Sweep {
  url: URL
  bbox: number[]
  /** True when the search covered a whole coverage cell rather than a window. */
  whole: boolean
}

/**
 * Panoramax double. `reply` decides what each sweep returns, so a test can make
 * a window come back empty, a host unplayable, or the API fall over.
 */
function makeFetchDouble(reply: (sweep: Sweep, index: number) => unknown) {
  const sweeps: Sweep[] = []
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    const bbox = (url.searchParams.get('bbox') ?? '').split(',').map(Number)
    const sweep = {
      url,
      bbox,
      whole: Math.abs(bbox[2] - bbox[0] - PANORAMAX_CELL_DEGREES) < 0.001,
    }
    sweeps.push(sweep)
    const body = reply(sweep, sweeps.length - 1)
    if (body instanceof Error) throw body
    return { ok: true, status: 200, json: async () => body } as Response
  }) as typeof fetch
  return { fetchFn, sweeps }
}

const fixedRandom = () => 0.5

function deps(fetchFn: typeof fetch, extra: Partial<PanoSourceDeps> = {}): PanoSourceDeps {
  return { fetchFn, random: fixedRandom, ...extra }
}

describe('panoramaxSource', () => {
  it('turns a search result into an attributed, playable find', async () => {
    const { fetchFn } = makeFetchDouble(() => ({ features: [feature({ id: 'pic-1' })] }))
    const finds = await panoramaxSource.collect(1, deps(fetchFn))

    expect(finds).toHaveLength(1)
    expect(finds[0]).toMatchObject({ lat: 48.85, lng: 2.35 })
    // The fixed 2048px derivative, not the contributor's multi-megabyte original.
    expect(finds[0].pano.url).toBe('https://panoramax.openstreetmap.fr/derivates/pic-1/sd.jpg')
    expect(finds[0].pano.page).toBe('https://api.panoramax.xyz/#focus=pic&pic=pic-1')
    expect(finds[0].pano.author).toBe('zorglubu')
    expect(finds[0].pano.license).toBe('CC-BY-SA-4.0')
    expect(finds[0].pano.source).toBe('Panoramax')
  })

  it('asks only for spherical pictures, in a window inside a known cell', async () => {
    const { fetchFn, sweeps } = makeFetchDouble(() => ({ features: [feature()] }))
    await panoramaxSource.collect(1, deps(fetchFn))

    expect(sweeps).toHaveLength(1)
    expect(sweeps[0].url.searchParams.get('filter')).toBe('field_of_view = 360')
    expect(Number(sweeps[0].url.searchParams.get('limit'))).toBeGreaterThan(1)
    const [west, south] = sweeps[0].bbox
    const cell = PANORAMAX_COVERAGE.find(
      ([cw, cs]) =>
        west >= cw - 0.001 &&
        south >= cs - 0.001 &&
        west <= cw + PANORAMAX_CELL_DEGREES &&
        south <= cs + PANORAMAX_CELL_DEGREES
    )
    expect(cell).toBeDefined()
  })

  it('drops pictures served from instances the policy would block', async () => {
    // A federated catalog hands out whatever host holds the pixels; an origin
    // missing from the CSP allowlist is a round that can never render.
    const { fetchFn } = makeFetchDouble(() => ({
      features: [feature({ host: 'https://panoramax.example.invalid' })],
    }))
    await expect(panoramaxSource.collect(1, deps(fetchFn))).resolves.toEqual([])
  })

  it('drops flat pictures and anything that is not a 2:1 photosphere', async () => {
    const { fetchFn } = makeFetchDouble(() => ({
      features: [
        feature({ id: 'flat', fieldOfView: 120 }),
        feature({ id: 'cropped', dimensions: [4000, 3000] }),
      ],
    }))
    await expect(panoramaxSource.collect(2, deps(fetchFn))).resolves.toEqual([])
  })

  it('takes at most two rounds from one cell, kilometres apart', async () => {
    const { fetchFn } = makeFetchDouble(() => ({
      features: [
        // Three pictures in one window: two neighbours and one town over.
        feature({ id: 'a', lat: 48.85, lng: 2.35 }),
        feature({ id: 'b', lat: 48.851, lng: 2.351 }),
        feature({ id: 'c', lat: 49.9, lng: 3.5 }),
        feature({ id: 'd', lat: 51.5, lng: 5.9 }),
      ],
    }))
    const finds = await panoramaxSource.collect(4, deps(fetchFn))

    const fromFirstSweep = finds.slice(0, 2)
    expect(fromFirstSweep).toHaveLength(2)
    expect(haversineKm(fromFirstSweep[0], fromFirstSweep[1])).toBeGreaterThanOrEqual(
      MIN_SEPARATION_KM
    )
  })

  it('sweeps a cell whole when its random window comes back empty', async () => {
    const { fetchFn, sweeps } = makeFetchDouble((sweep) =>
      sweep.whole ? { features: [feature()] } : { features: [] }
    )
    const finds = await panoramaxSource.collect(1, deps(fetchFn))

    expect(finds).toHaveLength(1)
    expect(sweeps).toHaveLength(2)
    expect(sweeps[0].whole).toBe(false)
    expect(sweeps[1].whole).toBe(true)
    // The retry is the same cell, not a new one.
    expect(sweeps[1].bbox[0]).toBeLessThanOrEqual(sweeps[0].bbox[0])
  })

  it('spends a bounded number of requests when nothing is out there', async () => {
    const { fetchFn, sweeps } = makeFetchDouble(() => ({ features: [] }))
    const finds = await panoramaxSource.collect(5, deps(fetchFn))

    expect(finds).toEqual([])
    expect(sweeps.length).toBeGreaterThan(1)
    expect(sweeps.length).toBeLessThanOrEqual(6)
  })

  it('moves to another cell when a sweep fails instead of giving up', async () => {
    const { fetchFn, sweeps } = makeFetchDouble((_sweep, index) =>
      index === 0 ? new Error('network down') : { features: [feature()] }
    )
    const finds = await panoramaxSource.collect(1, deps(fetchFn))

    expect(finds).toHaveLength(1)
    expect(sweeps).toHaveLength(2)
    // A failed sweep is not an empty one: it does not earn the cell a retry.
    expect(sweeps[1].whole).toBe(false)
  })

  it('reports every find as it is picked', async () => {
    const { fetchFn } = makeFetchDouble(() => ({
      features: [
        feature({ id: 'a', lat: 48.85, lng: 2.35 }),
        feature({ id: 'c', lat: 49.9, lng: 3.5 }),
      ],
    }))
    let found = 0
    await panoramaxSource.collect(2, deps(fetchFn, { onFind: () => (found += 1) }))
    expect(found).toBe(2)
  })

  it('stops sweeping once the caller aborts', async () => {
    const controller = new AbortController()
    const { fetchFn, sweeps } = makeFetchDouble(() => ({ features: [feature()] }))
    controller.abort()
    const finds = await panoramaxSource.collect(3, deps(fetchFn, { signal: controller.signal }))

    expect(finds).toEqual([])
    expect(sweeps).toEqual([])
  })
})

describe('PANORAMAX_COVERAGE', () => {
  it('is a worldwide grid, not a single region', () => {
    expect(PANORAMAX_COVERAGE.length).toBeGreaterThan(30)
    const lons = PANORAMAX_COVERAGE.map(([lon]) => lon)
    const lats = PANORAMAX_COVERAGE.map(([, lat]) => lat)
    expect(Math.min(...lons)).toBeLessThan(-60)
    expect(Math.max(...lons)).toBeGreaterThan(60)
    expect(Math.min(...lats)).toBeLessThan(0)
    expect(Math.max(...lats)).toBeGreaterThan(40)
    for (const [lon, lat] of PANORAMAX_COVERAGE) {
      expect(lon).toBeGreaterThanOrEqual(-180)
      expect(lon + PANORAMAX_CELL_DEGREES).toBeLessThanOrEqual(180)
      expect(lat).toBeGreaterThanOrEqual(-90)
      expect(lat + PANORAMAX_CELL_DEGREES).toBeLessThanOrEqual(90)
    }
  })
})
