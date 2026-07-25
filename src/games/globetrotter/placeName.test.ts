import { clearPlaceNameCache, reverseGeocode } from './placeName'

function respondWith(body: unknown, ok = true) {
  const calls: string[] = []
  const fetchFn = (async (input: RequestInfo | URL) => {
    calls.push(String(input))
    return { ok, status: ok ? 200 : 503, json: async () => body } as Response
  }) as typeof fetch
  return { fetchFn, calls }
}

beforeEach(() => clearPlaceNameCache())

describe('reverseGeocode', () => {
  it('asks Nominatim for the town at a coordinate', async () => {
    const { fetchFn, calls } = respondWith({
      address: { village: 'Ternberg', county: 'Bezirk Steyr-Land', country: 'Austria' },
    })

    expect(await reverseGeocode(47.921, 14.341, { fetchFn })).toEqual({
      place: 'Ternberg',
      country: 'Austria',
    })
    expect(calls[0]).toContain('nominatim.openstreetmap.org/reverse')
    expect(calls[0]).toContain('lat=47.921')
    expect(calls[0]).toContain('lon=14.341')
    expect(calls[0]).toContain('accept-language=en')
  })

  it('prefers the most specific settlement it is given', async () => {
    const { fetchFn } = respondWith({
      address: {
        city: 'Munich',
        suburb: 'Old Town',
        state: 'Bavaria',
        country: 'Germany',
      },
    })
    expect((await reverseGeocode(48.137, 11.576, { fetchFn }))?.place).toBe('Munich')
  })

  it('falls back through the hierarchy when no settlement is named', async () => {
    const { fetchFn } = respondWith({
      address: { county: 'Solukhumbu', state: 'Koshi Province', country: 'Nepal' },
    })
    expect(await reverseGeocode(28.01, 86.86, { fetchFn })).toEqual({
      place: 'Solukhumbu',
      country: 'Nepal',
    })
  })

  it('reports a country with no settlement (ice sheets, open country)', async () => {
    const { fetchFn } = respondWith({ address: { country: 'Greenland' } })
    expect(await reverseGeocode(74.5, -20.58, { fetchFn })).toEqual({
      place: null,
      country: 'Greenland',
    })
  })

  it('returns null for an empty, failed, or unparseable answer', async () => {
    expect(await reverseGeocode(1, 1, { fetchFn: respondWith({}).fetchFn })).toBeNull()
    clearPlaceNameCache()
    expect(await reverseGeocode(1, 1, { fetchFn: respondWith({ address: {} }).fetchFn })).toBeNull()
    clearPlaceNameCache()
    expect(
      await reverseGeocode(1, 1, { fetchFn: respondWith({ address: { city: '  ' } }).fetchFn })
    ).toBeNull()
    clearPlaceNameCache()
    expect(await reverseGeocode(1, 1, { fetchFn: respondWith({}, false).fetchFn })).toBeNull()
  })

  it('never throws when the geocoder is unreachable', async () => {
    const failing = (async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    expect(await reverseGeocode(1, 1, { fetchFn: failing })).toBeNull()
  })

  it('memoizes per coordinate, including concurrent lookups', async () => {
    const { fetchFn, calls } = respondWith({ address: { town: 'Bexhill', country: 'UK' } })

    const [a, b] = await Promise.all([
      reverseGeocode(50.8417, 0.4953, { fetchFn }),
      reverseGeocode(50.8417, 0.4953, { fetchFn }),
    ])
    const c = await reverseGeocode(50.8417, 0.4953, { fetchFn })

    expect(calls).toHaveLength(1)
    expect(a).toEqual(b)
    expect(c).toEqual(a)
  })
})
