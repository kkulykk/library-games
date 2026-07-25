import type { Page } from '@playwright/test'
import { fakeSupabaseQuery, test, expect } from '../helpers/fakeSupabase'
import { closePlayers, createPlayer } from '../helpers/players'
import { GlobetrotterPage } from '../pages'

type GlobetrotterPlayer = {
  id: string
  name: string
  isHost: boolean
  score: number
}

type GlobetrotterLocation = {
  name: string
  country: string
  lat: number
  lng: number
  emoji: string
  clues: string[]
}

type GlobetrotterRound = {
  number: number
  location: GlobetrotterLocation
  guesses: Record<string, { lat: number; lng: number }>
  distances: Record<string, number>
  roundScores: Record<string, number>
  phase: 'guessing' | 'reveal'
}

type GlobetrotterState = {
  phase: 'lobby' | 'playing' | 'finished'
  players: GlobetrotterPlayer[]
  totalRounds: number
  roundNumber: number
  deck: GlobetrotterLocation[]
  currentRound: GlobetrotterRound | null
  log: string[]
}

type GlobetrotterRoomRow = {
  state: GlobetrotterState
  version: number
}

const seededDeck: GlobetrotterLocation[] = [
  {
    name: 'Eiffel Tower',
    country: 'France',
    lat: 48.858,
    lng: 2.294,
    emoji: '🗼',
    clues: ['A temperate European capital.', 'Baguettes everywhere.', 'An iron lattice tower.'],
  },
  {
    name: 'Sydney Opera House',
    country: 'Australia',
    lat: -33.857,
    lng: 151.215,
    emoji: '🎭',
    clues: ['A southern-hemisphere harbor.', 'A big steel arch bridge.', 'White sail shells.'],
  },
  {
    name: 'Great Pyramid of Giza',
    country: 'Egypt',
    lat: 29.979,
    lng: 31.134,
    emoji: '🐪',
    clues: ['A desert plateau.', 'Camels and a river delta.', 'Three ancient tombs.'],
  },
  {
    name: 'Statue of Liberty',
    country: 'United States',
    lat: 40.689,
    lng: -74.044,
    emoji: '🗽',
    clues: ['A busy Atlantic harbor.', 'Yellow cabs across the water.', 'A copper-green lady.'],
  },
  {
    name: 'Mount Fuji',
    country: 'Japan',
    lat: 35.361,
    lng: 138.727,
    emoji: '🗻',
    clues: ['An island nation.', 'Bullet trains glide past.', 'A symmetrical volcano.'],
  },
]

async function readGlobetrotterRoom(roomCode: string): Promise<GlobetrotterRoomRow> {
  const selected = await fakeSupabaseQuery<GlobetrotterRoomRow>({
    op: 'select',
    table: 'globetrotter_rooms',
    columns: 'state,version',
    filters: [{ column: 'code', value: roomCode }],
    single: true,
  })

  if (!selected.data || selected.error) {
    throw new Error(`Failed to read Globetrotter room ${roomCode}: ${selected.error?.message}`)
  }

  return selected.data
}

async function updateGlobetrotterRoom(
  roomCode: string,
  row: GlobetrotterRoomRow,
  nextState: GlobetrotterState
): Promise<void> {
  const updated = await fakeSupabaseQuery({
    op: 'update',
    table: 'globetrotter_rooms',
    values: { state: nextState, version: row.version + 1 },
    filters: [{ column: 'code', value: roomCode }],
  })

  if (updated.error) {
    throw new Error(`Failed to update Globetrotter room ${roomCode}: ${updated.error.message}`)
  }
}

function seededGuessingState(players: GlobetrotterPlayer[]): GlobetrotterState {
  return {
    phase: 'playing',
    players: players.map((player) => ({ ...player, score: 0 })),
    totalRounds: 5,
    roundNumber: 1,
    deck: seededDeck,
    currentRound: {
      number: 1,
      location: seededDeck[0],
      guesses: {},
      distances: {},
      roundScores: {},
      phase: 'guessing',
    },
    log: ['Expedition started — pin your first guess on the map.'],
  }
}

