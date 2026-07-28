import { buildRandomWorldDeck, fetchRandomWorldDeck, reserveDeck } from './randomWorld'
import { RESERVE_PANORAMAS } from './randomWorldReserve'
import { countryAt } from './countries'
import { haversineKm } from './logic'

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

describe('fetchRandomWorldDeck', () => {
  it('assembles a deck of distinct, playable panorama locations', async () => {
    const { fetchFn } = makeFetchDouble()
    const deck = await fetchRandomWorldDeck(3, { fetchFn, random: fixedRandom })

    expect(deck).toHaveLength(3)
    for (const location of deck) {
      expect(location.pano?.url).toContain('upload.wikimedia.org')
      expect(location.pano?.author).toBe('Jane Mapper')
      expect(location.pano?.license).toBe('CC BY-SA 4.0')
      expect(location.pano?.page).toContain('commons.wikimedia.org/wiki/File:')
      expect(location.clues).toEqual([])
      expect(location.emoji).toBe('🌐')
      expect(location.country).toMatch(/°[NS], .*°[EW]$/)
    }
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        expect(haversineKm(deck[i], deck[j])).toBeGreaterThanOrEqual(50)
      }
    }
  })

  it('stays frugal: a full deck costs a sweep per few rounds plus one render', async () => {
    const { fetchFn, calls } = makeFetchDouble({ perBatch: 5 })
    await fetchRandomWorldDeck(5, { fetchFn, random: fixedRandom })

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
    await fetchRandomWorldDeck(5, { fetchFn, random: fixedRandom })

    for (const sweep of calls.filter((url) => url.includes('generator=categorymembers'))) {
      expect(sweep).toContain('gcmlimit=500')
      expect(sweep).toContain('colimit=max')
    }
  })

  it('draws a deck from several windows instead of one photographer’s series', async () => {
    // One window offers far more than a deck needs; a single sweep could fill
    // it, and every round would come from the same contiguous run of uploads.
    const { fetchFn, calls } = makeFetchDouble({ perBatch: 20 })
    const deck = await fetchRandomWorldDeck(5, { fetchFn, random: seededRandom(181) })

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
      deck.map((spot) => decodeURIComponent(spot.pano!.url).match(/Pano (\d+)-/)![1])
    )
    expect(sweeps.size).toBeGreaterThan(1)
    for (const sweep of sweeps) {
      const fromSweep = deck.filter((spot) =>
        decodeURIComponent(spot.pano!.url).includes(`Pano ${sweep}-`)
      )
      expect(fromSweep.length).toBeLessThanOrEqual(3)
    }
  })

  it('finishes a deck with finds held back by an earlier sweep when the next one fails', async () => {
    // Sweep 1 is rich but capped; sweep 2 is rate-limited. The finds turned
    // away by the cap complete the deck immediately rather than letting it fall
    // short or waiting for more failed sweeps.
    const { fetchFn, calls } = makeFetchDouble({ perBatch: 20, failStatus: 429, failAfterBatch: 1 })
    const deck = await fetchRandomWorldDeck(5, { fetchFn, random: fixedRandom })

    expect(deck).toHaveLength(5)
    expect(calls.filter((url) => url.includes('generator=categorymembers'))).toHaveLength(2)
    const contributingWindows = new Set(
      deck.map((spot) => decodeURIComponent(spot.pano!.url).match(/Pano (\d+)-/)![1])
    )
    expect(contributingWindows.size).toBe(1)
  })

  it('reports progress as the deck fills up', async () => {
    const { fetchFn } = makeFetchDouble({ perBatch: 3 })
    const seen: number[] = []
    await fetchRandomWorldDeck(3, {
      fetchFn,
      random: fixedRandom,
      onProgress: (found) => seen.push(found),
    })
    expect(seen).toEqual([1, 2, 3])
  })

  it('names locations by country when the geotag lands inside one', async () => {
    const { fetchFn } = makeFetchDouble({ perBatch: 1 })
    const parisFetch = (async (input: RequestInfo | URL) => {
      const response = await fetchFn(input)
      const body = (await response.json()) as {
        query?: { pages?: Record<string, { coordinates?: unknown }> }
      }
      const page = body.query?.pages?.['0']
      if (page && 'coordinates' in page) page.coordinates = [{ lat: 48.85, lon: 2.35 }]
      return { ok: true, status: 200, json: async () => body } as Response
    }) as typeof fetch
    const deck = await fetchRandomWorldDeck(1, { fetchFn: parisFetch, random: fixedRandom })
    expect(deck[0].name).toBe('France')
  })

  it('removes nested or malformed markup from Commons attribution', async () => {
    const { fetchFn } = makeFetchDouble({ artist: '<scr<script>ipt>Jane <b>Mapper</b>' })
    const deck = await fetchRandomWorldDeck(1, { fetchFn, random: fixedRandom })

    expect(deck[0].pano?.author).toBe('Jane Mapper')
    expect(deck[0].pano?.author).not.toContain('<')
    expect(deck[0].pano?.author).not.toContain('>')
  })

  it('rejects files without coordinates and gives up with an error', async () => {
    const { fetchFn } = makeFetchDouble({ dropCoordinates: true })
    await expect(fetchRandomWorldDeck(2, { fetchFn, random: fixedRandom })).rejects.toThrow(
      /Only found 0 of 2/
    )
  })

  it('rejects non-equirectangular files', async () => {
    const { fetchFn } = makeFetchDouble({ ratio: 1.5 })
    await expect(fetchRandomWorldDeck(1, { fetchFn, random: fixedRandom })).rejects.toThrow()
  })

  it('survives rate-limited sweeps instead of throwing mid-flight', async () => {
    const { fetchFn } = makeFetchDouble({ failStatus: 429 })
    await expect(fetchRandomWorldDeck(1, { fetchFn, random: fixedRandom })).rejects.toThrow(
      /Only found 0 of 1/
    )
  })

  it('propagates a failed thumbnail request', async () => {
    const { fetchFn } = makeFetchDouble({ failThumbnails: true })
    await expect(fetchRandomWorldDeck(1, { fetchFn, random: fixedRandom })).rejects.toThrow(
      /Commons API 500/
    )
  })
})

