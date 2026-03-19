'use client'

import { useState } from 'react'

/**
 * Reads `?code=XXXX` from the current URL synchronously on first render.
 * Returns the uppercased code or null if absent.
 */
export function useInviteCode(): string | null {
  const [code] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('code')
    return raw && raw.trim().length > 0 ? raw.trim().toUpperCase() : null
  })

  return code
}

/**
 * Build a full invite link for the given game slug and room code.
 * Uses window.location.origin + basePath so it works in any environment.
 */
export function getInviteLink(slug: string, roomCode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/library-games/games/${slug}?code=${roomCode}`
}