function seededFinalRevealState(players: GlobetrotterPlayer[]): GlobetrotterState {
  const [host, guest] = players.map((player) => ({ ...player, score: 12000 }))

  return {
    phase: 'playing',
    players: [host, guest],
    totalRounds: 5,
    roundNumber: 5,
    deck: seededDeck,
    currentRound: {
      number: 5,
      location: seededDeck[4],
      guesses: {
        [host.id]: { lat: 35.4, lng: 138.7 },
        [guest.id]: { lat: 0, lng: 0 },
      },
      distances: { [host.id]: 5, [guest.id]: 10456 },
      roundScores: { [host.id]: 5000, [guest.id]: 5 },
      phase: 'reveal',
    },
    log: ['Final seeded reveal.'],
  }
}

// 1×1 white JPEG — enough for the WebGL pano texture in tests.
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64'
)

test.describe('Globetrotter solo (Random World, mocked Commons)', () => {
  /**
   * Commons double for the two-request pipeline: one `generator=categorymembers`
   * sweep listing geotagged photospheres, then one `titles=…&iiurlwidth=…`
   * request rendering their thumbnails.
   */
  async function mockCommons(page: Page): Promise<void> {
    await page.route('https://commons.wikimedia.org/**', async (route) => {
      const url = new URL(route.request().url())
      let body: unknown
      if (url.searchParams.get('generator') === 'categorymembers') {
        const pages: Record<string, unknown> = {}
        for (let i = 0; i < 5; i++) {
          // Spread across the US so the min-separation rule passes and every
          // reveal names the same country.
          pages[String(i)] = {
            title: `File:Mock pano ${i}.jpg`,
            imageinfo: [
              {
                width: 4096,
                height: 2048,
                mime: 'image/jpeg',
                extmetadata: {
                  Artist: { value: 'Mock Mapper' },
                  LicenseShortName: { value: 'CC BY-SA 4.0' },
                },
              },
            ],
            coordinates: [{ lat: 39 + i * 2, lon: -100 + i * 3 }],
          }
        }
        body = { query: { pages } }
      } else {
        const titles = (url.searchParams.get('titles') ?? '').split('|')
        const pages: Record<string, unknown> = {}
        titles.forEach((title, index) => {
          pages[String(index)] = {
            title,
            imageinfo: [
              {
                thumburl: `https://upload.wikimedia.org/mock-${index}.jpg`,
                extmetadata: {
                  Artist: { value: 'Mock Mapper' },
                  LicenseShortName: { value: 'CC BY-SA 4.0' },
                },
              },
            ],
          }
        })
        body = { query: { pages } }
      }
      await route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    })
    await page.route('https://upload.wikimedia.org/**', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'image/jpeg',
        body: TINY_JPEG,
      })
    )
  }

  test('scouts a deck, plays a round, reveals the country', async ({ page }) => {
    await mockCommons(page)

    const solo = new GlobetrotterPage(page)
    await solo.goto()
    await solo.dismissPlayGate()
    await solo.soloButton.click()

    await expect(solo.pano).toBeVisible()
    await expect(solo.clues).toBeHidden()
    await solo.expectStatus('Round 1 of 5')

    // The map docks small until it is popped open to guess.
    await expect(solo.mapExpandButton).toBeVisible()
    await expect(solo.lockGuessButton).toBeHidden()
    await solo.expandMap()
    await expect(solo.lockGuessButton).toBeDisabled()

    await solo.clickMap(0.5, 0.5)
    await expect(solo.lockGuessButton).toBeEnabled()
    await solo.lockGuessButton.click()

    await expect(solo.reveal).toContainText('United States of America')
    await expect(solo.reveal).toContainText('°N')
    await expect(solo.roundScore).toContainText('+')
    await expect(solo.revealDistance).toBeVisible()
    await expect(solo.mapTarget).toBeVisible()

    await solo.advanceRound()
    await solo.expectStatus('Round 2 of 5')

    await solo.exitSoloButton.click()
    await expect(solo.soloButton).toBeVisible()
  })

  test('shows scouting progress while the deck is assembled', async ({ page }) => {
    await mockCommons(page)
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    // Hold the first sweep open so the scouting screen is observable.
    await page.route('https://commons.wikimedia.org/**', async (route) => {
      await held
      await route.fallback()
    })

    const solo = new GlobetrotterPage(page)
    await solo.goto()
    await solo.dismissPlayGate()
    await solo.soloButton.click()

    await expect(solo.scouting).toBeVisible()
    await expect(solo.scouting).toContainText('0 of 5 locations locked')
    release()
    await expect(solo.pano).toBeVisible()
  })

  test('falls back to the offline reserve when Commons is unreachable', async ({ page }) => {
    await page.route('https://commons.wikimedia.org/**', (route) => route.abort())
    await page.route('https://upload.wikimedia.org/**', (route) => route.abort())

    const solo = new GlobetrotterPage(page)
    await solo.goto()
    await solo.dismissPlayGate()
    await solo.soloButton.click()

    // The reserve deck keeps the round playable even with the archive down.
    await solo.expectStatus('Round 1 of 5')
    await expect(page.getByTestId('globetrotter-deck-source')).toContainText('offline reserve')
    await expect(page.getByTestId('globetrotter-pano-error')).toBeVisible()

    await solo.placeAndLockGuess(0.5, 0.5)
    await expect(solo.reveal).toBeVisible()
  })
})

