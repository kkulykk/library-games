// Pure helpers for picking which rendition of a panorama to download.
//
// A 3840px photosphere is several megabytes on the wire and ~30 MB of RGBA
// once uploaded to the GPU — fine on a desktop, but enough for a phone to
// stall on cellular or for mobile Safari to refuse the texture and drop the
// WebGL context. Only ~20% of the sphere is on screen at any moment, so a
// narrower rendition still gives a phone more texels than it has pixels.

/** Widest rendition worth downloading for a viewport this size. */
export function preferredTextureWidth(viewportWidth: number): number {
  if (viewportWidth <= 480) return 2048
  if (viewportWidth <= 900) return 2560
  return 3840
}

/**
 * Commons thumbnails are addressed by pixel width (`.../3840px-Foo.jpg`), so a
 * narrower rendition is one string away. Never upscales, and leaves any URL
 * that is not a Commons thumbnail untouched.
 */
export function panoUrlAtWidth(url: string, width: number): string {
  return url.replace(/\/(\d+)px-/, (whole, current: string) =>
    Number(current) <= width ? whole : `/${width}px-`
  )
}

/** Candidate URLs, cheapest first — the full-size original is the last resort. */
export function panoCandidates(url: string, viewportWidth: number): string[] {
  const sized = panoUrlAtWidth(url, preferredTextureWidth(viewportWidth))
  return sized === url ? [url] : [sized, url]
}
