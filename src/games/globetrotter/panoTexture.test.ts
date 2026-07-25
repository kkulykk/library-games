import { panoCandidates, panoUrlAtWidth, preferredTextureWidth } from './panoTexture'

const FULL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Pont_de_Bir-Hakeim%2C_April_2007.jpg/3840px-Pont_de_Bir-Hakeim%2C_April_2007.jpg'

describe('preferredTextureWidth', () => {
  it('asks phones for the smallest rendition', () => {
    expect(preferredTextureWidth(390)).toBe(2048)
    expect(preferredTextureWidth(480)).toBe(2048)
  })

  it('gives tablets a middle rendition', () => {
    expect(preferredTextureWidth(481)).toBe(2560)
    expect(preferredTextureWidth(900)).toBe(2560)
  })

  it('leaves desktops on the full-size rendition', () => {
    expect(preferredTextureWidth(901)).toBe(3840)
    expect(preferredTextureWidth(2560)).toBe(3840)
  })
})

describe('panoUrlAtWidth', () => {
  it('rewrites only the rendition width, not the file name', () => {
    expect(panoUrlAtWidth(FULL, 2048)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Pont_de_Bir-Hakeim%2C_April_2007.jpg/2048px-Pont_de_Bir-Hakeim%2C_April_2007.jpg'
    )
  })

  it('never upscales a rendition that is already narrow enough', () => {
    const small = panoUrlAtWidth(FULL, 1024)
    expect(panoUrlAtWidth(small, 3840)).toBe(small)
    expect(panoUrlAtWidth(small, 1024)).toBe(small)
  })

  it('leaves non-thumbnail URLs untouched', () => {
    const original = 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Photosphere.jpg'
    expect(panoUrlAtWidth(original, 2048)).toBe(original)
  })
})

describe('panoCandidates', () => {
  it('tries the phone-sized rendition first and keeps the original as a fallback', () => {
    expect(panoCandidates(FULL, 390)).toEqual([panoUrlAtWidth(FULL, 2048), FULL])
  })

  it('does not duplicate the URL when no smaller rendition exists', () => {
    expect(panoCandidates(FULL, 1440)).toEqual([FULL])
  })
})
