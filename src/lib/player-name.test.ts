import { playerNameSchema, PLAYER_NAME_MIN, PLAYER_NAME_MAX } from './player-name'

describe('playerNameSchema', () => {
  describe('accepts', () => {
    it.each([['Roman'], ['ローマン'], ['player 🎮'], ['x_42'], ['a'], ['a'.repeat(20)]])(
      'accepts %p',
      (name) => {
        expect(playerNameSchema.safeParse(name).success).toBe(true)
      }
    )

    it('accepts a name that is 1..20 code points after trim', () => {
      expect(playerNameSchema.safeParse('  Roman  ').success).toBe(true)
    })
  })

  describe('rejects', () => {
    it('rejects an empty string', () => {
      expect(playerNameSchema.safeParse('').success).toBe(false)
    })

    it('rejects an all-whitespace string (0 length after trim)', () => {
      expect(playerNameSchema.safeParse('   ').success).toBe(false)
    })

    it('rejects 21+ characters', () => {
      expect(playerNameSchema.safeParse('a'.repeat(21)).success).toBe(false)
    })

    it('rejects a zero-width character U+200B (Cf)', () => {
      expect(playerNameSchema.safeParse('ab​cd').success).toBe(false)
    })

    it('rejects a control character U+0007 (Cc)', () => {
      expect(playerNameSchema.safeParse('abcd').success).toBe(false)
    })

    it('rejects a non-string input', () => {
      expect(playerNameSchema.safeParse(42).success).toBe(false)
    })
  })

  it('exposes the 1..20 length bounds', () => {
    expect(PLAYER_NAME_MIN).toBe(1)
    expect(PLAYER_NAME_MAX).toBe(20)
  })
})
