import { fakeSupabaseQuery, test, expect } from './helpers/fakeSupabase'
import { closePlayers, createPlayer } from './helpers/players'
import { RoomLobbyPage, type MultiplayerSlug } from './pages'

const multiplayerGames: MultiplayerSlug[] = [
  'skribbl',
  'uno',
  'agario',
  'cards-against-humanity',
  'codenames',
  'mindmeld',
]

test.describe.configure({ mode: 'serial' })

test.describe('multiplayer room contract', () => {
  for (const slug of multiplayerGames) {
    test(`${slug} can create a room with host roster and invite link`, async ({ page }) => {
      const lobby = new RoomLobbyPage(page, slug)
      await lobby.goto()

      const hostName = `Host ${slug.slice(0, 6)}`
      const roomCode = await lobby.createRoom(hostName)

      expect(roomCode).toMatch(/^[A-Z0-9]{4}$/)
      await lobby.expectPlayerVisible(hostName)

      const inviteLink = await lobby.readInviteLink()
      expect(inviteLink).toContain(`/library-games/games/${slug}?code=${roomCode}`)
    })

    test(`${slug} allows a second player to join and sync roster`, async ({ page, browser }) => {
      const hostName = `Host ${slug.slice(0, 6)}`
      const hostLobby = new RoomLobbyPage(page, slug)
      const guest = await createPlayer(browser, `Guest ${slug.slice(0, 6)}`)
      const guestLobby = new RoomLobbyPage(guest.page, slug)

      try {
        await hostLobby.goto()
        const roomCode = await hostLobby.createRoom(hostName)

        await guestLobby.goto()
        await guestLobby.joinRoom(roomCode, guest.name)

        await hostLobby.expectPlayerVisible(hostName)
        await hostLobby.expectPlayerVisible(guest.name)
        await guestLobby.expectPlayerVisible(hostName)
        await guestLobby.expectPlayerVisible(guest.name)
      } finally {
        await closePlayers([guest])
      }
    })
  }
})

test.describe('multiplayer room edge states', () => {
  test('uno shows error for invalid room code', async ({ page }) => {
    const lobby = new RoomLobbyPage(page, 'uno')
    await lobby.goto()
    await lobby.joinRoomExpectingError('NOPE', 'Late Guest')
    await lobby.expectError('Room not found. Check the code and try again.')
  })

  test('uno blocks joining after game starts', async ({ page, browser }) => {
    const hostName = 'Host Uno'
    const hostLobby = new RoomLobbyPage(page, 'uno')
    const guest = await createPlayer(browser, 'Guest Uno')
    const guestLobby = new RoomLobbyPage(guest.page, 'uno')
    const lateJoiner = await createPlayer(browser, 'Late Uno')
    const lateLobby = new RoomLobbyPage(lateJoiner.page, 'uno')

    try {
      await hostLobby.goto()
      const roomCode = await hostLobby.createRoom(hostName)

      await guestLobby.goto()
      await guestLobby.joinRoom(roomCode, guest.name)

      await hostLobby.startGame()

      await lateLobby.goto()
      await lateLobby.joinRoomExpectingError(roomCode, lateJoiner.name)
      await lateLobby.expectError('This game has already started.')
    } finally {
      await closePlayers([guest, lateJoiner])
    }
  })

  test('agario blocks join when room is full', async ({ page, browser }) => {
    const hostName = 'Host Agario'
    const hostLobby = new RoomLobbyPage(page, 'agario')
    const overflow = await createPlayer(browser, 'Overflow')
    const overflowLobby = new RoomLobbyPage(overflow.page, 'agario')

    try {
      await hostLobby.goto()
      const roomCode = await hostLobby.createRoom(hostName)

      const selected = await fakeSupabaseQuery<{
        state: {
          phase: string
          hostId: string
          players: Array<{ id: string; name: string; isHost: boolean; color: string }>
        }
        version: number
      }>({
        op: 'select',
        table: 'agario_rooms',
        columns: 'state,version',
        filters: [{ column: 'code', value: roomCode }],
        single: true,
      })

      if (!selected.data || selected.error) {
        throw new Error(
          `Failed to load agario room for full-room setup: ${selected.error?.message}`
        )
      }

      const current = selected.data
      const players = [
        ...current.state.players,
        ...Array.from({ length: 7 }, (_, index) => ({
          id: `seed-${index + 1}`,
          name: `Seed ${index + 1}`,
          isHost: false,
          color: `#${(index + 1).toString(16).padStart(6, '0').slice(0, 6)}`,
        })),
      ].slice(0, 8)

      const updated = await fakeSupabaseQuery({
        op: 'update',
        table: 'agario_rooms',
        values: {
          state: { ...current.state, players },
          version: current.version + 1,
        },
        filters: [{ column: 'code', value: roomCode }],
      })

      if (updated.error) {
        throw new Error(`Failed to seed full agario room: ${updated.error.message}`)
      }

      await overflowLobby.goto()
      await overflowLobby.joinRoomExpectingError(roomCode, overflow.name)
      await overflowLobby.expectError('Room is full.')
    } finally {
      await closePlayers([overflow])
    }
  })

  test('uno leave room returns to entry and clears session', async ({ page }) => {
    const lobby = new RoomLobbyPage(page, 'uno')
    await lobby.goto()
    const roomCode = await lobby.createRoom('Host Leave')

    await expect(lobby.roomCodeDisplay).toContainText(roomCode)
    await lobby.leaveRoom()

    await lobby.expectAtEntry()

    const sessionValue = await page.evaluate(() => localStorage.getItem('uno_session'))
    expect(sessionValue).toBeNull()
  })

  test('uno reload offers restore and reconnects to active session', async ({ page }) => {
    const lobby = new RoomLobbyPage(page, 'uno')
    await lobby.goto()
    const roomCode = await lobby.createRoom('Host Restore')

    await page.reload()
    await lobby.dismissPlayGate()

    if ((await lobby.roomCodeDisplay.count()) === 0) {
      await page.getByRole('button', { name: /resume/i }).click()
    }

    await expect(lobby.roomCodeDisplay).toContainText(roomCode)
  })

  test('uno ignores expired or malformed saved session', async ({ page }) => {
    await page.goto('/library-games')
    await page.evaluate(() => {
      localStorage.setItem(
        'uno_session',
        JSON.stringify({
          roomCode: 'AB12',
          playerId: 'expired-player',
          playerName: 'Expired',
          ts: Date.now() - 25 * 60 * 60 * 1000,
        })
      )
    })

    const lobby = new RoomLobbyPage(page, 'uno')
    await lobby.goto()
    await lobby.dismissPlayGate()
    await lobby.expectAtEntry()

    await page.evaluate(() => {
      localStorage.setItem('uno_session', '{bad-json')
    })
    await page.reload()
    await lobby.dismissPlayGate()
    await lobby.expectAtEntry()
  })
})
