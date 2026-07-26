// P2-6: a defense-in-depth Content-Security-Policy. GitHub Pages cannot set
// response headers, so this ships as a <meta> tag baked into the static export.
// Static export cannot mint per-request nonces, so script/style fall back to
// 'unsafe-inline' (Next hydration + Tailwind); the meaningful win is keeping
// connect-src to a named list, so the localStorage-held room tokens can only
// ever be sent to Supabase.

/**
 * Third-party origins the games talk to at runtime, and what needs each one.
 *
 * This is an allowlist, so an origin missing here is not degraded — it is
 * blocked outright, and a CSP-blocked `fetch` rejects with a bare `TypeError`
 * indistinguishable from the network being down. Globetrotter shipped that way:
 * every Wikimedia and OpenStreetMap call failed in production while working
 * locally, because `next dev` emits no policy at all.
 *
 * Reaching a new external service means adding it here in the same change.
 */
const ORIGINS = {
  /** Globetrotter — Random World deck sweeps. `randomWorld.ts` */
  commonsApi: 'https://commons.wikimedia.org',
  /** Globetrotter — photosphere downloads, fetched *and* decoded via <img>. `PanoViewer.tsx` */
  wikimediaUploads: 'https://upload.wikimedia.org',
  /** Globetrotter — reverse-geocoding the drop point for the reveal. `placeName.ts` */
  nominatim: 'https://nominatim.openstreetmap.org',
  /** Globetrotter — OpenStreetMap raster basemap. `WorldMap.tsx` */
  osmTiles: 'https://tile.openstreetmap.org',
} as const

/** Origins reached with `fetch`. */
export const CONNECT_ORIGINS: readonly string[] = [
  ORIGINS.commonsApi,
  ORIGINS.wikimediaUploads,
  ORIGINS.nominatim,
]

/** Origins loaded as images, including `new Image()` from script. */
export const IMAGE_ORIGINS: readonly string[] = [ORIGINS.wikimediaUploads, ORIGINS.osmTiles]

export interface CspEnv {
  /** `process.env.NODE_ENV` — no policy is emitted outside production. */
  nodeEnv?: string
  /** `process.env.NEXT_PUBLIC_SUPABASE_URL`, if the build was given one. */
  supabaseUrl?: string
}

/**
 * The policy for a static export, or `null` when one should not be emitted.
 *
 * `next dev` gets none: HMR needs eval and a localhost websocket that a strict
 * policy would break.
 */
export function contentSecurityPolicy({ nodeEnv, supabaseUrl }: CspEnv): string | null {
  if (nodeEnv !== 'production') return null

  const supabase: string[] = []
  if (supabaseUrl) {
    try {
      const origin = new URL(supabaseUrl).origin
      supabase.push(origin, origin.replace(/^http/, 'ws'))
    } catch {
      // ignore a malformed URL — connect-src just keeps its other entries
    }
  }

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${IMAGE_ORIGINS.join(' ')}`,
    "font-src 'self'",
    "worker-src 'self' blob:",
    `connect-src ${["'self'", ...supabase, ...CONNECT_ORIGINS].join(' ')}`,
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
}
