import { expect, test } from './helpers/fakeSupabase'

test.describe('visual regression smoke coverage', () => {
  test('home catalog layout matches baseline', async ({ page }) => {
    await page.goto('/library-games')
    await page.getByRole('button', { name: /^▸ LIBRARY$/ }).click()
    await expect(page.getByTestId('game-card').first()).toBeVisible()

    await expect(page).toHaveScreenshot('home-catalog.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    })
  })

  test('wordle board layout matches baseline', async ({ page }) => {
    await page.goto('/library-games/games/wordle')
    await page.getByTestId('play-game-button').click()
    await expect(page.getByTestId('wordle-board')).toBeVisible()

    await expect(page).toHaveScreenshot('wordle-board.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    })
  })

  test('minesweeper board layout matches baseline', async ({ page }) => {
    await page.goto('/library-games/games/minesweeper')
    await page.getByTestId('play-game-button').click()
    await expect(page.getByTestId('minesweeper-board')).toBeVisible()

    await expect(page).toHaveScreenshot('minesweeper-board.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    })
  })

  test('uno setup layout matches baseline', async ({ page }) => {
    await page.goto('/library-games/games/uno')
    await page.getByTestId('play-game-button').click()
    await expect(page.getByTestId('create-room-button').first()).toBeVisible()

    await expect(page).toHaveScreenshot('uno-setup.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    })
  })
})
