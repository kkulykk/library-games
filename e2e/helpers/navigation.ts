import type { Page } from '@playwright/test'

export async function gotoGame(page: Page, slug: string): Promise<void> {
  await page.goto(`/games/${slug}`)
}
