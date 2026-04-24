import { createRoom, expectPlayerVisible, readInviteLink } from './helpers/assertions'
import { test, expect } from './helpers/fakeSupabase'
import { gotoGame } from './helpers/navigation'

const multiplayerGames = [
  'skribbl',
  'uno',
  'agario',
  'cards-against-humanity',
  'codenames',
  'mindmeld',
] as const

test.describe.configure({ mode: 'serial' })

test.describe('multiplayer room contract', () => {
  for (const slug of multiplayerGames) {
    test(`${slug} can create a room with host roster and invite link`, async ({ page }) => {
      await gotoGame(page, slug)

      const hostName = `Host ${slug.slice(0, 6)}`
      const roomCode = await createRoom(page, hostName)

      expect(roomCode).toMatch(/^[A-Z0-9]{4}$/)
      await expectPlayerVisible(page, hostName)

      const inviteLink = await readInviteLink(page)
      expect(inviteLink).toContain(`/library-games/games/${slug}?code=${roomCode}`)
    })
  }
})
