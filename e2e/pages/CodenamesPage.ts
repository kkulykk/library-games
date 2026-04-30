import { expect, type Locator, type Page } from '@playwright/test'
import { RoomLobbyPage } from './RoomLobbyPage'

export class CodenamesPage extends RoomLobbyPage {
  constructor(page: Page) {
    super(page, 'codenames')
  }

  get status(): Locator {
    return this.page.getByTestId('codenames-status')
  }

  get boardCards(): Locator {
    return this.page.getByTestId('codenames-board-card')
  }

  get clueInput(): Locator {
    return this.page.getByTestId('codenames-clue-input')
  }

  get clueCount(): Locator {
    return this.page.getByTestId('codenames-clue-count')
  }

  get sendClueButton(): Locator {
    return this.page.getByTestId('codenames-send-clue')
  }

  get redRemaining(): Locator {
    return this.page.getByTestId('codenames-red-remaining')
  }

  get log(): Locator {
    return this.page.getByTestId('codenames-log')
  }

  get finishedBanner(): Locator {
    return this.page.getByTestId('codenames-finished')
  }

  async giveClue(word: string, count: string): Promise<void> {
    await this.clueInput.fill(word)
    await this.clueCount.selectOption(count)
    await this.sendClueButton.click()
  }

  async revealCard(index: number): Promise<void> {
    await this.boardCards.nth(index).click()
  }

  async expectStatus(text: RegExp | string): Promise<void> {
    await expect(this.status).toContainText(text)
  }

  async expectFinished(text: RegExp | string): Promise<void> {
    await expect(this.finishedBanner).toContainText(text)
  }
}
