import { createRoom, expectPlayerVisible, joinRoom, readInviteLink } from './helpers/assertions'
import { test, expect } from './helpers/fakeSupabase'
import { gotoGame } from './helpers/navigation'
import { closePlayers, createPlayer } from './helpers/players'

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

    test(`${slug} allows a second player to join and sync roster`, async ({ page, browser }) => {
      const host = { page, name: `Host ${slug.slice(0, 6)}` }
      const guest = await createPlayer(browser, `Guest ${slug.slice(0, 6)}`)

      try {
        await gotoGame(host.page, slug)
        const roomCode = await createRoom(host.page, host.name)

        await gotoGame(guest.page, slug)
        await joinRoom(guest.page, roomCode, guest.name)

        await expectPlayerVisible(host.page, host.name)
        await expectPlayerVisible(host.page, guest.name)
        await expectPlayerVisible(guest.page, host.name)
        await expectPlayerVisible(guest.page, guest.name)
      } finally {
        await closePlayers([guest])
      }
    })
  }
})
