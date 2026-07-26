// Pure helpers for picking which rendition of a panorama to download.
//
// A 3840px photosphere is ~1.2 MB on the wire and ~30 MB of RGBA once uploaded
// to the GPU — fine on a desktop, but enough for a phone to stall on cellular
// or for mobile Safari to refuse the texture. Only ~20% of the sphere is on
// screen at any moment, so a narrower rendition still gives a phone more texels
// than it has pixels, at a quarter of the bytes.

/**
 * The only widths Wikimedia will serve.
 *
 * Hotlinking any other width is rejected outright — HTTP 400, "Use thumbnail
 * sizes listed on https://w.wiki/GHai" — so a rendition has to be snapped onto
 * this ladder. Asking for a convenient round number like 2048 gets nothing at
 * all. (Requests that go through the API, e.g. `iiurlwidth`, are rounded *up*
 * to the next of these instead of being refused.)
 *
 * @see https://www.mediawiki.org/wiki/Common_thumbnail_sizes
 */
export const STANDARD_THUMB_WIDTHS: readonly number[] = [
  20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840,
]

/** The widest standard rendition that fits in `width`. */
export function standardThumbWidth(width: number): number {
  let best = STANDARD_THUMB_WIDTHS[0]
  for (const candidate of STANDARD_THUMB_WIDTHS) {
    if (candidate <= width) best = candidate
  }
  return best
}

/** Widest rendition worth downloading for a viewport this size. */
export function preferredTextureWidth(viewportWidth: number): number {
  return viewportWidth <= 900 ? 1920 : 3840
}

/**
 * Commons thumbnails are addressed by pixel width (`.../3840px-Foo.jpg`), so a
 * narrower rendition is one string away. Snaps to a servable width, never
 * upscales, and leaves any URL that is not a Commons thumbnail untouched.
 */
export function panoUrlAtWidth(url: string, width: number): string {
  const target = standardThumbWidth(width)
  return url.replace(/\/(\d+)px-/, (whole, current: string) =>
    Number(current) <= target ? whole : `/${target}px-`
  )
}

/** Candidate URLs, cheapest first — the full-size original is the last resort. */
export function panoCandidates(url: string, viewportWidth: number): string[] {
  const sized = panoUrlAtWidth(url, preferredTextureWidth(viewportWidth))
  return sized === url ? [url] : [sized, url]
}
