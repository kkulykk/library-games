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
  place?: { name: string; country: string | null }
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

/** A Random World round: no field notes, so the reveal needs a geocoder. */
function seededRandomWorldState(players: GlobetrotterPlayer[]): GlobetrotterState {
  const drop: GlobetrotterLocation = {
    name: 'Austria',
    country: '47.92°N, 14.34°E',
    lat: 47.921,
    lng: 14.341,
    emoji: '\u{1F310}',
    clues: [],
  }
  return {
    phase: 'playing',
    players: players.map((player) => ({ ...player, score: 0 })),
    totalRounds: 5,
    roundNumber: 1,
    deck: [drop],
    currentRound: {
      number: 1,
      location: drop,
      guesses: {},
      distances: {},
      roundScores: {},
      phase: 'guessing',
    },
    log: ['Expedition started — pin your first guess on the map.'],
  }
}

/** Counts reverse-geocode calls made by one player's browser. */
async function countGeocodes(page: Page): Promise<() => number> {
  let calls = 0
  await page.route('https://nominatim.openstreetmap.org/**', (route) => {
    calls += 1
    return route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify({ address: { village: 'Ternberg', country: 'Austria' } }),
    })
  })
  return () => calls
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

type GlCounts = {
  createProgram: number
  deleteProgram: number
  createTexture: number
  deleteTexture: number
  createBuffer: number
  deleteBuffer: number
}

/**
 * Count WebGL object churn, and optionally make the first few texture uploads
 * fail the way a mobile driver does.
 *
 * The panorama viewer keeps one canvas — and therefore one context — for its
 * whole life, rebuilding a program and a texture per round on top of it, so
 * anything it allocates and never releases simply piles up on the GPU.
 */
async function instrumentWebGL(page: Page, failedUploads = 0): Promise<void> {
  await page.addInitScript((failures: number) => {
    const counts = {
      createProgram: 0,
      deleteProgram: 0,
      createTexture: 0,
      deleteTexture: 0,
      createBuffer: 0,
      deleteBuffer: 0,
    }
    const scope = window as unknown as {
      __glCounts: typeof counts
      __glContext?: WebGLRenderingContext
    }
    scope.__glCounts = counts

    const original = HTMLCanvasElement.prototype.getContext
    type Wrapped = WebGLRenderingContext & { __counted?: boolean }
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: unknown[]
    ) {
      const context = (original as (...a: unknown[]) => unknown).apply(this, args) as Wrapped | null
      if (!context || !String(args[0]).includes('webgl') || context.__counted) return context
      context.__counted = true
      scope.__glContext = context

      const spied = context as unknown as Record<string, (...a: unknown[]) => unknown>
      for (const name of Object.keys(counts) as (keyof typeof counts)[]) {
        const inner = spied[name].bind(context)
        spied[name] = (...callArgs: unknown[]) => {
          counts[name] += 1
          return inner(...callArgs)
        }
      }

      let remaining = failures
      const upload = spied.texImage2D.bind(context)
      spied.texImage2D = (...callArgs: unknown[]) => {
        if (remaining > 0) {
          remaining -= 1
          // How Safari refuses an ImageBitmap its driver will not take.
          throw new TypeError('simulated driver rejection')
        }
        return upload(...callArgs)
      }
      return context
    } as typeof HTMLCanvasElement.prototype.getContext
  }, failedUploads)
}

function readGlCounts(page: Page): Promise<GlCounts> {
  return page.evaluate(() => (window as unknown as { __glCounts: GlCounts }).__glCounts)
}

