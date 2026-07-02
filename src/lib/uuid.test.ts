import { randomId } from './uuid'

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('randomId', () => {
  it('returns a UUID-shaped string using crypto.randomUUID when available', () => {
    expect(randomId()).toMatch(UUID_SHAPE)
  })

  it('produces distinct ids across calls', () => {
    expect(randomId()).not.toBe(randomId())
  })

  it('falls back to getRandomValues when randomUUID is missing and sets RFC 4122 bits', () => {
    const original = crypto.randomUUID
    // @ts-expect-error — force the fallback path
    crypto.randomUUID = undefined
    try {
      const id = randomId()
      expect(id).toMatch(UUID_SHAPE)
      // version nibble is 4, variant nibble is one of 8/9/a/b
      expect(id[14]).toBe('4')
      expect(['8', '9', 'a', 'b']).toContain(id[19].toLowerCase())
    } finally {
      crypto.randomUUID = original
    }
  })

  it('falls back to Math.random when no crypto is available', () => {
    const originalCrypto = globalThis.crypto
    // @ts-expect-error — simulate a non-secure, crypto-less environment
    delete globalThis.crypto
    try {
      expect(randomId()).toMatch(UUID_SHAPE)
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
      })
    }
  })
})