describe('reserveDeck', () => {
  it('is vendored, spread out, and playable', () => {
    expect(RESERVE_PANORAMAS.length).toBeGreaterThanOrEqual(20)
    const deck = reserveDeck(5, fixedRandom)
    expect(deck).toHaveLength(5)
    for (const spot of deck) {
      expect(spot.pano?.url).toMatch(/^https:\/\/upload\.wikimedia\.org\//)
      expect(spot.pano?.license).not.toBe('')
      expect(spot.clues).toEqual([])
    }
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        expect(haversineKm(deck[i], deck[j])).toBeGreaterThanOrEqual(50)
      }
    }
  })
})

describe('buildRandomWorldDeck', () => {
  it('uses live Commons results when they are plentiful', async () => {
    const { fetchFn } = makeFetchDouble({ perBatch: 5 })
    const { deck, source } = await buildRandomWorldDeck(5, { fetchFn, random: fixedRandom })

    expect(source).toBe('live')
    expect(deck).toHaveLength(5)
    expect(deck.every((spot) => spot.pano?.url.includes('/thumb/'))).toBe(true)
  })

  it('falls back to the reserve when Commons is unreachable', async () => {
    const failingFetch = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    const { deck, source } = await buildRandomWorldDeck(5, {
      fetchFn: failingFetch,
      random: fixedRandom,
    })

    expect(source).toBe('reserve')
    expect(deck).toHaveLength(5)
  })

  it('falls back to the reserve when Commons keeps answering 429', async () => {
    const { fetchFn } = makeFetchDouble({ failStatus: 429 })
    const { deck, source } = await buildRandomWorldDeck(5, { fetchFn, random: fixedRandom })

    expect(source).toBe('reserve')
    expect(deck).toHaveLength(5)
  })

  it('tops a short live deck up from the reserve', async () => {
    const { fetchFn } = makeFetchDouble({ perBatch: 1 })
    const { deck, source } = await buildRandomWorldDeck(5, { fetchFn, random: fixedRandom })

    expect(source).toBe('mixed')
    expect(deck).toHaveLength(5)
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        expect(haversineKm(deck[i], deck[j])).toBeGreaterThanOrEqual(50)
      }
    }
  })
})

describe('countryAt', () => {
  it('resolves famous points to their countries', () => {
    expect(countryAt(48.85, 2.35)).toBe('France')
    expect(countryAt(40.75, -74)).toBe('United States of America')
    expect(countryAt(-25.35, 131.03)).toBe('Australia')
    expect(countryAt(35.68, 139.69)).toBe('Japan')
  })

  it('returns null for open ocean', () => {
    expect(countryAt(0, -30)).toBeNull()
    expect(countryAt(-50, -120)).toBeNull()
  })
})
