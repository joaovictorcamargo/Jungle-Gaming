import { expect, test } from '@playwright/test'
import { boot } from './helpers'

test('navegação por teclado, foco visível e skip link', async ({ page }) => {
  await boot(page)
  await expect(page.getByTestId('catalog-grid')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Ir para o conteúdo' })).toBeFocused()
  await page.keyboard.press('Tab')
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)
  expect(outline).not.toBe('none')
})

test('menu/filtros em dialog prendem o foco e devolvem ao gatilho', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await boot(page)
  const trigger = page.getByRole('button', { name: /Filtros/ })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Filtros' })
  await expect(dialog).toBeVisible()
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true) }
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('formulários associam erros aos campos', async ({ page }) => {
  await boot(page, 'default', '/login')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  const email = page.getByLabel('E-mail')
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  const id = await email.getAttribute('aria-describedby')
  await expect(page.locator(`[id="${id}"]`)).toContainText('e-mail válido')
})

test('sem overflow horizontal em 390, 768 e 1440', async ({ page }) => {
  test.setTimeout(120_000)
  await boot(page)
  for (const w of [390, 768, 1440]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.goto('/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    for (const path of ['/', '/nft/nft-001', '/carrinho', '/login']) {
      await page.goto(path)
      await expect(page.locator('main h1').first()).toBeVisible()
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(over, `${path} @${w}`).toBeLessThanOrEqual(0)
    }
  }
})
