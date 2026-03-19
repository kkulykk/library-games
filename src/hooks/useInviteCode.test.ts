import { getInviteLink } from './useInviteCode'
import { renderHook } from '@testing-library/react'
import { useInviteCode } from './useInviteCode'

describe('getInviteLink', () => {
  it('builds a correct invite URL', () => {
    const link = getInviteLink('uno', 'ABC123')
    expect(link).toBe('http://localhost/library-games/games/uno?code=ABC123')
  })
})

describe('useInviteCode', () => {
  const originalLocation = window.location

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    })
  })

  it('returns null when no code param is present', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '' },
      writable: true,
    })
    const { result } = renderHook(() => useInviteCode())
    expect(result.current).toBeNull()
  })

  it('returns uppercased code from URL', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?code=abc123' },
      writable: true,
    })
    const { result } = renderHook(() => useInviteCode())
    expect(result.current).toBe('ABC123')
  })

  it('returns null for empty code param', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?code=' },
      writable: true,
    })
    const { result } = renderHook(() => useInviteCode())
    expect(result.current).toBeNull()
  })

  it('trims whitespace from code', () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '?code=%20xyz%20' },
      writable: true,
    })
    const { result } = renderHook(() => useInviteCode())
    expect(result.current).toBe('XYZ')
  })
})
