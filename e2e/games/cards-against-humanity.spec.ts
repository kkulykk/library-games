import { createRoom, joinRoom, startGame } from '../helpers/assertions'
import { fakeSupabaseQuery, test, expect } from '../helpers/fakeSupabase'
import { gotoGame } from '../helpers/navigation'
import { closePlayers, createPlayer } from '../helpers/players'

type CAHPlayer = {
  id: string
  name: string
  isHost: boolean
}

type CAHState = {
  phase: 'lobby' | 'playing' | 'judging' | 'reveal' | 'finished'
  players: CAHPlayer[]
  czarIndex: number
  blackCard: { text: string; pick: number } | null
  hands: Record<string, number[]>
  submissions: Record<string, number[]>
  submittedPlayerIds: string[]
  shuffledSubmissions: number[][]
  revealOrder: string[]
  revealIndex: number
  roundWinnerId: string | null
  roundWinnerCards: number[]
  scores: Record<string, number>
  pointsToWin: number
  winnerId: string | null
  blackDeck: number[]
  whiteDeck: number[]
  handSize: number
  _rm: string
}

type CAHRoomRow = {
  state: CAHState
  version: number
}

async function readCAHRoom(roomCode: string): Promise<CAHRoomRow> {
  const selected = await fakeSupabaseQuery<CAHRoomRow>({
    op: 'select',
    table: 'cah_rooms',
    columns: 'state,version',
    filters: [{ column: 'code', value: roomCode }],
    single: true,
  })

  if (!selected.data || selected.error) {
    throw new Error(`Failed to read CAH room ${roomCode}: ${selected.error?.message}`)
  }

  return selected.data
}

async function updateCAHRoom(
  roomCode: string,
  row: CAHRoomRow,
  nextState: CAHState
): Promise<void> {
  const updated = await fakeSupabaseQuery({
    op: 'update',
    table: 'cah_rooms',
    values: { state: nextState, version: row.version + 1 },
    filters: [{ column: 'code', value: roomCode }],
  })

  if (updated.error) {
    throw new Error(`Failed to update CAH room ${roomCode}: ${updated.error.message}`)
  }
}

function encodePlayerOrder(playerIds: string[]): string {
  return Buffer.from(JSON.stringify(playerIds), 'utf8').toString('base64')
}

function seededPlayingState(players: CAHPlayer[]): CAHState {
  const [host, guestOne, guestTwo, guestThree] = players

  return {
    phase: 'playing',
    players,
    czarIndex: 0,
    blackCard: { text: 'Library games are best with ___.', pick: 1 },
    hands: {
      [host.id]: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [guestOne.id]: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
      [guestTwo.id]: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
      [guestThree.id]: [30, 31, 32, 33, 34, 35, 36, 37, 38, 39],
    },
    submissions: {},
    submittedPlayerIds: [],
    shuffledSubmissions: [],
    revealOrder: [],
    revealIndex: -1,
    roundWinnerId: null,
    roundWinnerCards: [],
    scores: Object.fromEntries(players.map((player) => [player.id, 0])),
    pointsToWin: 7,
    winnerId: null,
    blackDeck: [1, 2, 3, 4, 5],
    whiteDeck: [40, 41, 42, 43, 44, 45, 46, 47, 48, 49],
    handSize: 10,
    _rm: '',
  }
}

function deterministicJudgingState(state: CAHState): CAHState {
  const [, guestOne, guestTwo, guestThree] = state.players
  const playerOrder = [guestOne.id, guestTwo.id, guestThree.id]

  return {
    ...state,
    phase: 'judging',
    submissions: {},
    submittedPlayerIds: playerOrder,
    shuffledSubmissions: [[10], [20], [30]],
    revealOrder: ['0', '1', '2'],
    revealIndex: -1,
    roundWinnerId: null,
    roundWinnerCards: [],
    _rm: encodePlayerOrder(playerOrder),
  }
}

test.describe('Cards Against Humanity gameplay smoke', () => {
  test('submits answers, judges a winner, and rotates the Card Czar', async ({ page, browser }) => {
    const host = { page, name: 'Host CAH' }
    const guestOne = await createPlayer(browser, 'Guest CAH One')
    const guestTwo = await createPlayer(browser, 'Guest CAH Two')
    const guestThree = await createPlayer(browser, 'Guest CAH Three')

    try {
      await gotoGame(host.page, 'cards-against-humanity')
      const roomCode = await createRoom(host.page, host.name)

      for (const guest of [guestOne, guestTwo, guestThree]) {
        await gotoGame(guest.page, 'cards-against-humanity')
        await joinRoom(guest.page, roomCode, guest.name)
      }

      await startGame(host.page)

      const startedRoom = await readCAHRoom(roomCode)
      await updateCAHRoom(roomCode, startedRoom, seededPlayingState(startedRoom.state.players))

      await expect(host.page.getByTestId('cah-status')).toContainText('You are the Card Czar')
      await expect(host.page.getByTestId('cah-hand-card')).toHaveCount(0)
      await expect(guestOne.page.getByTestId('cah-status')).toContainText('Pick 1 card')
      await expect(guestOne.page.getByTestId('cah-hand-card')).toHaveCount(10)

      for (const guest of [guestOne, guestTwo, guestThree]) {
        await guest.page.getByTestId('cah-hand-card').first().click()
        await guest.page.getByTestId('cah-submit-card').click()
      }

      await expect(host.page.getByTestId('cah-status')).toContainText('Tap to reveal answers')

      const submittedRoom = await readCAHRoom(roomCode)
      await updateCAHRoom(roomCode, submittedRoom, deterministicJudgingState(submittedRoom.state))

      await expect(host.page.getByTestId('cah-face-down-submission')).toHaveCount(3)
      for (let index = 0; index < 3; index += 1) {
        await host.page.getByTestId('cah-reveal-next').click({ force: true })
      }
      await expect(host.page.getByTestId('cah-revealed-submission')).toHaveCount(3)

      await host.page.getByTestId('cah-revealed-submission').first().click()
      await expect(host.page.getByTestId('cah-round-winner')).toContainText(guestOne.name)
      await expect(guestOne.page.getByTestId('cah-round-winner')).toContainText(guestOne.name)
      await expect(host.page.getByTestId('cah-scoreboard')).toContainText(/Guest CAH One\s*1/)

      await host.page.getByTestId('cah-next-round').click()
      await expect(guestOne.page.getByTestId('cah-status')).toContainText('You are the Card Czar')
      await expect(host.page.getByTestId('cah-status')).toContainText('Pick 1 card')
    } finally {
      await closePlayers([guestOne, guestTwo, guestThree])
    }
  })
})
