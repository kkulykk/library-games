import { expect, type Locator, type Page } from '@playwright/test'
import { RoomLobbyPage } from './RoomLobbyPage'

export class UnoPage extends RoomLobbyPage {
  constructor(page: Page) {
    super(page, 'uno')
  }

  get status(): Locator {
    return this.page.getByTestId('uno-status')
  }

  get hand(): Locator {
    return this.page.getByTestId('uno-hand-card')
  }

  get drawPile(): Locator {
    return this.page.getByTestId('uno-draw-pile')
  }

  get discardPile(): Locator {
    return this.page.getByTestId('uno-discard-pile')
  }

  get winnerBanner(): Locator {
    return this.page.getByTestId('uno-winner-banner')
  }

  async playCard(index: number): Promise<void> {
    await this.hand.nth(index).click()
  }

  async expectStatus(text: RegExp | string): Promise<void> {
    await expect(this.status).toContainText(text)
  }

  async expectHandSize(count: number): Promise<void> {
    await expect(this.hand).toHaveCount(count)
  }

  async expectWinnerText(text: RegExp | string): Promise<void> {
    await expect(this.winnerBanner).toContainText(text)
  }
}
