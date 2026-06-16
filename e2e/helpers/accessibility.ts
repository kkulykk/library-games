import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

export async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze()

  expect(results.violations).toEqual([])
}
