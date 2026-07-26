import {
  panoCandidates,
  panoUrlAtWidth,
  preferredTextureWidth,
  standardThumbWidth,
  STANDARD_THUMB_WIDTHS,
} from './panoTexture'

const FULL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Pont_de_Bir-Hakeim%2C_April_2007.jpg/3840px-Pont_de_Bir-Hakeim%2C_April_2007.jpg'

/** The width in a `.../NNNpx-name.jpg` thumbnail URL. */
function widthOf(url: string): number {
  return Number(url.match(/\/(\d+)px-/)![1])
}

describe('standardThumbWidth', () => {
  it('snaps down to a width Wikimedia will actually serve', () => {
    // 2048 and 2560 are the tempting round numbers, and both are refused.
    expect(standardThumbWidth(2048)).toBe(1920)
    expect(standardThumbWidth(2560)).toBe(1920)
    expect(standardThumbWidth(1919)).toBe(1280)
  })

  it('passes standard widths through untouched', () => {
    for (const width of STANDARD_THUMB_WIDTHS) expect(standardThumbWidth(width)).toBe(width)
  })

  it('never returns more than asked for, and never nothing', () => {
    expect(standardThumbWidth(1e6)).toBe(3840)
    expect(standardThumbWidth(0)).toBe(20)
  })
})

describe('preferredTextureWidth', () => {
  it('gives phones and small tablets the 1920px rendition', () => {
    expect(preferredTextureWidth(390)).toBe(1920)
    expect(preferredTextureWidth(900)).toBe(1920)
  })

  it('leaves desktops on the full-size rendition', () => {
    expect(preferredTextureWidth(901)).toBe(3840)
    expect(preferredTextureWidth(2560)).toBe(3840)
  })

  it('only ever picks a servable width', () => {
    for (const viewport of [320, 390, 768, 900, 1024, 1440, 2560]) {
      expect(STANDARD_THUMB_WIDTHS).toContain(preferredTextureWidth(viewport))
    }
  })
})

describe('panoUrlAtWidth', () => {
  it('rewrites only the rendition width, not the file name', () => {
    expect(panoUrlAtWidth(FULL, 1920)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Pont_de_Bir-Hakeim%2C_April_2007.jpg/1920px-Pont_de_Bir-Hakeim%2C_April_2007.jpg'
    )
  })

  it('snaps a non-standard request onto a servable width', () => {
    // Requesting 2048 verbatim returns HTTP 400 from upload.wikimedia.org.
    expect(widthOf(panoUrlAtWidth(FULL, 2048))).toBe(1920)
  })

  it('never upscales a rendition that is already narrow enough', () => {
    const small = panoUrlAtWidth(FULL, 1280)
    expect(panoUrlAtWidth(small, 3840)).toBe(small)
    expect(panoUrlAtWidth(small, 1280)).toBe(small)
  })

  it('leaves non-thumbnail URLs untouched', () => {
    const original = 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Photosphere.jpg'
    expect(panoUrlAtWidth(original, 1920)).toBe(original)
  })
})

describe('panoCandidates', () => {
  it('tries the phone-sized rendition first and keeps the original as a fallback', () => {
    expect(panoCandidates(FULL, 390)).toEqual([panoUrlAtWidth(FULL, 1920), FULL])
  })

  it('only ever offers servable widths', () => {
    for (const viewport of [390, 768, 1440]) {
      for (const url of panoCandidates(FULL, viewport)) {
        expect(STANDARD_THUMB_WIDTHS).toContain(widthOf(url))
      }
    }
  })

  it('does not duplicate the URL when no smaller rendition exists', () => {
    expect(panoCandidates(FULL, 1440)).toEqual([FULL])
  })
})
