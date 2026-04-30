import { expect, type Locator, type Page } from '@playwright/test'
import { RoomLobbyPage } from './RoomLobbyPage'

export class AgarioPage extends RoomLobbyPage {
  constructor(page: Page) {
    super(page, 'agario')
  }

  get canvas(): Locator {
    return this.page.getByTestId('agario-canvas')
  }

  get leaderboard(): Locator {
    return this.page.getByTestId('agario-leaderboard')
  }

  get finishedBanner(): Locator {
    return this.page.getByTestId('agario-finished')
  }

  get finalScores(): Locator {
    return this.page.getByTestId('agario-final-scores')
  }

  async expectInGame(): Promise<void> {
    await expect(this.canvas).toBeVisible()
  }

  async expectLeaderboardContains(name: string, options?: { timeout?: number }): Promise<void> {
    await expect(this.leaderboard).toContainText(name, options)
  }

  async expectFinished(text: RegExp | string): Promise<void> {
    await expect(this.finishedBanner).toContainText(text)
  }

  async expectFinalScoreContains(name: string): Promise<void> {
    await expect(this.finalScores).toContainText(name)
  }
}
