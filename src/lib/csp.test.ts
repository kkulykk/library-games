import {
  CONNECT_ORIGINS,
  contentSecurityPolicy,
  IMAGE_ORIGINS,
  PANORAMAX_IMAGE_ORIGINS,
} from './csp'

const SUPABASE = 'https://project.supabase.co'

function production(supabaseUrl?: string): string {
  const policy = contentSecurityPolicy({ nodeEnv: 'production', supabaseUrl })
  if (policy === null) throw new Error('expected a production policy')
  return policy
}

/** The space-separated sources of one directive. */
function directive(policy: string, name: string): string[] {
  const found = policy.split('; ').find((part) => part.startsWith(`${name} `))
  if (!found) throw new Error(`no ${name} directive in: ${policy}`)
  return found.slice(name.length + 1).split(' ')
}

describe('contentSecurityPolicy', () => {
  it('emits nothing outside production', () => {
    // next dev needs eval and a localhost websocket for HMR.
    expect(contentSecurityPolicy({ nodeEnv: 'development' })).toBeNull()
    expect(contentSecurityPolicy({ nodeEnv: 'test' })).toBeNull()
    expect(contentSecurityPolicy({})).toBeNull()
  })

  it('lets the room tokens reach Supabase over both http and websockets', () => {
    const connect = directive(production(SUPABASE), 'connect-src')
    expect(connect).toContain('https://project.supabase.co')
    expect(connect).toContain('wss://project.supabase.co')
  })

  it('survives a build with a missing or malformed Supabase URL', () => {
    expect(directive(production(), 'connect-src')).toContain("'self'")
    expect(directive(production('not a url'), 'connect-src')).toContain("'self'")
  })

  // The regression this file exists for: the policy shipped with connect-src
  // and img-src at 'self' + Supabase only, so every Globetrotter call to
  // Wikimedia and OpenStreetMap was blocked in production while working
  // locally, where no policy is emitted at all.
  it('allows every origin the games fetch from', () => {
    const connect = directive(production(SUPABASE), 'connect-src')
    for (const origin of CONNECT_ORIGINS) expect(connect).toContain(origin)
    expect(CONNECT_ORIGINS).toContain('https://commons.wikimedia.org')
    expect(CONNECT_ORIGINS).toContain('https://upload.wikimedia.org')
    expect(CONNECT_ORIGINS).toContain('https://nominatim.openstreetmap.org')
    expect(CONNECT_ORIGINS).toContain('https://api.panoramax.xyz')
  })

  it('allows every origin the games load images from', () => {
    const img = directive(production(SUPABASE), 'img-src')
    for (const origin of IMAGE_ORIGINS) expect(img).toContain(origin)
    // The panorama's <img> decode fallback and the raster basemap.
    expect(IMAGE_ORIGINS).toContain('https://upload.wikimedia.org')
    expect(IMAGE_ORIGINS).toContain('https://tile.openstreetmap.org')
  })

  // Panoramax is federated: the catalog is central but the pixels come from
  // whichever instance holds them, and the viewer streams a panorama with
  // `fetch` before falling back to an <img>. An instance listed for one and not
  // the other is a round that loads on some browsers and not others.
  it('allows Panoramax instances to be both fetched and decoded', () => {
    expect(PANORAMAX_IMAGE_ORIGINS.length).toBeGreaterThan(0)
    for (const origin of PANORAMAX_IMAGE_ORIGINS) {
      expect(CONNECT_ORIGINS).toContain(origin)
      expect(IMAGE_ORIGINS).toContain(origin)
      expect(origin).toMatch(/^https:\/\/[\w.-]+$/)
    }
  })

  it('keeps the blob and data sources the viewer decodes through', () => {
    const img = directive(production(SUPABASE), 'img-src')
    expect(img).toContain('blob:')
    expect(img).toContain('data:')
  })

  it('stays locked down everywhere it does not need to open up', () => {
    const policy = production(SUPABASE)
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("base-uri 'self'")
    expect(policy).toContain("form-action 'self'")
    expect(policy).not.toContain('unsafe-eval')
    // A wildcard host would defeat the point of an allowlist.
    expect(policy).not.toMatch(/(^|[ ;])\*/)
  })
})
