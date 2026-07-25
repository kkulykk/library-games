import { expect, type Locator, type Page } from '@playwright/test'
import { RoomLobbyPage } from './RoomLobbyPage'

export class GlobetrotterPage extends RoomLobbyPage {
  constructor(page: Page) {
    super(page, 'globetrotter')
  }

  get soloButton(): Locator {
    return this.page.getByTestId('globetrotter-solo-button')
  }

  get scouting(): Locator {
    return this.page.getByTestId('globetrotter-scouting')
  }

  get pano(): Locator {
    return this.page.getByTestId('globetrotter-pano')
  }

  get panoLoading(): Locator {
    return this.page.getByTestId('globetrotter-pano-loading')
  }

  get mapExpandButton(): Locator {
    return this.page.getByTestId('globetrotter-map-expand')
  }

  get mapDock(): Locator {
    return this.page.getByTestId('globetrotter-mapdock')
  }

  get revealDistance(): Locator {
    return this.page.getByTestId('globetrotter-reveal-distance')
  }

  get revealPlace(): Locator {
    return this.page.getByTestId('globetrotter-reveal-place')
  }

  get status(): Locator {
    return this.page.getByTestId('globetrotter-status')
  }

  get clues(): Locator {
    return this.page.getByTestId('globetrotter-clues')
  }

  get map(): Locator {
    return this.page.getByTestId('globetrotter-map')
  }

  get mapTarget(): Locator {
    return this.page.getByTestId('globetrotter-map-target')
  }

  get lockGuessButton(): Locator {
    return this.page.getByTestId('globetrotter-lock-guess')
  }

  get waiting(): Locator {
    return this.page.getByTestId('globetrotter-waiting')
  }

  get reveal(): Locator {
    return this.page.getByTestId('globetrotter-reveal')
  }

  get roundScore(): Locator {
    return this.page.getByTestId('globetrotter-round-score')
  }

  get leaderboard(): Locator {
    return this.page.getByTestId('globetrotter-leaderboard')
  }

  get nextRoundButton(): Locator {
    return this.page.getByTestId('globetrotter-next-round')
  }

  get finishedBanner(): Locator {
    return this.page.getByTestId('globetrotter-finished')
  }

  get finalLeaderboard(): Locator {
    return this.page.getByTestId('globetrotter-final-leaderboard')
  }

  get soloTotal(): Locator {
    return this.page.getByTestId('globetrotter-solo-total')
  }

  get exitSoloButton(): Locator {
    return this.page.getByTestId('globetrotter-exit-solo')
  }

  async startSolo(): Promise<void> {
    await this.dismissPlayGate()
    await this.soloButton.click()
    await expect(this.map).toBeVisible()
  }

  /** The map docks as a minimap; pins can only be dropped once it is popped out. */
  async expandMap(): Promise<void> {
    if (await this.mapExpandButton.isVisible()) {
      await this.mapExpandButton.click()
      await expect(this.mapExpandButton).toBeHidden()
    }
  }

  /** Click the map at a fractional position (0..1 of the rendered width/height). */
  async clickMap(xFraction = 0.5, yFraction = 0.5): Promise<void> {
    await this.expandMap()
    const box = await this.map.boundingBox()
    if (!box) throw new Error('Globetrotter map is not visible')
    await this.map.click({
      position: { x: box.width * xFraction, y: box.height * yFraction },
    })
  }

  async placeAndLockGuess(xFraction = 0.5, yFraction = 0.5): Promise<void> {
    await this.clickMap(xFraction, yFraction)
    await expect(this.lockGuessButton).toBeEnabled()
    await this.lockGuessButton.click()
  }

  async advanceRound(): Promise<void> {
    await this.nextRoundButton.click()
  }

  async expectStatus(text: RegExp | string): Promise<void> {
    await expect(this.status).toContainText(text)
  }
}
