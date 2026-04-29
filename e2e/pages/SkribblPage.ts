import { expect, type Locator, type Page } from '@playwright/test'
import { RoomLobbyPage } from './RoomLobbyPage'

export class SkribblPage extends RoomLobbyPage {
  constructor(page: Page) {
    super(page, 'skribbl')
  }

  get wordOptions(): Locator {
    return this.page.getByTestId('skribbl-word-option')
  }

  get drawerWord(): Locator {
    return this.page.getByTestId('skribbl-drawer-word')
  }

  get hintMask(): Locator {
    return this.page.getByTestId('skribbl-hint-mask')
  }

  get canvas(): Locator {
    return this.page.getByTestId('skribbl-canvas')
  }

  get guessInput(): Locator {
    return this.page.getByTestId('skribbl-guess-input')
  }

  get chatLog(): Locator {
    return this.page.getByTestId('skribbl-chat-log')
  }

  get scoreboard(): Locator {
    return this.page.getByTestId('skribbl-scoreboard')
  }

  get waitingPicker(): Locator {
    return this.page.getByTestId('skribbl-waiting-picker')
  }

  get roundEnd(): Locator {
    return this.page.getByTestId('skribbl-round-end')
  }

  get roundWord(): Locator {
    return this.page.getByTestId('skribbl-round-word')
  }

  get nextTurnButton(): Locator {
    return this.page.getByTestId('skribbl-next-turn-button')
  }

  async submitGuess(text: string): Promise<void> {
    await this.guessInput.fill(text)
    await this.guessInput.press('Enter')
  }

  async expectWaitingFor(name: string): Promise<void> {
    await expect(this.waitingPicker).toContainText(name)
  }

  async expectChatContains(text: string): Promise<void> {
    await expect(this.chatLog).toContainText(text)
  }

  async advanceToNextTurn(): Promise<void> {
    await this.nextTurnButton.click()
  }
}