test.describe('Globetrotter gameplay smoke', () => {
  test('two players guess, reveal scores, advance rounds, and finish', async ({
    page,
    browser,
  }) => {
    const hostName = 'Host Globe'
    const hostPage = new GlobetrotterPage(page)
    const guest = await createPlayer(browser, 'Guest Globe')
    const guestPage = new GlobetrotterPage(guest.page)

    try {
      await hostPage.goto()
      const roomCode = await hostPage.createRoom(hostName)

      await guestPage.goto()
      await guestPage.joinRoom(roomCode, guest.name)
      await hostPage.page.getByTestId('globetrotter-mode-landmarks').click()
      await hostPage.startGame()

      // Seed a deterministic round 1 so assertions do not depend on the shuffle.
      const startedRoom = await readGlobetrotterRoom(roomCode)
      await updateGlobetrotterRoom(
        roomCode,
        startedRoom,
        seededGuessingState(startedRoom.state.players)
      )

      await expect(hostPage.clues).toContainText('iron lattice tower')
      await expect(guestPage.clues).toContainText('iron lattice tower')
      await hostPage.expectStatus('Pins locked: 0 of 2')

      await hostPage.placeAndLockGuess(0.5, 0.25)
      await expect(hostPage.waiting).toContainText('Waiting for 1 more')
      await hostPage.expectStatus('Pins locked: 1 of 2')

      await guestPage.placeAndLockGuess(0.52, 0.24)

      await expect(hostPage.reveal).toContainText('Eiffel Tower')
      await expect(guestPage.reveal).toContainText('Eiffel Tower')
      await expect(hostPage.roundScore).toContainText('+')
      await expect(hostPage.mapTarget).toBeVisible()

      const midRoundRoom = await readGlobetrotterRoom(roomCode)
      expect(midRoundRoom.state.currentRound?.phase).toBe('reveal')
      expect(Object.keys(midRoundRoom.state.currentRound?.guesses ?? {})).toHaveLength(2)

      await hostPage.advanceRound()
      await hostPage.expectStatus('Pins locked: 0 of 2')
      await expect(hostPage.clues).toContainText('steel arch bridge')

      // Seed the final round already revealed, then let the host finish the game.
      const secondRound = await readGlobetrotterRoom(roomCode)
      await updateGlobetrotterRoom(
        roomCode,
        secondRound,
        seededFinalRevealState(secondRound.state.players)
      )
      await expect(hostPage.nextRoundButton).toContainText('See results')
      await hostPage.advanceRound()

      await expect(hostPage.finishedBanner).toContainText('win')
      await expect(hostPage.finalLeaderboard).toContainText('Host Globe')
      await expect(guestPage.finalLeaderboard).toContainText('Guest Globe')

      const finalRoom = await readGlobetrotterRoom(roomCode)
      expect(finalRoom.state.phase).toBe('finished')
    } finally {
      await closePlayers([guest])
    }
  })
})
