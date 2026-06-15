import { test } from './helpers/fakeSupabase'
import { expectNoA11yViolations } from './helpers/accessibility'

test.describe('accessibility smoke coverage', () => {
  test('home catalog has no baseline WCAG violations', async ({ page }) => {
    await page.goto('/library-games')
    await page.getByRole('button', { name: /^▸ LIBRARY$/ }).click()
    await page.getByTestId('game-card').first().waitFor()

    await expectNoA11yViolations(page)
  })

  test('wordle board has no baseline WCAG violations', async ({ page }) => {
    await page.goto('/library-games/games/wordle')
    await page.getByTestId('play-game-button').click()
    await page.getByTestId('wordle-board').waitFor()

    await expectNoA11yViolations(page)
  })

  test('minesweeper board has no baseline WCAG violations', async ({ page }) => {
    await page.goto('/library-games/games/minesweeper')
    await page.getByTestId('play-game-button').click()
    await page.getByTestId('minesweeper-board').waitFor()

    await expectNoA11yViolations(page)
  })

  test('uno setup screen has no baseline WCAG violations', async ({ page }) => {
    await page.goto('/library-games/games/uno')
    await page.getByTestId('play-game-button').click()
    await page.getByTestId('create-room-button').first().waitFor()

    await expectNoA11yViolations(page)
  })
})
