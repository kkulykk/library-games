import { commonsSource } from './commons'
import { MIN_SEPARATION_KM } from './spread'
import type { PanoSourceDeps } from './types'
import { haversineKm } from '../logic'

interface DoubleOptions {
  dropCoordinates?: boolean
  ratio?: number
  artist?: string
  /** Usable files served per sweep. */
  perBatch?: number
  /** Fail every sweep with this status (429 = Commons rate limiting). */
  failStatus?: number
  /** Serve this many sweeps normally before `failStatus` starts biting. */
  failAfterBatch?: number
  /** Fail only the thumbnail-resolving request. */
  failThumbnails?: boolean
}

// Commons API double for the two-step pipeline: one cheap `generator=
// categorymembers` sweep listing candidates with coordinates, then one
// `titles=…&iiurlwidth=…` request that renders thumbnails for the keepers.
function makeFetchDouble(options: DoubleOptions = {}) {
  const perBatch = options.perBatch ?? 3
  let batch = 0
  const calls: string[] = []
  const windows = new Map<string, number>()

  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    const isSweep = url.includes('generator=categorymembers')

    if (options.failStatus && isSweep && batch >= (options.failAfterBatch ?? 0)) {
      return { ok: false, status: options.failStatus } as Response
    }
    if (options.failThumbnails && !isSweep) {
      return { ok: false, status: 500 } as Response
    }

    let body: unknown
    if (isSweep) {
      batch++
      const params = new URL(url).searchParams
      const window = params.get('gcmstart') ?? params.get('gcmstartsortkeyprefix') ?? ''
      const windowNumber = windows.get(window) ?? windows.size + 1
      windows.set(window, windowNumber)
      const height = 2000
      const width = Math.round(height * (options.ratio ?? 2))
      const pages: Record<string, unknown> = {}
      for (let i = 0; i < perBatch; i++) {
        // ~5° apart: comfortably past the 50 km minimum separation.
        const lat = 10 + windowNumber * 5 + i * 5
        const lng = 20 + windowNumber * 5 + i * 5
        pages[String(i)] = {
          title: `File:Pano ${windowNumber}-${i}.jpg`,
          imageinfo: [
            {
              width,
              height,
              mime: 'image/jpeg',
              extmetadata: {
                Artist: { value: options.artist ?? '<a href="#">Jane Mapper</a>' },
                LicenseShortName: { value: 'CC BY-SA 4.0' },
              },
            },
          ],
          coordinates: options.dropCoordinates ? undefined : [{ lat, lon: lng }],
        }
      }
      body = { query: { pages } }
    } else {
      // Echo a thumbnail for every requested title.
      const titles = (new URL(url).searchParams.get('titles') ?? '').split('|')
      const pages: Record<string, unknown> = {}
      titles.forEach((title, index) => {
        pages[String(index)] = {
          title,
          imageinfo: [
            {
              thumburl: `https://upload.wikimedia.org/thumb/${encodeURIComponent(title)}.jpg`,
              extmetadata: {
                Artist: { value: options.artist ?? '<a href="#">Jane Mapper</a>' },
                LicenseShortName: { value: 'CC BY-SA 4.0' },
              },
            },
          ],
        }
      })
      body = { query: { pages } }
    }

    return { ok: true, status: 200, json: async () => body } as Response
  }) as typeof fetch

  return { fetchFn, calls }
}

const fixedRandom = () => 0.5

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

function deps(fetchFn: typeof fetch, extra: Partial<PanoSourceDeps> = {}): PanoSourceDeps {
  return { fetchFn, random: fixedRandom, ...extra }
}

