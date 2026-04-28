import { expect, test } from '../helpers/fakeSupabase'
import { games } from '../../src/data/games'

const singlePlayerGames = games.filter(
  (game) => game.status === 'live' && game.category === 'single-player'
)

test.describe('single-player game smoke coverage', () => {
  for (const game of singlePlayerGames) {
    test(`${game.slug} loads and renders its primary game surface`, async ({ page }) => {
      await page.goto(`/library-games/games/${game.slug}`)

      await expect(page.getByRole('heading', { name: game.title })).toBeVisible()
      const playButton = page.getByTestId('play-game-button')
      if (await playButton.isVisible().catch(() => false)) {
        await playButton.click()
      }
      if (game.slug === 'tic-tac-toe') {
        await page.getByRole('button', { name: /vs computer/i }).click()
      }
      await expect(page.getByTestId(`${game.slug}-board`)).toBeVisible()
    })
  }
})
