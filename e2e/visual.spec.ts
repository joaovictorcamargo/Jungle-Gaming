import { expect, test } from '@playwright/test'
import { addToCart, boot, login } from './helpers'

// Regressão visual: dados estáveis (fixtures determinísticas) e movimento reduzido.
test.use({ reducedMotion: 'reduce' })

test('início', async ({ page }) => {
  await boot(page)
  await expect(page.getByTestId('catalog-grid')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('home.png', { fullPage: false })
})

test('detalhe', async ({ page }) => {
  await boot(page, 'default', '/nft/nft-001')
  await expect(page.getByTestId('detail-price')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('detail.png')
})

test('carrinho', async ({ page }) => {
  await boot(page)
  await addToCart(page, 'nft-001')
  await page.goto('/carrinho')
  await expect(page.getByTestId('cart-line')).toBeVisible()
  await expect(page.getByTestId('summary-total')).toBeVisible()
  await expect(page).toHaveScreenshot('cart.png')
})

test('pagamento', async ({ page }) => {
  await boot(page)
  await login(page)
  await addToCart(page, 'nft-001')
  await page.goto('/checkout')
  await expect(page.getByTestId('summary-total')).toBeVisible()
  await expect(page).toHaveScreenshot('checkout.png', { mask: [page.getByLabel('Nome de exibição'), page.getByLabel('E-mail')] })
})
