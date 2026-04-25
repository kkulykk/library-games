import { createRoom, joinRoom, startGame } from '../helpers/assertions'
import { fakeSupabaseQuery, test, expect } from '../helpers/fakeSupabase'
import { gotoGame } from '../helpers/navigation'
import { closePlayers, createPlayer } from '../helpers/players'

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
    const host = { page, name: 'Host Mindmeld' }
    const guest = await createPlayer(browser, 'Guest Mindmeld')

    try {
      await gotoGame(host.page, 'mindmeld')
      const roomCode = await createRoom(host.page, host.name)

      await gotoGame(guest.page, 'mindmeld')
      await joinRoom(guest.page, roomCode, guest.name)
      await startGame(host.page)

      const startedRoom = await readMindmeldRoom(roomCode)
      await updateMindmeldRoom(roomCode, startedRoom, seededClueState(startedRoom.state.players))

      await expect(host.page.getByTestId('mindmeld-status')).toContainText('you are up')
      await expect(host.page.getByTestId('mindmeld-private-target')).toContainText('64')
      await expect(guest.page.getByTestId('mindmeld-status')).toContainText('is the Psychic')
      await expect(guest.page.getByTestId('mindmeld-waiting-clue')).toContainText(
        'Waiting for the clue'
      )

      await host.page.getByTestId('mindmeld-clue-input').fill('campfire')
      await host.page.getByTestId('mindmeld-send-clue').click()

      await expect(guest.page.getByTestId('mindmeld-current-clue')).toContainText('campfire')
      await guest.page.getByTestId('mindmeld-guess-slider').fill('67')
      await guest.page.getByTestId('mindmeld-lock-guess').click()

      await expect(host.page.getByTestId('mindmeld-reveal')).toContainText('64')
      await expect(host.page.getByTestId('mindmeld-reveal')).toContainText('67')
      await expect(host.page.getByTestId('mindmeld-round-score')).toContainText('+4')
      await expect(guest.page.getByTestId('mindmeld-round-score')).toContainText('+4')
      await expect(host.page.getByTestId('mindmeld-leaderboard')).toContainText('Host Mindmeld · 4')

      await host.page.getByTestId('mindmeld-next-round').click()
      await expect(guest.page.getByTestId('mindmeld-status')).toContainText('you are up')

      const secondRound = await readMindmeldRoom(roomCode)
      await updateMindmeldRoom(
        roomCode,
        secondRound,
        seededFinalRevealState(secondRound.state.players)
      )
      await host.page.getByTestId('mindmeld-next-round').click()

      await expect(host.page.getByTestId('mindmeld-finished')).toContainText('win')
      await expect(host.page.getByTestId('mindmeld-final-leaderboard')).toContainText(
        'Host Mindmeld'
      )
      await expect(guest.page.getByTestId('mindmeld-final-leaderboard')).toContainText(
        'Guest Mindmeld'
      )
    } finally {
      await closePlayers([guest])
    }
  })
})
