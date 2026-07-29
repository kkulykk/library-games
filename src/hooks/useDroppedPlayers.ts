'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * How long a player has to be missing from presence before the UI calls them
 * dropped.
 *
 * Presence is chatty and momentarily wrong: it re-syncs on every reconnect, a
 * backgrounded phone tears its channel down deliberately (see `useGameRoom`),
 * and a player who has just joined shows up a beat after the roster does.
 * Offering a kick button on any of those would let a room boot somebody for
 * walking into a lift, so absence has to persist to count.
 */
export const DROP_GRACE_MS =
  // E2E closes a player's browser and then waits for the button, so the suite
  // would otherwise spend a quarter of a minute per assertion staring at a
  // roster. The rule under test is the same either way.
  process.env.NEXT_PUBLIC_E2E_FAKE_SUPABASE === '1' ? 2_000 : 15_000

/** How often the grace period is re-checked once nobody's presence has changed. */
const CHECK_INTERVAL_MS = 1_000

/**
 * The players whose last sighting is old enough to treat as a drop.
 *
 * Pure so the timing rule can be tested without a room: `lastSeen` maps a
 * player id to when presence last reported them (or when they were first seen
 * on the roster, for someone who never appeared at all).
 */
export function droppedPlayerIds(
  playerIds: readonly string[],
  lastSeen: ReadonlyMap<string, number>,
  now: number,
  graceMs: number = DROP_GRACE_MS
): string[] {
  return playerIds.filter((id) => {
    const seen = lastSeen.get(id)
    return seen !== undefined && now - seen >= graceMs
  })
}

/**
 * Track which of `playerIds` presence has stopped reporting for longer than the
 * grace period — the players a room can safely offer to drop so the rest can
 * carry on.
 */
function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

export function useDroppedPlayers(
  playerIds: readonly string[],
  onlineIds: readonly string[],
  graceMs: number = DROP_GRACE_MS
): string[] {
  const lastSeen = useRef(new Map<string, number>())
  const [dropped, setDropped] = useState<string[]>([])

  // Both lists are rebuilt by their owners on every render, so the effect is
  // keyed on their contents rather than their identity — and reads the ids back
  // out of those keys, which is also what stops a re-render from restarting the
  // heartbeat. Player ids are generated (never comma-bearing), and presence
  // hands its roster back in whatever order the channel synced.
  const rosterKey = playerIds.join(',')
  const onlineKey = [...onlineIds].sort().join(',')

  useEffect(() => {
    const roster = rosterKey === '' ? [] : rosterKey.split(',')
    const online = onlineKey === '' ? [] : onlineKey.split(',')

    const refresh = () => {
      const now = Date.now()
      const seen = lastSeen.current
      for (const id of roster) {
        // Somebody who has never turned up in a presence payload still starts
        // their clock now, so the grace period runs from the moment we could
        // first have seen them rather than from the epoch.
        if (online.includes(id) || !seen.has(id)) seen.set(id, now)
      }
      for (const id of [...seen.keys()]) {
        if (!roster.includes(id)) seen.delete(id)
      }
      const next = droppedPlayerIds(roster, seen, now, graceMs)
      // Same answer, same array: a re-render every second would otherwise ripple
      // through the whole board.
      setDropped((current) => (sameIds(current, next) ? current : next))
    }

    refresh()
    // Nothing else happens while a player simply stays gone, so the grace
    // period needs its own heartbeat to expire on.
    const timer = setInterval(refresh, CHECK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [rosterKey, onlineKey, graceMs])

  return dropped
}
