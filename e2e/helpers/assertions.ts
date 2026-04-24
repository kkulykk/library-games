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

export async function readRoomCode(page: Page): Promise<string> {
  const text = (await roomCodeDisplay(page).innerText()).trim()
  const match = text.match(ROOM_CODE_PATTERN)

  if (!match) {
    throw new Error(`Could not find a 4-character room code in: ${text}`)
  }

  return match[0]
}

export async function createRoom(page: Page, playerName: string): Promise<string> {
  await page.getByTestId('create-room-button').first().click()
  await playerNameInput(page).fill(playerName)
  await page.getByTestId('create-room-button').last().click()
  await expect(roomCodeDisplay(page)).toBeVisible()

  return readRoomCode(page)
}

export async function joinRoom(page: Page, roomCode: string, playerName: string): Promise<void> {
  await page.getByTestId('join-room-button').first().click()
  await playerNameInput(page).fill(playerName)
  await roomCodeInput(page).fill(roomCode)
  await page.getByTestId('join-room-button').last().click()
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
