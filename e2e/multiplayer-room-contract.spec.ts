import {
  createRoom,
  expectPlayerVisible,
  joinRoom,
  readInviteLink,
  startGame,
} from './helpers/assertions'
import { fakeSupabaseQuery, test, expect } from './helpers/fakeSupabase'
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

test.describe('multiplayer room edge states', () => {
  test('uno shows error for invalid room code', async ({ page }) => {
    await gotoGame(page, 'uno')

    const playButton = page.getByTestId('play-game-button')
    if (await playButton.isVisible().catch(() => false)) {
      await playButton.click()
    }

    await page.getByTestId('join-room-button').filter({ visible: true }).first().click()
    await page.getByTestId('player-name-input').fill('Late Guest')
    await page.getByTestId('room-code-input').fill('NOPE')
    await page.getByTestId('join-room-button').filter({ visible: true }).last().click()

    await expect(page.getByTestId('room-error')).toContainText(
      'Room not found. Check the code and try again.'
    )
  })

  test('uno blocks joining after game starts', async ({ page, browser }) => {
    const host = { page, name: 'Host Uno' }
    const guest = await createPlayer(browser, 'Guest Uno')
    const lateJoiner = await createPlayer(browser, 'Late Uno')

    try {
      await gotoGame(host.page, 'uno')
      const roomCode = await createRoom(host.page, host.name)

      await gotoGame(guest.page, 'uno')
      await joinRoom(guest.page, roomCode, guest.name)

      await startGame(host.page)

      await gotoGame(lateJoiner.page, 'uno')
      const playButton = lateJoiner.page.getByTestId('play-game-button')
      if (await playButton.isVisible().catch(() => false)) {
        await playButton.click()
      }

      await lateJoiner.page
        .getByTestId('join-room-button')
        .filter({ visible: true })
        .first()
        .click()
      await lateJoiner.page.getByTestId('player-name-input').fill(lateJoiner.name)
      await lateJoiner.page.getByTestId('room-code-input').fill(roomCode)
      await lateJoiner.page.getByTestId('join-room-button').filter({ visible: true }).last().click()

      await expect(lateJoiner.page.getByTestId('room-error')).toContainText(
        'This game has already started.'
      )
    } finally {
      await closePlayers([guest, lateJoiner])
    }
  })

  test('agario blocks join when room is full', async ({ page, browser }) => {
    const host = { page, name: 'Host Agario' }
    const overflow = await createPlayer(browser, 'Overflow')

    try {
      await gotoGame(host.page, 'agario')
      const roomCode = await createRoom(host.page, host.name)

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

      await gotoGame(overflow.page, 'agario')
      const playButton = overflow.page.getByTestId('play-game-button')
      if (await playButton.isVisible().catch(() => false)) {
        await playButton.click()
      }

      await overflow.page.getByTestId('join-room-button').filter({ visible: true }).first().click()
      await overflow.page.getByTestId('player-name-input').fill(overflow.name)
      await overflow.page.getByTestId('room-code-input').fill(roomCode)
      await overflow.page.getByTestId('join-room-button').filter({ visible: true }).last().click()

      await expect(overflow.page.getByTestId('room-error')).toContainText('Room is full.')
    } finally {
      await closePlayers([overflow])
    }
  })

  test('uno leave room returns to entry and clears session', async ({ page }) => {
    await gotoGame(page, 'uno')
    const roomCode = await createRoom(page, 'Host Leave')

    await expect(page.getByTestId('room-code')).toContainText(roomCode)
    await page.getByTestId('leave-room-button').click()

    await expect(
      page.getByTestId('create-room-button').filter({ visible: true }).first()
    ).toBeVisible()

    const sessionValue = await page.evaluate(() => localStorage.getItem('uno_session'))
    expect(sessionValue).toBeNull()
  })

  test('uno reload offers restore and reconnects to active session', async ({ page }) => {
    await gotoGame(page, 'uno')
    const roomCode = await createRoom(page, 'Host Restore')

    await page.reload()

    const playButton = page.getByTestId('play-game-button')
    if (await playButton.isVisible().catch(() => false)) {
      await playButton.click()
    }

    const roomCodeLocator = page.getByTestId('room-code')
    if ((await roomCodeLocator.count()) === 0) {
      await page.getByRole('button', { name: /resume/i }).click()
    }

    await expect(page.getByTestId('room-code')).toContainText(roomCode)
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

    await gotoGame(page, 'uno')

    const playButton = page.getByTestId('play-game-button')
    if (await playButton.isVisible().catch(() => false)) {
      await playButton.click()
    }

    await expect(
      page.getByTestId('create-room-button').filter({ visible: true }).first()
    ).toBeVisible()
    await expect(page.getByTestId('room-code')).toHaveCount(0)

    await page.evaluate(() => {
      localStorage.setItem('uno_session', '{bad-json')
    })
    await page.reload()

    if (await playButton.isVisible().catch(() => false)) {
      await playButton.click()
    }

    await expect(
      page.getByTestId('create-room-button').filter({ visible: true }).first()
    ).toBeVisible()
    await expect(page.getByTestId('room-code')).toHaveCount(0)
  })
})
