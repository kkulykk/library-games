'use client'

import { useEffect, useState } from 'react'

/**
 * Reads `?code=XXXX` from the current URL after mount.
 * Returns the uppercased code, null if absent, or undefined until resolved.
 */
export function useInviteCode(): string | null | undefined {
  const [code, setCode] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('code')
    setCode(raw && raw.trim().length > 0 ? raw.trim().toUpperCase() : null)
  }, [])

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
