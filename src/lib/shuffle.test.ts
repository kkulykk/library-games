import { shuffle } from './shuffle'

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = shuffle(arr)
    expect(result).toHaveLength(arr.length)
  })

  it('contains the same elements as the input', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = shuffle(arr)
    expect([...result].sort()).toEqual([...arr].sort())
  })

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3]
    const copy = [...arr]
    shuffle(arr)
    expect(arr).toEqual(copy)
  })

  it('is deterministic given a seeded rng', () => {
    const arr = [1, 2, 3, 4, 5]
    const seed = () => {
      let s = 42
      return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff
        return s / 0x7fffffff
      }
    }
    expect(shuffle(arr, seed())).toEqual(shuffle(arr, seed()))
  })

  it('uses the provided rng', () => {
    let calls = 0
    const rng = () => {
      calls++
      return 0.5
    }
    shuffle([1, 2, 3, 4], rng)
    expect(calls).toBeGreaterThan(0)
  })

  it('handles empty and single-element arrays', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle([1])).toEqual([1])
  })
})
