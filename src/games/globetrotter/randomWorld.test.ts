import {
  buildRandomWorldDeck,
  fetchRandomWorldDeck,
  PANO_SOURCES,
  reserveDeck,
  shareOut,
  toGeoLocation,
} from './randomWorld'
import { RESERVE_PANORAMAS } from './randomWorldReserve'
import { countryAt } from './countries'
import { haversineKm } from './logic'
import { MIN_SEPARATION_KM } from './sources/spread'
import type { PanoFind, PanoSource, PanoSourceDeps } from './sources/types'

const fixedRandom = () => 0.5

/**
 * Every stub find gets its own corner of the planet, degrees from the last, so
 * the separation rule never quietly swallows one and hides a bug in the merge.
 */
let spotSeq = 0
function nextSpot(): { lat: number; lng: number } {
  const i = spotSeq++
  return { lat: -55 + ((i * 9) % 110), lng: -175 + ((i * 53) % 350) }
}

beforeEach(() => {
  spotSeq = 0
})

/**
 * A source that hands back up to `available` finds across all the times it is
 * asked. `fail` makes it throw the way an unreachable archive would.
 */
function stubSource(
  id: string,
  options: { available?: number; weight?: number; fail?: boolean; delayMs?: number } = {}
): PanoSource & { asked: number[] } {
  let remaining = options.available ?? 10
  const asked: number[] = []
  return {
    id,
    label: id,
    weight: options.weight ?? 1,
    asked,
    async collect(count: number, deps: PanoSourceDeps): Promise<PanoFind[]> {
      asked.push(count)
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs))
      if (options.fail) throw new Error(`${id} is down`)
      const finds: PanoFind[] = []
      while (finds.length < count && remaining > 0) {
        remaining -= 1
        const spot = nextSpot()
        finds.push({
          ...spot,
          pano: {
            url: `https://example.test/${id}/${spotSeq}.jpg`,
            page: `https://example.test/${id}/${spotSeq}`,
            author: `${id} photographer`,
            license: 'CC BY-SA 4.0',
            source: id,
          },
        })
        deps.onFind?.()
      }
      return finds
    },
  }
}

describe('PANO_SOURCES', () => {
  it('ships Commons and Panoramax, both weighted', () => {
    expect(PANO_SOURCES.map((source) => source.id)).toEqual(['commons', 'panoramax'])
    for (const source of PANO_SOURCES) {
      expect(source.weight).toBeGreaterThan(0)
      expect(source.label.length).toBeGreaterThan(0)
    }
  })
})

describe('shareOut', () => {
  it('splits a deck by weight and spends every round', () => {
    const sources = [stubSource('a', { weight: 3 }), stubSource('b', { weight: 2 })]
    expect(shareOut(5, sources)).toEqual([3, 2])
    expect(shareOut(10, sources)).toEqual([6, 4])
    for (const count of [4, 7, 9, 11]) {
      const shares = shareOut(count, sources)
      expect(shares.reduce((sum, share) => sum + share, 0)).toBe(count)
    }
  })

  it('gives every source a round, so a deck is never one archive by default', () => {
    const sources = [stubSource('a', { weight: 9 }), stubSource('b', { weight: 1 })]
    expect(shareOut(5, sources).every((share) => share >= 1)).toBe(true)
    // Fewer rounds than sources: everyone still gets asked, and the merge
    // trims the deck back to size.
    expect(shareOut(1, sources)).toEqual([1, 1])
  })
})

