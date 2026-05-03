import { getInviteLink } from './useInviteCode'
import { renderHook } from '@testing-library/react'
import { useInviteCode } from './useInviteCode'

describe('getInviteLink', () => {
  it('builds a fragment-based invite URL', () => {
    const link = getInviteLink('uno', 'ABC123')
    expect(link).toBe('http://localhost/library-games/games/uno#code=ABC123')
  })
})

describe('useInviteCode', () => {
  const originalHref = window.location.href

  afterEach(() => {
    window.history.replaceState({}, '', originalHref)
  })

  it('returns null when no code param is present', () => {
    window.history.replaceState({}, '', '/')
    const { result } = renderHook(() => useInviteCode())
    expect(result.current).toBeNull()
  })

  it('returns uppercased code from URL fragment', () => {
    window.history.replaceState({}, '', '/#code=abc123')
    const { result } = renderHook(() => useInviteCode())
    expect(result.current).toBe('ABC123')
  })

  it('falls back to query string code for old invite links', () => {
    window.history.replaceState({}, '', '/?code=legacy')
    const { result } = renderHook(() => useInviteCode())
    expect(result.current).toBe('LEGACY')
  })

  it('returns null for empty code param', () => {
    window.history.replaceState({}, '', '/?code=')
    const { result } = renderHook(() => useInviteCode())
    expect(result.current).toBeNull()
  })

  it('trims whitespace from code', () => {
    window.history.replaceState({}, '', '/?code=%20xyz%20')
    const { result } = renderHook(() => useInviteCode())
    expect(result.current).toBe('XYZ')
  })
})