test.describe('Globetrotter solo (Random World, mocked archives)', () => {
  /** Panoramax host serving pictures in these tests — one of the CSP allowlist. */
  const PANORAMAX_HOST = 'https://panoramax.openstreetmap.fr'

  /**
   * Panoramax double: one STAC `/api/search` per sweep, answering with
   * spherical pictures inside whatever bounding box was asked for, so a deck
   * always has a second archive to draw from. Registered by `mockArchives`;
   * a test that wants Panoramax down routes over it afterwards.
   */
  async function mockPanoramax(page: Page): Promise<void> {
    // Sweeps aim at randomly chosen coverage cells, so answering with the box's
    // own corner made two sweeps that landed near each other yield pictures the
    // separation rule then threw away — and a deck that came up short every so
    // often. Walking the answers around the globe per sweep instead keeps the
    // double's job ("this archive has usable spherical pictures") deterministic.
    let sweep = 0
    await page.route('https://api.panoramax.xyz/**', async (route) => {
      const spot = sweep++
      const features = [0, 1].map((i) => {
        const step = spot * 2 + i
        const id = `mock-pic-${step}`
        return {
          id,
          // Every answer lands at least 20° of longitude from every other, so
          // the 50 km separation rule never has cause to drop one.
          geometry: {
            type: 'Point',
            coordinates: [-170 + ((step * 37) % 340), -55 + ((step * 23) % 110)],
          },
          assets: {
            sd: { href: `${PANORAMAX_HOST}/derivates/${id}/sd.jpg`, type: 'image/jpeg' },
          },
          providers: [{ name: 'Mock Panoramaxer', roles: ['producer'] }],
          properties: {
            license: 'CC-BY-SA-4.0',
            'pers:interior_orientation': {
              field_of_view: 360,
              sensor_array_dimensions: [5760, 2880],
            },
          },
        }
      })
      await route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({ features }),
      })
    })
    await page.route(`${PANORAMAX_HOST}/**`, (route) =>
      route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'image/jpeg',
        body: TINY_JPEG,
      })
    )
  }

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
                // Shaped like a real Commons rendition: the client rewrites the
                // `NNNpx-` segment to pick a size its screen can use.
                thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Mock_pano_${index}.jpg/3840px-Mock_pano_${index}.jpg`,
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
    await page.route('https://nominatim.openstreetmap.org/**', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({
          address: { town: 'Dodge City', county: 'Ford County', country: 'United States' },
        }),
      })
    )
  }

  /**
   * Every archive a deck is drawn from. A deck is split between them, so a run
   * that stubs only one still reaches the network for the other — which is
   * exactly the nondeterminism e2e is here to keep out.
   */
  async function mockArchives(page: Page): Promise<void> {
    await mockCommons(page)
    await mockPanoramax(page)
  }

  test('scouts a deck, plays a round, reveals the country', async ({ page }) => {
    await mockArchives(page)

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

    // The reveal upgrades the polygon-level country to the town the drop
    // actually landed in, keeping the country and coordinates underneath.
    await expect(solo.revealPlace).toContainText('Dodge City')
    await expect(solo.reveal).toContainText('United States')
    await expect(solo.reveal).toContainText('°N')
    await expect(solo.roundScore).toContainText('+')
    await expect(solo.revealDistance).toBeVisible()
    await expect(solo.mapTarget).toBeVisible()

    await solo.advanceRound()
    await solo.expectStatus('Round 2 of 5')

    await solo.exitSoloButton.click()
    await expect(solo.soloButton).toBeVisible()
  })

  test.describe('touch map navigation', () => {
    test.use({ viewport: { width: 390, height: 664 }, hasTouch: true })

    test('pinches to zoom, drags to pan, and only taps drop a pin', async ({ page }) => {
      await mockArchives(page)

      const solo = new GlobetrotterPage(page)
      await solo.goto()
      await solo.dismissPlayGate()
      await solo.soloButton.click()
      await expect(solo.pano).toBeVisible()
      await solo.expandMap()
      // The dock animates open; gestures need the settled element box.
      await expect(solo.lockGuessButton).toBeDisabled()
      await page.waitForTimeout(600)

      const cdp = await page.context().newCDPSession(page)
      const dispatch = (
        type: 'touchStart' | 'touchMove' | 'touchEnd',
        points: [number, number][]
      ) =>
        cdp.send('Input.dispatchTouchEvent', {
          type,
          touchPoints: points.map(([x, y], index) => ({ x, y, id: index + 1 })),
        })

      const box = (await solo.map.boundingBox())!
      const cx = Math.round(box.x + box.width / 2)
      const cy = Math.round(box.y + box.height / 2)
      const viewWidth = async () => Number((await solo.map.getAttribute('viewBox'))!.split(' ')[2])
      const viewX = async () => Number((await solo.map.getAttribute('viewBox'))!.split(' ')[0])
      const pins = () => page.locator('.gt-map-pin').count()

      // Spread two fingers: the map zooms in and drops nothing.
      const worldWidth = await viewWidth()
      await dispatch('touchStart', [
        [cx - 30, cy],
        [cx + 30, cy],
      ])
      for (let step = 1; step <= 8; step++) {
        const spread = 30 + step * 15
        await dispatch('touchMove', [
          [cx - spread, cy],
          [cx + spread, cy],
        ])
      }
      await dispatch('touchEnd', [])
      expect(await viewWidth()).toBeLessThan(worldWidth / 2)
      expect(await pins()).toBe(0)

      // One finger drags the map rather than dropping a pin.
      const beforePan = await viewX()
      await dispatch('touchStart', [[cx, cy]])
      for (let step = 1; step <= 6; step++) await dispatch('touchMove', [[cx - step * 12, cy]])
      await dispatch('touchEnd', [])
      expect(await viewX()).toBeGreaterThan(beforePan)
      expect(await pins()).toBe(0)

      // Closing the fingers zooms back out.
      const zoomedWidth = await viewWidth()
      await dispatch('touchStart', [
        [cx - 120, cy],
        [cx + 120, cy],
      ])
      for (let step = 1; step <= 8; step++) {
        const spread = 120 - step * 12
        await dispatch('touchMove', [
          [cx - spread, cy],
          [cx + spread, cy],
        ])
      }
      await dispatch('touchEnd', [])
      expect(await viewWidth()).toBeGreaterThan(zoomedWidth)

      // A plain tap is still how a pin gets placed.
      await dispatch('touchStart', [[cx, cy]])
      await dispatch('touchEnd', [])
      await expect(solo.lockGuessButton).toBeEnabled()
      expect(await pins()).toBe(1)
    })
  })

  test('fits the whole board on a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 664 })
    await mockArchives(page)

    const solo = new GlobetrotterPage(page)
    await solo.goto()
    await solo.dismissPlayGate()
    await solo.soloButton.click()
    await expect(solo.pano).toBeVisible()

    const layout = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect()
      return {
        innerHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: rect('.gt-viewport').height,
        panoHeight: rect('.gt-pano').height,
        mapDockBottom: rect('.gt-mapdock').bottom,
      }
    })

    // The photo fills the slot reserved for it. It used to collapse to the
    // canvas' intrinsic size, leaving a band of dead space underneath.
    expect(layout.panoHeight).toBeCloseTo(layout.viewportHeight, 0)
    expect(layout.panoHeight).toBeGreaterThan(200)
    // Everything — photo, minimap, field notes — sits inside one screenful.
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.innerHeight + 1)
    expect(layout.mapDockBottom).toBeLessThanOrEqual(layout.innerHeight)
  })

  test('shows scouting progress while the deck is assembled', async ({ page }) => {
    await mockArchives(page)
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    // Hold both archives' first sweep open so the scouting screen is
    // observable — one archive still answering would fill the counter.
    for (const archive of ['https://commons.wikimedia.org/**', 'https://api.panoramax.xyz/**']) {
      await page.route(archive, async (route) => {
        await held
        await route.fallback()
      })
    }

    const solo = new GlobetrotterPage(page)
    await solo.goto()
    await solo.dismissPlayGate()
    await solo.soloButton.click()

    await expect(solo.scouting).toBeVisible()
    await expect(solo.scouting).toContainText('0 of 5 locations locked')
    release()
    await expect(solo.pano).toBeVisible()
  })

  test('scouts the deck while the player is still choosing how to play', async ({ page }) => {
    await mockArchives(page)
    let sweeps = 0
    // Registered after mockArchives so it sees the request first, then hands it
    // back for the mock to answer.
    await page.route('https://commons.wikimedia.org/**', async (route) => {
      sweeps += 1
      await route.fallback()
    })

    const solo = new GlobetrotterPage(page)
    await solo.goto()
    await solo.dismissPlayGate()

    // The archives are already being swept, before Solo has been pressed —
    // that head start is what the scouting screen used to be spent on.
    await expect.poll(() => sweeps).toBeGreaterThan(0)

    await solo.soloButton.click()
    await expect(solo.pano).toBeVisible()
    await solo.expectStatus('Round 1 of 5')
  })

  test('falls back to the offline reserve when every archive is unreachable', async ({ page }) => {
    await page.route('https://commons.wikimedia.org/**', (route) => route.abort())
    await page.route('https://upload.wikimedia.org/**', (route) => route.abort())
    await page.route('https://api.panoramax.xyz/**', (route) => route.abort())
    await page.route(`${PANORAMAX_HOST}/**`, (route) => route.abort())
    await page.route('https://nominatim.openstreetmap.org/**', (route) => route.abort())

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

  test('plays a Panoramax round and credits it to Panoramax', async ({ page }) => {
    // Commons down, Panoramax up: the second archive is not decoration, it is
    // what keeps a deck live when the first one is rate-limited.
    await mockArchives(page)
    await page.route('https://commons.wikimedia.org/**', (route) => route.abort())

    const solo = new GlobetrotterPage(page)
    await solo.goto()
    await solo.dismissPlayGate()
    await solo.soloButton.click()

    await solo.expectStatus('Round 1 of 5')
    await expect(page.getByTestId('globetrotter-deck-source')).toBeHidden()
    await expect(solo.pano).toBeVisible()
    await expect(page.getByTestId('globetrotter-pano-error')).toBeHidden()

    const credit = page.locator('.gt-pano-watermark')
    await expect(credit).toContainText('Panoramax')
    await expect(credit).toContainText('Mock Panoramaxer')
    // The credit is text, not a link: the archive page names the location, so
    // one click on it during the round would hand over the answer.
    expect(await credit.evaluate((node) => node.tagName)).toBe('SPAN')

    // The source link turns up at the reveal, once there is nothing to spoil.
    await solo.placeAndLockGuess(0.5, 0.5)
    const revealCredit = page.getByTestId('globetrotter-photo-credit')
    await expect(revealCredit).toContainText('Mock Panoramaxer')
    await expect(revealCredit).toHaveAttribute('href', /api\.panoramax\.xyz\/#focus=pic/)
  })

  test('only ever asks Wikimedia for a rendition it will serve', async ({ page }) => {
    // upload.wikimedia.org rejects any width off its standard ladder with a
    // 400 ("Use thumbnail sizes listed on https://w.wiki/GHai"), so a phone
    // asking for a convenient 2048px gets nothing at all.
    const STANDARD = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840]
    const widths: number[] = []
    await mockArchives(page)
    // Registered after mockArchives so it wins over its blanket image route.
    await page.route('https://upload.wikimedia.org/**', (route) => {
      const width = Number(
        route
          .request()
          .url()
          .match(/\/(\d+)px-/)?.[1]
      )
      if (Number.isFinite(width)) widths.push(width)
      return route.fulfill({
        status: STANDARD.includes(width) ? 200 : 400,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'image/jpeg',
        body: TINY_JPEG,
      })
    })
    await page.setViewportSize({ width: 390, height: 664 })

    const solo = new GlobetrotterPage(page)
    await solo.goto()
    await solo.dismissPlayGate()
    await solo.soloButton.click()
    await expect(solo.pano).toBeVisible()
    await expect(page.getByTestId('globetrotter-pano-loading')).toBeHidden()

    expect(widths.length).toBeGreaterThan(0)
    expect(widths.filter((width) => !STANDARD.includes(width))).toEqual([])
    // A phone takes the small rendition, not the 1.2 MB one.
    expect(widths[0]).toBe(1920)
    await expect(page.getByTestId('globetrotter-pano-error')).toBeHidden()
  })

  test('hands back the GPU resources of the round it just left', async ({ page }) => {
    await instrumentWebGL(page)
    await mockArchives(page)

    const solo = new GlobetrotterPage(page)
    await solo.goto()
    await solo.dismissPlayGate()
    await solo.soloButton.click()
    // The board has to exist before "not loading" means anything — on the
    // scouting screen there is no panorama, so the loading bar is absent and
    // `toBeHidden` passes without a round having started.
    await expect(solo.pano).toBeVisible()
    await expect(page.getByTestId('globetrotter-pano-loading')).toBeHidden()

    await solo.placeAndLockGuess(0.4, 0.4)
    await expect(solo.reveal).toBeVisible()
    await solo.advanceRound()
    await solo.expectStatus('Round 2 of 5')
    await expect(page.getByTestId('globetrotter-pano-loading')).toBeHidden()

    const counts = await readGlCounts(page)
    // Two rounds, two builds — otherwise the assertions below prove nothing.
    expect(counts.createProgram).toBeGreaterThan(1)
    // Only the round on screen is allowed to still hold anything. Every
    // earlier round's texture is several megabytes of video memory, and a
    // phone answers that pressure by taking the context away entirely.
    expect(counts.createProgram - counts.deleteProgram).toBeLessThanOrEqual(1)
    expect(counts.createTexture - counts.deleteTexture).toBeLessThanOrEqual(1)
    expect(counts.createBuffer - counts.deleteBuffer).toBeLessThanOrEqual(1)
  })

  test('rebuilds itself when the browser takes the WebGL context away', async ({ page }) => {
    await instrumentWebGL(page)
    await mockArchives(page)

    const solo = new GlobetrotterPage(page)
    await solo.goto()
    await solo.dismissPlayGate()
    await solo.soloButton.click()
    // Scouting renders no panorama, so wait for the board itself — otherwise
    // there is no context on `window.__glContext` to take away below.
    await expect(solo.pano).toBeVisible()
    await expect(page.getByTestId('globetrotter-pano-loading')).toBeHidden()
    const before = (await readGlCounts(page)).createProgram

    await page.evaluate(() => {
      const context = (window as unknown as { __glContext: WebGLRenderingContext }).__glContext
      const ext = context.getExtension('WEBGL_lose_context')!
      ext.loseContext()
      setTimeout(() => ext.restoreContext(), 50)
    })

    // The viewer comes back on its own — no Try again, no dead black box.
    await expect
      .poll(async () => (await readGlCounts(page)).createProgram, { timeout: 15000 })
      .toBeGreaterThan(before)
    await expect(page.getByTestId('globetrotter-pano-loading')).toBeHidden()
    await expect(page.getByTestId('globetrotter-pano-error')).toBeHidden()
  })

  test('recovers when the driver refuses the first texture upload', async ({ page }) => {
    // One rejection: enough to force the ladder's first rung, a 2D-canvas copy
    // of the source, which is what gets a stubborn mobile driver to accept it.
    await instrumentWebGL(page, 1)
    await mockArchives(page)

    const solo = new GlobetrotterPage(page)
    await solo.goto()
    await solo.dismissPlayGate()
    await solo.soloButton.click()

    await expect(page.getByTestId('globetrotter-pano-loading')).toBeHidden()
    await expect(page.getByTestId('globetrotter-pano-error')).toBeHidden()
    // The compass only renders once a texture is live on the context.
    await expect(page.locator('.gt-compass')).toBeVisible()
  })

  test('names the reason a photosphere would not load', async ({ page }) => {
    await mockArchives(page)
    await page.route('https://upload.wikimedia.org/**', (route) =>
      route.fulfill({
        status: 400,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'text/html',
        body: 'Use thumbnail sizes listed on https://w.wiki/GHai',
      })
    )

    const solo = new GlobetrotterPage(page)
    await solo.goto()
    await solo.dismissPlayGate()
    await solo.soloButton.click()

    // An opaque "would not load" sends players to Try again forever; the
    // status code says whether it is the archive, the network or the device.
    await expect(page.getByTestId('globetrotter-pano-error-hint')).toContainText('400')
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

test.describe('Globetrotter dropped players', () => {
  test('drops a player who vanished mid-round and reveals without them', async ({
    page,
    browser,
  }) => {
    const hostPage = new GlobetrotterPage(page)
    const staying = await createPlayer(browser, 'Staying Globe')
    const stayingPage = new GlobetrotterPage(staying.page)
    const leaving = await createPlayer(browser, 'Leaving Globe')
    const leavingPage = new GlobetrotterPage(leaving.page)

    try {
      await hostPage.goto()
      const roomCode = await hostPage.createRoom('Host Globe')
      await stayingPage.goto()
      await stayingPage.joinRoom(roomCode, staying.name)
      await leavingPage.goto()
      await leavingPage.joinRoom(roomCode, leaving.name)
      await hostPage.page.getByTestId('globetrotter-mode-landmarks').click()
      await hostPage.startGame()

      const started = await readGlobetrotterRoom(roomCode)
      await updateGlobetrotterRoom(roomCode, started, seededGuessingState(started.state.players))

      await hostPage.expectStatus('Pins locked: 0 of 3')
      await hostPage.placeAndLockGuess(0.5, 0.25)
      await stayingPage.placeAndLockGuess(0.52, 0.24)
      await hostPage.expectStatus('Pins locked: 2 of 3')

      // Nobody is on offer while every player is still answering presence.
      await expect(hostPage.page.getByTestId('globetrotter-drop-player')).toHaveCount(0)

      // The third player's browser goes away without leaving the room — the
      // same teardown a backgrounded phone or a closed laptop performs.
      await leaving.page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })

      const dropButton = hostPage.page.getByRole('button', {
        name: 'Drop Leaving Globe from the expedition',
      })
      await expect(dropButton).toBeVisible({ timeout: 15_000 })
      await dropButton.click()

      // The round settles on the two players still in the room.
      await expect(hostPage.reveal).toContainText('Eiffel Tower')
      await expect(stayingPage.reveal).toContainText('Eiffel Tower')

      const room = await readGlobetrotterRoom(roomCode)
      expect(room.state.players.map((player) => player.name)).toEqual([
        'Host Globe',
        'Staying Globe',
      ])
      expect(room.state.currentRound?.phase).toBe('reveal')
      // The log names who did it — dropping somebody is not an anonymous act.
      expect(
        room.state.log.some((line) => line === 'Leaving Globe was dropped by Host Globe.')
      ).toBe(true)

      // And the expedition carries on without them.
      await hostPage.advanceRound()
      await hostPage.expectStatus('Pins locked: 0 of 2')

      // The dropped player comes back — presence goes quiet for a backgrounded
      // phone as readily as for a closed laptop — and is told what happened
      // instead of being shown a room they are no longer on the roster of.
      await leaving.page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      const dropped = leaving.page.getByTestId('globetrotter-dropped')
      await expect(dropped).toContainText('You were dropped from this expedition')
      await leaving.page.getByTestId('globetrotter-dropped-exit').click()
      await expect(leavingPage.soloButton).toBeVisible()
    } finally {
      await closePlayers([staying, leaving])
    }
  })
})

test.describe('Globetrotter shared place lookup', () => {
  test('one reverse-geocode per room, not one per player', async ({ page, browser }) => {
    const hostPage = new GlobetrotterPage(page)
    const guest = await createPlayer(browser, 'Guest Globe')
    const guestPage = new GlobetrotterPage(guest.page)
    const hostCalls = await countGeocodes(page)
    const guestCalls = await countGeocodes(guest.page)

    try {
      await hostPage.goto()
      const roomCode = await hostPage.createRoom('Host Globe')
      await guestPage.goto()
      await guestPage.joinRoom(roomCode, guest.name)
      await hostPage.page.getByTestId('globetrotter-mode-landmarks').click()
      await hostPage.startGame()

      // Seed a Random World round — the drop is named only by its country.
      const started = await readGlobetrotterRoom(roomCode)
      await updateGlobetrotterRoom(roomCode, started, seededRandomWorldState(started.state.players))

      // The host resolves the town during the round and shares it via the room.
      await expect
        .poll(async () => (await readGlobetrotterRoom(roomCode)).state.currentRound?.location.place)
        .toEqual({ name: 'Ternberg', country: 'Austria' })

      await hostPage.placeAndLockGuess(0.5, 0.3)
      await guestPage.placeAndLockGuess(0.52, 0.32)

      // Both players read the same shared answer.
      await expect(hostPage.revealPlace).toContainText('Ternberg')
      await expect(guestPage.revealPlace).toContainText('Ternberg')
      await expect(hostPage.reveal).toContainText('Austria')

      expect(hostCalls()).toBe(1)
      expect(guestCalls()).toBe(0)
    } finally {
      await closePlayers([guest])
    }
  })
})