describe('commonsSource', () => {
  it('finds distinct, playable, attributed photospheres', async () => {
    const { fetchFn } = makeFetchDouble()
    const finds = await commonsSource.collect(3, deps(fetchFn))

    expect(finds).toHaveLength(3)
    for (const find of finds) {
      expect(find.pano.url).toContain('upload.wikimedia.org')
      expect(find.pano.author).toBe('Jane Mapper')
      expect(find.pano.license).toBe('CC BY-SA 4.0')
      expect(find.pano.page).toContain('commons.wikimedia.org/wiki/File:')
      expect(find.pano.source).toBe('Wikimedia Commons')
    }
    for (let i = 0; i < finds.length; i++) {
      for (let j = i + 1; j < finds.length; j++) {
        expect(haversineKm(finds[i], finds[j])).toBeGreaterThanOrEqual(MIN_SEPARATION_KM)
      }
    }
  })

  it('stays frugal: a full share costs a sweep per few rounds plus one render', async () => {
    const { fetchFn, calls } = makeFetchDouble({ perBatch: 5 })
    await commonsSource.collect(5, deps(fetchFn))

    // Two sweeps (three rounds is the most any one window may contribute) and
    // the single request that renders every thumbnail the deck needs.
    expect(calls).toHaveLength(3)
    expect(calls.filter((url) => url.includes('generator=categorymembers'))).toHaveLength(2)
    expect(calls.filter((url) => url.includes('iiurlwidth='))).toHaveLength(1)
  })

  // The bug this guards: `prop=coordinates` fills in only `colimit` pages per
  // request, defaulting to 10. Every file past the tenth came back geotag-less
  // and was dropped, so sweeps almost never found five usable panoramas and the
  // deck was topped up from the reserve — the same photos every game.
  it('asks Commons for a wide window and geotags every file in it', async () => {
    const { fetchFn, calls } = makeFetchDouble({ perBatch: 5 })
    await commonsSource.collect(5, deps(fetchFn))

    for (const sweep of calls.filter((url) => url.includes('generator=categorymembers'))) {
      expect(sweep).toContain('gcmlimit=500')
      expect(sweep).toContain('colimit=max')
    }
  })

  it('draws from several windows instead of one photographer’s series', async () => {
    // One window offers far more than a deck needs; a single sweep could fill
    // it, and every round would come from the same contiguous run of uploads.
    const { fetchFn, calls } = makeFetchDouble({ perBatch: 20 })
    const finds = await commonsSource.collect(5, deps(fetchFn, { random: seededRandom(181) }))

    const windows = calls
      .filter((url) => url.includes('generator=categorymembers'))
      .map((url) => {
        const params = new URL(url).searchParams
        return params.get('gcmstart') ?? params.get('gcmstartsortkeyprefix')
      })
    expect(new Set(windows).size).toBeGreaterThan(1)

    // The double names files `Pano <sweep>-<index>`, so the sweep each round
    // came from is readable straight off the panorama URL.
    const sweeps = new Set(
      finds.map((find) => decodeURIComponent(find.pano.url).match(/Pano (\d+)-/)![1])
    )
    expect(sweeps.size).toBeGreaterThan(1)
    for (const sweep of sweeps) {
      const fromSweep = finds.filter((find) =>
        decodeURIComponent(find.pano.url).includes(`Pano ${sweep}-`)
      )
      expect(fromSweep.length).toBeLessThanOrEqual(3)
    }
  })

  it('finishes a share with finds held back by an earlier sweep when the next one fails', async () => {
    // Sweep 1 is rich but capped; sweep 2 is rate-limited. The finds turned
    // away by the cap complete the share immediately rather than letting it
    // fall short or waiting for more failed sweeps.
    const { fetchFn, calls } = makeFetchDouble({ perBatch: 20, failStatus: 429, failAfterBatch: 1 })
    const finds = await commonsSource.collect(5, deps(fetchFn))

    expect(finds).toHaveLength(5)
    expect(calls.filter((url) => url.includes('generator=categorymembers'))).toHaveLength(2)
    const contributingWindows = new Set(
      finds.map((find) => decodeURIComponent(find.pano.url).match(/Pano (\d+)-/)![1])
    )
    expect(contributingWindows.size).toBe(1)
  })

  it('reports every find as it is picked', async () => {
    const { fetchFn } = makeFetchDouble({ perBatch: 3 })
    let found = 0
    await commonsSource.collect(3, deps(fetchFn, { onFind: () => (found += 1) }))
    expect(found).toBe(3)
  })

  it('removes nested or malformed markup from Commons attribution', async () => {
    const { fetchFn } = makeFetchDouble({ artist: '<scr<script>ipt>Jane <b>Mapper</b>' })
    const finds = await commonsSource.collect(1, deps(fetchFn))

    expect(finds[0].pano.author).toBe('Jane Mapper')
    expect(finds[0].pano.author).not.toContain('<')
    expect(finds[0].pano.author).not.toContain('>')
  })

  it('rejects files without coordinates', async () => {
    const { fetchFn } = makeFetchDouble({ dropCoordinates: true })
    await expect(commonsSource.collect(2, deps(fetchFn))).resolves.toEqual([])
  })

  it('rejects non-equirectangular files', async () => {
    const { fetchFn } = makeFetchDouble({ ratio: 1.5 })
    await expect(commonsSource.collect(1, deps(fetchFn))).resolves.toEqual([])
  })

  it('survives rate-limited sweeps instead of throwing mid-flight', async () => {
    const { fetchFn } = makeFetchDouble({ failStatus: 429 })
    await expect(commonsSource.collect(1, deps(fetchFn))).resolves.toEqual([])
  })

  it('propagates a failed thumbnail request', async () => {
    const { fetchFn } = makeFetchDouble({ failThumbnails: true })
    await expect(commonsSource.collect(1, deps(fetchFn))).rejects.toThrow(/Commons API 500/)
  })

  it('stops sweeping once the caller aborts', async () => {
    const controller = new AbortController()
    const { fetchFn, calls } = makeFetchDouble({ perBatch: 1 })
    controller.abort()
    const finds = await commonsSource.collect(5, deps(fetchFn, { signal: controller.signal }))

    expect(finds).toEqual([])
    expect(calls).toHaveLength(0)
  })
})
