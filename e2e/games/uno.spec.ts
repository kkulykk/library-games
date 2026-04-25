import { createRoom, joinRoom, startGame } from '../helpers/assertions'
import { fakeSupabaseQuery, test, expect } from '../helpers/fakeSupabase'
import { gotoGame } from '../helpers/navigation'
import { closePlayers, createPlayer } from '../helpers/players'

type UnoCard = {
  id: string
  color: 'red' | 'yellow' | 'green' | 'blue' | 'wild'
  value: number | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'
}

type UnoPlayer = {
  id: string
  name: string
  isHost: boolean
}

type UnoState = {
  phase: 'lobby' | 'playing' | 'finished'
  players: UnoPlayer[]
  hands: Record<string, UnoCard[]>
  drawPile: UnoCard[]
  discardPile: UnoCard[]
  currentPlayerIndex: number
  direction: 1 | -1
  currentColor: 'red' | 'yellow' | 'green' | 'blue'
  pendingDrawCount: number
  calledUno: string[]
  winnerId: string | null
  drawnCardId: string | null
  unoWindow: Record<string, number>
}

type UnoRoomRow = {
  state: UnoState
  version: number
}

const drawPile: UnoCard[] = [
  { id: 'draw-blue-2', color: 'blue', value: 2 },
  { id: 'draw-yellow-4', color: 'yellow', value: 4 },
  { id: 'draw-green-5', color: 'green', value: 5 },
]

async function readUnoRoom(roomCode: string): Promise<UnoRoomRow> {
  const selected = await fakeSupabaseQuery<UnoRoomRow>({
    op: 'select',
    table: 'uno_rooms',
    columns: 'state,version',
    filters: [{ column: 'code', value: roomCode }],
    single: true,
  })

  if (!selected.data || selected.error) {
    throw new Error(`Failed to read Uno room ${roomCode}: ${selected.error?.message}`)
  }

  return selected.data
}

async function updateUnoRoom(
  roomCode: string,
  row: UnoRoomRow,
  nextState: UnoState
): Promise<void> {
  const updated = await fakeSupabaseQuery({
    op: 'update',
    table: 'uno_rooms',
    values: { state: nextState, version: row.version + 1 },
    filters: [{ column: 'code', value: roomCode }],
  })

  if (updated.error) {
    throw new Error(`Failed to update Uno room ${roomCode}: ${updated.error.message}`)
  }
}

function seededTurnState(players: UnoPlayer[]): UnoState {
  const [host, guest] = players

  return {
    phase: 'playing',
    players,
    hands: {
      [host.id]: [
        { id: 'host-red-5', color: 'red', value: 5 },
        { id: 'host-blue-1', color: 'blue', value: 1 },
      ],
      [guest.id]: [
        { id: 'guest-yellow-1', color: 'yellow', value: 1 },
        { id: 'guest-blue-6', color: 'blue', value: 6 },
      ],
    },
    drawPile,
    discardPile: [{ id: 'discard-red-9', color: 'red', value: 9 }],
    currentPlayerIndex: 0,
    direction: 1,
    currentColor: 'red',
    pendingDrawCount: 0,
    calledUno: [],
    winnerId: null,
    drawnCardId: null,
    unoWindow: {},
  }
}

function seededNearWinState(players: UnoPlayer[]): UnoState {
  const [host, guest] = players

  return {
    phase: 'playing',
    players,
    hands: {
      [host.id]: [{ id: 'host-blue-1', color: 'blue', value: 1 }],
      [guest.id]: [{ id: 'guest-green-7', color: 'green', value: 7 }],
    },
    drawPile,
    discardPile: [{ id: 'discard-green-3', color: 'green', value: 3 }],
    currentPlayerIndex: 1,
    direction: 1,
    currentColor: 'green',
    pendingDrawCount: 0,
    calledUno: [],
    winnerId: null,
    drawnCardId: null,
    unoWindow: {},
  }
}

test.describe('Uno gameplay smoke', () => {
  test('plays a deterministic turn and syncs a final-card win to both players', async ({
    page,
    browser,
  }) => {
    const host = { page, name: 'Host Uno Smoke' }
    const guest = await createPlayer(browser, 'Guest Uno Smoke')

    try {
      await gotoGame(host.page, 'uno')
      const roomCode = await createRoom(host.page, host.name)

      await gotoGame(guest.page, 'uno')
      await joinRoom(guest.page, roomCode, guest.name)
      await startGame(host.page)

      const startedRoom = await readUnoRoom(roomCode)
      const turnState = seededTurnState(startedRoom.state.players)
      await updateUnoRoom(roomCode, startedRoom, turnState)

      await expect(host.page.getByTestId('uno-status')).toContainText('Your turn')
      await expect(guest.page.getByTestId('uno-status')).toContainText(`${host.name}'s turn`)
      await expect(host.page.getByTestId('uno-hand-card')).toHaveCount(2)
      await expect(guest.page.getByTestId('uno-hand-card')).toHaveCount(2)
      await expect(host.page.getByTestId('uno-draw-pile')).toContainText('3 cards')
      await expect(host.page.getByTestId('uno-discard-pile')).toContainText('discard')

      await host.page.getByTestId('uno-hand-card').first().click()

      await expect(host.page.getByTestId('uno-status')).toContainText(`${guest.name}'s turn`)
      await expect(guest.page.getByTestId('uno-status')).toContainText('Your turn')

      const afterTurnRoom = await readUnoRoom(roomCode)
      await updateUnoRoom(roomCode, afterTurnRoom, seededNearWinState(afterTurnRoom.state.players))

      await expect(guest.page.getByTestId('uno-status')).toContainText('Your turn')
      await expect(guest.page.getByTestId('uno-hand-card')).toHaveCount(1)
      await guest.page.getByTestId('uno-hand-card').first().click()

      await expect(guest.page.getByTestId('uno-winner-banner')).toContainText('You win')
      await expect(host.page.getByTestId('uno-winner-banner')).toContainText(`${guest.name} wins`)
    } finally {
      await closePlayers([guest])
    }
  })
})
