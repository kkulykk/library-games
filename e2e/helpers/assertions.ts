import { expect, type Locator, type Page } from '@playwright/test'

const ROOM_CODE_PATTERN = /[A-Z0-9]{4}/

export function playerNameInput(page: Page): Locator {
  return page.getByTestId('player-name-input')
}

export function roomCodeInput(page: Page): Locator {
  return page.getByTestId('room-code-input')
}

export function roomCodeDisplay(page: Page): Locator {
  return page.getByTestId('room-code')
}

export function playerRoster(page: Page): Locator {
  return page.getByTestId('player-roster')
}

export async function readInviteLink(page: Page): Promise<string> {
  const inviteLink = await page.getByTestId('invite-link').getAttribute('data-invite-link')

  if (!inviteLink) {
    throw new Error('Could not find invite link data attribute')
  }

  return inviteLink
}

export async function readRoomCode(page: Page): Promise<string> {
  const text = (await roomCodeDisplay(page).innerText()).trim()
  const match = text.match(ROOM_CODE_PATTERN)

  if (!match) {
    throw new Error(`Could not find a 4-character room code in: ${text}`)
  }

  return match[0]
}

async function clickFirstVisible(locator: Locator): Promise<boolean> {
  const count = await locator.count()

  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index)

    if (await candidate.isVisible()) {
      await candidate.click()
      return true
    }
  }

  return false
}

async function clickCreateRoom(page: Page): Promise<void> {
  if (await clickFirstVisible(page.getByTestId('create-room-button'))) {
    return
  }

  await page
    .getByRole('button', { name: /create room/i })
    .first()
    .click({ force: true })
}

export async function createRoom(page: Page, playerName: string): Promise<string> {
  const playButton = page.getByTestId('play-game-button')

  if (await playButton.isVisible().catch(() => false)) {
    await playButton.click()
  }

  await clickCreateRoom(page)
  await playerNameInput(page).fill(playerName)
  await clickCreateRoom(page)
  await expect(roomCodeDisplay(page)).toBeVisible()

  return readRoomCode(page)
}

export async function joinRoom(page: Page, roomCode: string, playerName: string): Promise<void> {
  const playButton = page.getByTestId('play-game-button')

  if (await playButton.isVisible().catch(() => false)) {
    await playButton.click()
  }

  await page.getByTestId('join-room-button').filter({ visible: true }).first().click()
  await playerNameInput(page).fill(playerName)
  await roomCodeInput(page).fill(roomCode)
  await page.getByTestId('join-room-button').filter({ visible: true }).last().click()
  await expect(roomCodeDisplay(page)).toBeVisible()
}

export async function expectPlayerVisible(page: Page, playerName: string): Promise<void> {
  await expect(playerRoster(page)).toContainText(playerName)
}

export async function startGame(page: Page): Promise<void> {
  const startButton = page.getByTestId('start-game-button')
  await expect(startButton).toBeVisible()
  await startButton.click()
  await expect(startButton).toBeHidden()
}
