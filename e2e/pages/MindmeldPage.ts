import { expect, type Locator, type Page } from '@playwright/test'
import { RoomLobbyPage } from './RoomLobbyPage'

export class MindmeldPage extends RoomLobbyPage {
  constructor(page: Page) {
    super(page, 'mindmeld')
  }

  get status(): Locator {
    return this.page.getByTestId('mindmeld-status')
  }

  get privateTarget(): Locator {
    return this.page.getByTestId('mindmeld-private-target')
  }

  get waitingClue(): Locator {
    return this.page.getByTestId('mindmeld-waiting-clue')
  }

  get clueInput(): Locator {
    return this.page.getByTestId('mindmeld-clue-input')
  }

  get sendClueButton(): Locator {
    return this.page.getByTestId('mindmeld-send-clue')
  }

  get currentClue(): Locator {
    return this.page.getByTestId('mindmeld-current-clue')
  }

  get guessSlider(): Locator {
    return this.page.getByTestId('mindmeld-guess-slider')
  }

  get lockGuessButton(): Locator {
    return this.page.getByTestId('mindmeld-lock-guess')
  }

  get reveal(): Locator {
    return this.page.getByTestId('mindmeld-reveal')
  }

  get roundScore(): Locator {
    return this.page.getByTestId('mindmeld-round-score')
  }

  get leaderboard(): Locator {
    return this.page.getByTestId('mindmeld-leaderboard')
  }

  get nextRoundButton(): Locator {
    return this.page.getByTestId('mindmeld-next-round')
  }

  get finishedBanner(): Locator {
    return this.page.getByTestId('mindmeld-finished')
  }

  get finalLeaderboard(): Locator {
    return this.page.getByTestId('mindmeld-final-leaderboard')
  }

  async submitClue(text: string): Promise<void> {
    await this.clueInput.fill(text)
    await this.sendClueButton.click()
  }

  async submitGuess(value: string): Promise<void> {
    await this.guessSlider.fill(value)
    await this.lockGuessButton.click()
  }

  async advanceRound(): Promise<void> {
    await this.nextRoundButton.click()
  }

  async expectStatus(text: RegExp | string): Promise<void> {
    await expect(this.status).toContainText(text)
  }
}
