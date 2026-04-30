import { expect, type Locator, type Page } from '@playwright/test'
import { gotoGame } from '../helpers/navigation'

const ROOM_CODE_PATTERN = /[A-Z0-9]{4}/

export type MultiplayerSlug =
  | 'skribbl'
  | 'uno'
  | 'codenames'
  | 'agario'
  | 'cards-against-humanity'
  | 'mindmeld'

export class RoomLobbyPage {
  readonly page: Page
  readonly slug: MultiplayerSlug

  constructor(page: Page, slug: MultiplayerSlug) {
    this.page = page
    this.slug = slug
  }

  private get playButton(): Locator {
    return this.page.getByTestId('play-game-button')
  }

  private get createRoomButton(): Locator {
    return this.page.getByTestId('create-room-button').filter({ visible: true })
  }

  private get joinRoomButton(): Locator {
    return this.page.getByTestId('join-room-button').filter({ visible: true })
  }

  get nameInput(): Locator {
    return this.page.getByTestId('player-name-input')
  }

  get codeInput(): Locator {
    return this.page.getByTestId('room-code-input')
  }

  get roomCodeDisplay(): Locator {
    return this.page.getByTestId('room-code')
  }

  get playerRoster(): Locator {
    return this.page.getByTestId('player-roster')
  }

  get startButton(): Locator {
    return this.page.getByTestId('start-game-button')
  }

  get leaveButton(): Locator {
    return this.page.getByTestId('leave-room-button')
  }

  get errorBanner(): Locator {
    return this.page.getByTestId('room-error')
  }

  async goto(): Promise<void> {
    await gotoGame(this.page, this.slug)
  }

  async dismissPlayGate(): Promise<void> {
    if (await this.playButton.isVisible().catch(() => false)) {
      await this.playButton.click()
    }
  }

  async createRoom(playerName: string): Promise<string> {
    await this.dismissPlayGate()
    await this.createRoomButton.first().click()
    await this.nameInput.fill(playerName)
    await this.createRoomButton.first().click()
    await expect(this.roomCodeDisplay).toBeVisible()
    return this.readRoomCode()
  }

  async joinRoom(roomCode: string, playerName: string): Promise<void> {
    await this.dismissPlayGate()
    await this.joinRoomButton.first().click()
    await this.nameInput.fill(playerName)
    await this.codeInput.fill(roomCode)
    await this.joinRoomButton.last().click()
    await expect(this.roomCodeDisplay).toBeVisible()
  }

  async joinRoomExpectingError(roomCode: string, playerName: string): Promise<void> {
    await this.dismissPlayGate()
    await this.joinRoomButton.first().click()
    await this.nameInput.fill(playerName)
    await this.codeInput.fill(roomCode)
    await this.joinRoomButton.last().click()
  }

  async startGame(): Promise<void> {
    await expect(this.startButton).toBeVisible()
    await this.startButton.click()
    await expect(this.startButton).toBeHidden()
  }

  async leaveRoom(): Promise<void> {
    await this.leaveButton.click()
  }

  async expectPlayerVisible(playerName: string): Promise<void> {
    await expect(this.playerRoster).toContainText(playerName)
  }

  async expectPlayerNotVisible(playerName: string): Promise<void> {
    await expect(this.playerRoster).not.toContainText(playerName)
  }

  async expectError(text: RegExp | string): Promise<void> {
    await expect(this.errorBanner).toContainText(text)
  }

  async expectAtEntry(): Promise<void> {
    await expect(this.createRoomButton.first()).toBeVisible()
    await expect(this.roomCodeDisplay).toHaveCount(0)
  }

  async readInviteLink(): Promise<string> {
    const inviteLink = await this.page.getByTestId('invite-link').getAttribute('data-invite-link')
    if (!inviteLink) {
      throw new Error('Could not find invite link data attribute')
    }
    return inviteLink
  }

  async readRoomCode(): Promise<string> {
    const text = (await this.roomCodeDisplay.innerText()).trim()
    const match = text.match(ROOM_CODE_PATTERN)
    if (!match) {
      throw new Error(`Could not find a 4-character room code in: ${text}`)
    }
    return match[0]
  }
}
