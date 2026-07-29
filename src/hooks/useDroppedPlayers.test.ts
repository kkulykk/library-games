import { act, renderHook } from '@testing-library/react'
import { DROP_GRACE_MS, droppedPlayerIds, useDroppedPlayers } from './useDroppedPlayers'

describe('droppedPlayerIds', () => {
  const now = 1_000_000

  it('reports nobody while every sighting is recent', () => {
    const seen = new Map([
      ['a', now - 500],
      ['b', now],
    ])
    expect(droppedPlayerIds(['a', 'b'], seen, now, 5_000)).toEqual([])
  })

  it('reports a player last seen longer ago than the grace period', () => {
    const seen = new Map([
      ['a', now - 6_000],
      ['b', now - 100],
    ])
    expect(droppedPlayerIds(['a', 'b'], seen, now, 5_000)).toEqual(['a'])
  })

  it('ignores players it has no sighting for at all', () => {
    expect(droppedPlayerIds(['a'], new Map(), now, 5_000)).toEqual([])
  })

  it('defaults to the shared grace period', () => {
    const seen = new Map([['a', now - DROP_GRACE_MS - 1]])
    expect(droppedPlayerIds(['a'], seen, now)).toEqual(['a'])
    expect(droppedPlayerIds(['a'], new Map([['a', now]]), now)).toEqual([])
  })
})

describe('useDroppedPlayers', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('holds off on a player who has only just gone quiet', () => {
    const { result } = renderHook(() => useDroppedPlayers(['a', 'b'], ['a'], 5_000))
    expect(result.current).toEqual([])
  })

  it('calls a player dropped once the grace period has run out', () => {
    const { result } = renderHook(() => useDroppedPlayers(['a', 'b'], ['a'], 5_000))
    act(() => jest.advanceTimersByTime(6_000))
    expect(result.current).toEqual(['b'])
  })

  it('clears the drop as soon as presence reports the player again', () => {
    const { result, rerender } = renderHook(
      ({ online }: { online: string[] }) => useDroppedPlayers(['a', 'b'], online, 5_000),
      { initialProps: { online: ['a'] } }
    )
    act(() => jest.advanceTimersByTime(6_000))
    expect(result.current).toEqual(['b'])
    rerender({ online: ['a', 'b'] })
    expect(result.current).toEqual([])
  })

  it('forgets players who leave the roster', () => {
    const { result, rerender } = renderHook(
      ({ roster }: { roster: string[] }) => useDroppedPlayers(roster, ['a'], 5_000),
      { initialProps: { roster: ['a', 'b'] } }
    )
    act(() => jest.advanceTimersByTime(6_000))
    expect(result.current).toEqual(['b'])
    rerender({ roster: ['a'] })
    expect(result.current).toEqual([])
  })

  it('starts a newcomer clock at the moment they appear on the roster', () => {
    const { result, rerender } = renderHook(
      ({ roster }: { roster: string[] }) => useDroppedPlayers(roster, ['a'], 5_000),
      { initialProps: { roster: ['a'] } }
    )
    act(() => jest.advanceTimersByTime(6_000))
    // 'c' joins now: never in a presence payload, but not dropped either.
    rerender({ roster: ['a', 'c'] })
    expect(result.current).toEqual([])
    act(() => jest.advanceTimersByTime(6_000))
    expect(result.current).toEqual(['c'])
  })
})
