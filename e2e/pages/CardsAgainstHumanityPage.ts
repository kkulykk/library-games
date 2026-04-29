import { expect, type Locator, type Page } from '@playwright/test'
import { RoomLobbyPage } from './RoomLobbyPage'

export class CardsAgainstHumanityPage extends RoomLobbyPage {
  constructor(page: Page) {
    super(page, 'cards-against-humanity')
  }

  get status(): Locator {
    return this.page.getByTestId('cah-status')
  }

  get hand(): Locator {
    return this.page.getByTestId('cah-hand-card')
  }

  get submitCardButton(): Locator {
    return this.page.getByTestId('cah-submit-card')
  }

  get faceDownSubmissions(): Locator {
    return this.page.getByTestId('cah-face-down-submission')
  }

  get revealedSubmissions(): Locator {
    return this.page.getByTestId('cah-revealed-submission')
  }

  get revealNextButton(): Locator {
    return this.page.getByTestId('cah-reveal-next')
  }

  get roundWinner(): Locator {
    return this.page.getByTestId('cah-round-winner')
  }

  get scoreboard(): Locator {
    return this.page.getByTestId('cah-scoreboard')
  }

  get nextRoundButton(): Locator {
    return this.page.getByTestId('cah-next-round')
  }

  async pickAndSubmit(cardIndex = 0): Promise<void> {
    await this.hand.nth(cardIndex).click()
    await this.submitCardButton.click()
  }

  async revealAllSubmissions(): Promise<void> {
    const count = await this.faceDownSubmissions.count()
    for (let index = 0; index < count; index += 1) {
      // The reveal button has a continuous bobbing CSS animation, so it never
      // satisfies Playwright's stability check. Force-click is the right call
      // here — it's an animation-shape problem, not a visibility/overlap one.
      await this.revealNextButton.click({ force: true })
    }
    await expect(this.revealedSubmissions).toHaveCount(count)
  }

  async pickWinner(submissionIndex: number): Promise<void> {
    await this.revealedSubmissions.nth(submissionIndex).click()
  }

  async advanceRound(): Promise<void> {
    await this.nextRoundButton.click()
  }

  async expectStatus(text: RegExp | string): Promise<void> {
    await expect(this.status).toContainText(text)
  }
}