describe('fetchRandomWorldDeck', () => {
  it('mixes the archives and keeps rounds apart', async () => {
    const sources = [stubSource('alpha', { weight: 3 }), stubSource('beta', { weight: 2 })]
    const deck = await fetchRandomWorldDeck(5, { sources, random: fixedRandom })

    expect(deck).toHaveLength(5)
    expect(new Set(deck.map((spot) => spot.pano!.source))).toEqual(new Set(['alpha', 'beta']))
    for (const spot of deck) {
      expect(spot.clues).toEqual([])
      expect(spot.emoji).toBe('🌐')
      expect(spot.country).toMatch(/°[NS], .*°[EW]$/)
    }
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        expect(haversineKm(deck[i], deck[j])).toBeGreaterThanOrEqual(MIN_SEPARATION_KM)
      }
    }
  })

  it('lets one archive cover what another could not find', async () => {
    const thin = stubSource('thin', { weight: 3, available: 1 })
    const deep = stubSource('deep', { weight: 2 })
    const deck = await fetchRandomWorldDeck(5, { sources: [thin, deep], random: fixedRandom })

    expect(deck).toHaveLength(5)
    // The second pass asks the source that actually yielded, not the thin one.
    expect(deep.asked).toEqual([2, 2])
    expect(thin.asked).toEqual([3])
  })

  it('keeps going when an archive is unreachable', async () => {
    const down = stubSource('down', { weight: 3, fail: true })
    const up = stubSource('up', { weight: 2 })
    const deck = await fetchRandomWorldDeck(5, { sources: [down, up], random: fixedRandom })

    expect(deck).toHaveLength(5)
    expect(deck.every((spot) => spot.pano!.source === 'up')).toBe(true)
  })

  it('throws when every archive comes up short', async () => {
    const sources = [stubSource('a', { fail: true }), stubSource('b', { fail: true })]
    await expect(fetchRandomWorldDeck(3, { sources, random: fixedRandom })).rejects.toThrow(
      /Only found 0 of 3/
    )
  })

  it('reports progress once, monotonically, however many archives answer', async () => {
    const sources = [stubSource('a', { weight: 1 }), stubSource('b', { weight: 1 })]
    const seen: number[] = []
    await fetchRandomWorldDeck(4, {
      sources,
      random: fixedRandom,
      onProgress: (found, total) => {
        expect(total).toBe(4)
        seen.push(found)
      },
    })
    expect(seen).toEqual([1, 2, 3, 4])
  })

  // The bug this guards: sources were handed the browser's own `fetch`
  // unbound. A source that called it as `deps.fetchFn(…)` passed its deps
  // object as the receiver, which `fetch` rejects with "Illegal invocation" —
  // and since a failed sweep is swallowed on purpose, the archive simply went
  // quiet and every deck came from the offline reserve.
  it('hands sources a fetch they can call as a method', async () => {
    const receivers: unknown[] = []
    const original = globalThis.fetch
    globalThis.fetch = function (this: unknown) {
      receivers.push(this)
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response)
    } as typeof fetch
    const caller: PanoSource = {
      id: 'caller',
      label: 'caller',
      weight: 1,
      async collect(_count, sourceDeps) {
        await sourceDeps.fetchFn('https://example.test/search')
        return []
      },
    }
    try {
      await buildRandomWorldDeck(1, { sources: [caller], random: fixedRandom })
    } finally {
      globalThis.fetch = original
    }
    expect(receivers).toEqual([globalThis])
  })

  it('queries the archives at the same time rather than one after another', async () => {
    const sources = [
      stubSource('a', { weight: 1, delayMs: 60 }),
      stubSource('b', { weight: 1, delayMs: 60 }),
    ]
    const started = Date.now()
    await fetchRandomWorldDeck(2, { sources, random: fixedRandom })
    expect(Date.now() - started).toBeLessThan(120)
  })
})

describe('toGeoLocation', () => {
  it('names the country the geotag lands in, and falls back to open water', () => {
    const pano = {
      url: 'u',
      page: 'p',
      author: 'a',
      license: 'l',
      source: 'Panoramax',
    }
    expect(toGeoLocation({ lat: 48.85, lng: 2.35, pano }).name).toBe('France')
    expect(toGeoLocation({ lat: 0, lng: -30, pano }).name).toBe('Uncharted territory')
    expect(toGeoLocation({ lat: 48.85, lng: 2.35, pano }).country).toBe('48.85°N, 2.35°E')
    expect(toGeoLocation({ lat: -33.87, lng: -70.6, pano }).country).toBe('33.87°S, 70.60°W')
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
      expect(spot.pano?.source).toBe('Wikimedia Commons')
      expect(spot.clues).toEqual([])
    }
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        expect(haversineKm(deck[i], deck[j])).toBeGreaterThanOrEqual(MIN_SEPARATION_KM)
      }
    }
  })
})

describe('buildRandomWorldDeck', () => {
  it('uses live results when the archives are generous', async () => {
    const sources = [stubSource('a', { weight: 3 }), stubSource('b', { weight: 2 })]
    const { deck, source } = await buildRandomWorldDeck(5, { sources, random: fixedRandom })

    expect(source).toBe('live')
    expect(deck).toHaveLength(5)
  })

  it('falls back to the reserve when every archive is unreachable', async () => {
    const sources = [stubSource('a', { fail: true }), stubSource('b', { fail: true })]
    const { deck, source } = await buildRandomWorldDeck(5, { sources, random: fixedRandom })

    expect(source).toBe('reserve')
    expect(deck).toHaveLength(5)
  })

  it('tops a short live deck up from the reserve', async () => {
    const sources = [
      stubSource('a', { weight: 3, available: 1 }),
      stubSource('b', { weight: 2, available: 0 }),
    ]
    const { deck, source } = await buildRandomWorldDeck(5, { sources, random: fixedRandom })

    expect(source).toBe('mixed')
    expect(deck).toHaveLength(5)
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        expect(haversineKm(deck[i], deck[j])).toBeGreaterThanOrEqual(MIN_SEPARATION_KM)
      }
    }
  })

  it('defaults to the shipped archives when no sources are injected', async () => {
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
