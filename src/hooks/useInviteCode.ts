'use client'

import { useEffect, useState } from 'react'

/**
 * Reads `#code=XXXX` from the current URL after mount, falling back to legacy `?code=XXXX` links.
 * Returns the uppercased code, null if absent, or undefined until resolved.
 */
function normalizeInviteCode(raw: string | null): string | null {
  const trimmed = raw?.trim()
  return trimmed && trimmed.length > 0 ? trimmed.toUpperCase() : null
}

export function useInviteCode(): string | null | undefined {
  const [code, setCode] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const searchParams = new URLSearchParams(window.location.search)
    setCode(
      normalizeInviteCode(hashParams.get('code')) ?? normalizeInviteCode(searchParams.get('code'))
    )
  }, [])

  return code
}

/**
 * Build a full invite link for the given game slug and room code.
 * Uses window.location.origin + basePath so it works in any environment.
 */
export function getInviteLink(slug: string, roomCode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/library-games/games/${slug}#code=${encodeURIComponent(roomCode)}`
}
