import { fakeSupabaseQuery, test, expect } from '../helpers/fakeSupabase'
import { closePlayers, createPlayer } from '../helpers/players'
import { UnoPage } from '../pages'

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
    const hostName = 'Host Uno Smoke'
    const hostPage = new UnoPage(page)
    const guest = await createPlayer(browser, 'Guest Uno Smoke')
    const guestPage = new UnoPage(guest.page)

    try {
      await hostPage.goto()
      const roomCode = await hostPage.createRoom(hostName)

      await guestPage.goto()
      await guestPage.joinRoom(roomCode, guest.name)
      await hostPage.startGame()

      const startedRoom = await readUnoRoom(roomCode)
      const turnState = seededTurnState(startedRoom.state.players)
      await updateUnoRoom(roomCode, startedRoom, turnState)

      await hostPage.expectStatus('Your turn')
      await guestPage.expectStatus(`${hostName}'s turn`)
      await hostPage.expectHandSize(2)
      await guestPage.expectHandSize(2)
      await expect(hostPage.drawPile).toContainText('3 cards')
      await expect(hostPage.discardPile).toContainText('discard')

      await hostPage.playCard(0)

      await hostPage.expectStatus(`${guest.name}'s turn`)
      await guestPage.expectStatus('Your turn')

      const afterTurnRoom = await readUnoRoom(roomCode)
      await updateUnoRoom(roomCode, afterTurnRoom, seededNearWinState(afterTurnRoom.state.players))

      await guestPage.expectStatus('Your turn')
      await guestPage.expectHandSize(1)
      await guestPage.playCard(0)

      await guestPage.expectWinnerText('You win')
      await hostPage.expectWinnerText(`${guest.name} wins`)

      const finalRoom = await readUnoRoom(roomCode)
      expect(finalRoom.state.phase).toBe('finished')
      const finalGuest = finalRoom.state.players.find((p) => p.name === guest.name)
      expect(finalGuest).toBeDefined()
      expect(finalRoom.state.winnerId).toBe(finalGuest?.id)
    } finally {
      await closePlayers([guest])
    }
  })
})
