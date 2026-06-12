import { generateRoomCode, ROOM_CODE_LENGTH } from './room-code'

describe('generateRoomCode', () => {
  it('produces codes matching the RLS policy format', () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateRoomCode()).toMatch(/^[A-Z0-9]{4}$/)
    }
  })

  it('has the expected length', () => {
    expect(generateRoomCode()).toHaveLength(ROOM_CODE_LENGTH)
  })

  it('uses the full alphabet, not just hex characters', () => {
    // 1000 codes = 4000 chars; P(all within [A-F0-9]) = (16/36)^4000 ≈ 0
    const chars = new Set(
      Array.from({ length: 1000 }, () => generateRoomCode())
        .join('')
        .split('')
    )
    const beyondHex = [...chars].filter((c) => c >= 'G' && c <= 'Z')
    expect(beyondHex.length).toBeGreaterThan(0)
  })

  it('does not repeat codes excessively', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateRoomCode()))
    // With 1.6M possible codes, 200 draws should be nearly all distinct
    expect(codes.size).toBeGreaterThan(190)
  })
})
