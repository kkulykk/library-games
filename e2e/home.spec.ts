import { expect, test } from './helpers/fakeSupabase'
import { games } from '../src/data/games'

const liveGames = games.filter((game) => game.status === 'live')
const gameCard = (slug: string) => `[data-testid="game-card"][data-game-slug="${slug}"]`

test.describe('home catalog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/library-games')
    await page.getByRole('button', { name: /^▸ LIBRARY$/ }).click()
  })

  test('renders the full live game catalog', async ({ page }) => {
    const cards = page.getByTestId('game-card')

    await expect(cards.first()).toBeVisible()
    await expect(cards).toHaveCount(liveGames.length)

    for (const game of liveGames) {
      await expect(page.locator(gameCard(game.slug))).toContainText(game.title)
    }
  })

  test('search filters games by title', async ({ page }) => {
    await page.getByRole('searchbox', { name: /search games/i }).fill('wordle')

    const cards = page.getByTestId('game-card')
    await expect(cards).toHaveCount(1)
    await expect(page.locator(gameCard('wordle'))).toContainText('Wordle')
  })

  test('clicking a game card navigates to the game route', async ({ page }) => {
    await page.locator(gameCard('wordle')).click()

    await expect(page).toHaveURL(/\/library-games\/games\/wordle$/)
  })
})
