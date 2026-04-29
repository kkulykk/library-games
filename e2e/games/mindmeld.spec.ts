import { fakeSupabaseQuery, test, expect } from '../helpers/fakeSupabase'
import { closePlayers, createPlayer } from '../helpers/players'
import { MindmeldPage } from '../pages'

type MindmeldPlayer = {
  id: string
  name: string
  isHost: boolean
  score: number
}

type MindmeldRound = {
  number: number
  psychicId: string
  spectrum: { left: string; right: string }
  target: number
  clue: string | null
  teamGuess: number | null
  guessLockedBy: string | null
  guesses: Record<string, number>
  roundScores: Record<string, number>
  phase: 'clue' | 'guessing' | 'reveal'
}

type MindmeldState = {
  phase: 'lobby' | 'playing' | 'finished'
  players: MindmeldPlayer[]
  totalRounds: number
  roundNumber: number
  currentRound: MindmeldRound | null
  log: string[]
}

type MindmeldRoomRow = {
  state: MindmeldState
  version: number
}

async function readMindmeldRoom(roomCode: string): Promise<MindmeldRoomRow> {
  const selected = await fakeSupabaseQuery<MindmeldRoomRow>({
    op: 'select',
    table: 'mindmeld_rooms',
    columns: 'state,version',
    filters: [{ column: 'code', value: roomCode }],
    single: true,
  })

  if (!selected.data || selected.error) {
    throw new Error(`Failed to read Mindmeld room ${roomCode}: ${selected.error?.message}`)
  }

  return selected.data
}

async function updateMindmeldRoom(
  roomCode: string,
  row: MindmeldRoomRow,
  nextState: MindmeldState
): Promise<void> {
  const updated = await fakeSupabaseQuery({
    op: 'update',
    table: 'mindmeld_rooms',
    values: { state: nextState, version: row.version + 1 },
    filters: [{ column: 'code', value: roomCode }],
  })

  if (updated.error) {
    throw new Error(`Failed to update Mindmeld room ${roomCode}: ${updated.error.message}`)
  }
}

function seededClueState(players: MindmeldPlayer[]): MindmeldState {
  const [host] = players

  return {
    phase: 'playing',
    players: players.map((player) => ({ ...player, score: 0 })),
    totalRounds: 8,
    roundNumber: 1,
    currentRound: {
      number: 1,
      psychicId: host.id,
      spectrum: { left: 'Cold', right: 'Hot' },
      target: 64,
      clue: null,
      teamGuess: null,
      guessLockedBy: null,
      guesses: {},
      roundScores: {},
      phase: 'clue',
    },
    log: [`Game started — ${host.name} is the first Psychic.`],
  }
}

function seededFinalRevealState(players: MindmeldPlayer[]): MindmeldState {
  const [host, guest] = players.map((player) => ({ ...player, score: 18 }))

  return {
    phase: 'playing',
    players: [host, guest],
    totalRounds: 8,
    roundNumber: 8,
    currentRound: {
      number: 8,
      psychicId: host.id,
      spectrum: { left: 'Quiet', right: 'Loud' },
      target: 42,
      clue: 'thunder',
      teamGuess: 44,
      guessLockedBy: guest.id,
      guesses: {},
      roundScores: {
        [host.id]: 4,
        [guest.id]: 4,
      },
      phase: 'reveal',
    },
    log: ['Final seeded reveal.'],
  }
}

test.describe('Mindmeld gameplay smoke', () => {
  test('submits clue and team guess, advances psychic, and shows final results', async ({
    page,
    browser,
  }) => {
    const hostName = 'Host Mindmeld'
    const hostPage = new MindmeldPage(page)
    const guest = await createPlayer(browser, 'Guest Mindmeld')
    const guestPage = new MindmeldPage(guest.page)

    try {
      await hostPage.goto()
      const roomCode = await hostPage.createRoom(hostName)

      await guestPage.goto()
      await guestPage.joinRoom(roomCode, guest.name)
      await hostPage.startGame()

      const startedRoom = await readMindmeldRoom(roomCode)
      await updateMindmeldRoom(roomCode, startedRoom, seededClueState(startedRoom.state.players))

      await hostPage.expectStatus('you are up')
      await expect(hostPage.privateTarget).toContainText('64')
      await guestPage.expectStatus('is the Psychic')
      await expect(guestPage.waitingClue).toContainText('Waiting for the clue')

      await hostPage.submitClue('campfire')

      await expect(guestPage.currentClue).toContainText('campfire')
      await guestPage.submitGuess('67')

      await expect(hostPage.reveal).toContainText('64')
      await expect(hostPage.reveal).toContainText('67')
      await expect(hostPage.roundScore).toContainText('+4')
      await expect(guestPage.roundScore).toContainText('+4')
      await expect(hostPage.leaderboard).toContainText('Host Mindmeld · 4')

      const midRoundRoom = await readMindmeldRoom(roomCode)
      expect(midRoundRoom.state.currentRound?.phase).toBe('reveal')
      expect(midRoundRoom.state.currentRound?.teamGuess).toBe(67)

      await hostPage.advanceRound()
      await guestPage.expectStatus('you are up')

      const secondRound = await readMindmeldRoom(roomCode)
      await updateMindmeldRoom(
        roomCode,
        secondRound,
        seededFinalRevealState(secondRound.state.players)
      )
      await hostPage.advanceRound()

      await expect(hostPage.finishedBanner).toContainText('win')
      await expect(hostPage.finalLeaderboard).toContainText('Host Mindmeld')
      await expect(guestPage.finalLeaderboard).toContainText('Guest Mindmeld')

      const finalRoom = await readMindmeldRoom(roomCode)
      expect(finalRoom.state.phase).toBe('finished')
    } finally {
      await closePlayers([guest])
    }
  })
})
