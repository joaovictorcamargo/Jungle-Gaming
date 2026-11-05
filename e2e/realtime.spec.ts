import { expect, test } from '@playwright/test'
import { addToCart, boot, waitSocket } from './helpers'

test('nft.updated atualiza detalhe e carrinho, ignora duplicado e evento antigo', async ({ page }) => {
  await boot(page)
  await waitSocket(page)
  await addToCart(page, 'nft-014')
  await page.goto('/carrinho')
  const total = await page.getByTestId('summary-total').textContent()
  await page.evaluate(() => window.__mocks!.updateNft('nft-014', { price: '4.2' }))
  await expect(page.getByText(/O preço de .* mudou para 4\.20 ETH/)).toBeVisible() // feedback acessível
  await expect(page.getByTestId('summary-total')).not.toHaveText(total!)
  const after = await page.getByTestId('summary-total').textContent()

  await page.evaluate(() => { window.__mocks!.duplicateNftEvent('nft-014'); window.__mocks!.staleNftEvent('nft-014', '9.99') })
  await page.waitForTimeout(600)
  await expect(page.getByTestId('summary-total')).toHaveText(after!) // sem regressão nem reaplicação

  await page.goto('/nft/nft-014')
  await expect(page.getByTestId('detail-price')).toHaveText('4.20 ETH')
  await page.evaluate(() => window.__mocks!.staleNftEvent('nft-014', '9.99'))
  await page.waitForTimeout(400)
  await expect(page.getByTestId('detail-price')).toHaveText('4.20 ETH')
})

test('disponibilidade reduzida no carrinho é sinalizada', async ({ page }) => {
  await boot(page)
  await waitSocket(page)
  await addToCart(page, 'nft-015', 2)
  await page.goto('/carrinho')
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await page.evaluate(() => window.__mocks!.updateNft('nft-015', { editions: [{ id: 'standard', available: 1 }] }))
  await expect(page.getByText(/Restam apenas 1/)).toBeVisible()
  await expect(page.getByRole('button', { name: /e finalizar/ })).toBeDisabled()
})

test('reconexão reconcilia com a API REST', async ({ page }) => {
  await boot(page)
  await waitSocket(page)
  await page.goto('/nft/nft-016')
  await waitSocket(page)
  await page.evaluate(() => { window.__mocks!.disconnectSocket() })
  await expect(page.getByText(/Reconectando às atualizações/)).toBeVisible()
  await page.evaluate(() => { window.__mocks!.setScenario(['default']); window.__mocks!.updateNft('nft-016', { price: '3.33' }) }) // evento perdido durante a queda
  await page.evaluate(() => window.__mocks!.reconnectSocket())
  await expect(page.getByTestId('detail-price')).toHaveText('3.33 ETH', { timeout: 15000 })
})
