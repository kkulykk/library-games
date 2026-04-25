import type { Browser, BrowserContext, Page } from '@playwright/test'

export interface TestPlayer {
  name: string
  context: BrowserContext
  page: Page
}

export async function createPlayer(browser: Browser, name: string): Promise<TestPlayer> {
  const context = await browser.newContext()
  const page = await context.newPage()

  return { name, context, page }
}

export async function closePlayers(players: TestPlayer[]): Promise<void> {
  await Promise.all(players.map((player) => player.context.close()))
}
