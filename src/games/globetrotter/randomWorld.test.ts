import { fetchRandomWorldDeck } from './randomWorld'
import { countryAt } from './countries'
import { haversineKm } from './logic'

// Minimal Commons API double: categorymembers then imageinfo|coordinates.
// Each categorymembers call serves a fresh batch with its own coordinates so
// the minimum-separation rule can be satisfied.
function makeFetchDouble(options?: { dropCoordinates?: boolean; ratio?: number; artist?: string }) {
  let batch = 0
  const calls: string[] = []
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    let body: unknown
    if (url.includes('list=categorymembers')) {
      batch++
      body = {
        query: {
          categorymembers: [
            { title: `File:Pano ${batch} a.jpg` },
            { title: `File:Pano ${batch} b.jpg` },
          ],
        },
      }
    } else {
      const lat = 10 + batch * 2
      const lng = 20 + batch * 2
      const height = 2000
      const width = Math.round(height * (options?.ratio ?? 2))
      body = {
        query: {
          pages: {
            '1': {
              title: `File:Pano ${batch} a.jpg`,
              imageinfo: [
                {
                  width,
                  height,
                  mime: 'image/jpeg',
                  thumburl: `https://upload.wikimedia.org/thumb/pano-${batch}.jpg`,
                  extmetadata: {
                    Artist: { value: options?.artist ?? '<a href="#">Jane Mapper</a>' },
                    LicenseShortName: { value: 'CC BY-SA 4.0' },
                  },
                },
              ],
              coordinates: options?.dropCoordinates ? undefined : [{ lat, lon: lng }],
            },
          },
        },
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response
  }) as typeof fetch
  return { fetchFn, calls }
}

const fixedRandom = () => 0.5

describe('fetchRandomWorldDeck', () => {
  it('assembles a deck of distinct, playable panorama locations', async () => {
    const { fetchFn } = makeFetchDouble()
    const deck = await fetchRandomWorldDeck(3, { fetchFn, random: fixedRandom })

    expect(deck).toHaveLength(3)
    for (const location of deck) {
      expect(location.pano?.url).toContain('upload.wikimedia.org')
      expect(location.pano?.author).toBe('Jane Mapper')
      expect(location.pano?.license).toBe('CC BY-SA 4.0')
      expect(location.pano?.page).toContain('commons.wikimedia.org/wiki/File')
      expect(location.clues).toEqual([])
      expect(location.emoji).toBe('🌐')
      expect(location.country).toMatch(/°[NS], .*°[EW]$/)
    }
    // pairwise separation ≥ 50 km
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        expect(haversineKm(deck[i], deck[j])).toBeGreaterThanOrEqual(50)
      }
    }
  })

  it('names locations by country when the geotag lands inside one', async () => {
    let served = false
    const { fetchFn } = makeFetchDouble()
    const parisFetch = (async (input: RequestInfo | URL) => {
      const response = await fetchFn(input)
      const body = (await response.json()) as {
        query?: { pages?: Record<string, { coordinates?: unknown }> }
      }
      if (body.query?.pages && !served) {
        served = true
        body.query.pages['1'].coordinates = [{ lat: 48.85, lon: 2.35 }]
      }
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

  it('propagates API failures', async () => {
    const failingFetch = (async () => ({ ok: false, status: 429 })) as unknown as typeof fetch
    await expect(fetchRandomWorldDeck(1, { fetchFn: failingFetch })).rejects.toThrow()
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
