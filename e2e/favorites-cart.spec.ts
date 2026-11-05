import { expect, test } from '@playwright/test'
import { addToCart, boot, login } from './helpers'

test('favoritos: otimista, falha com rollback e recuperação', async ({ page }) => {
  await boot(page, 'favorite-failure')
  await login(page)
  await page.goto('/nft/nft-010')
  // Botão do próprio NFT (a página também lista "Mais desta coleção", cada card com seu favorito).
  const fav = () => page.getByRole('button', { name: /^Favoritar: Jade Monarch #10$/ })
  const unfav = () => page.getByRole('button', { name: /^Remover dos favoritos: Jade Monarch #10$/ })
  await fav().click()
  await expect(page.getByText('Não foi possível atualizar os favoritos.')).toBeVisible()
  await expect(fav()).toHaveAttribute('aria-pressed', 'false') // rollback
  await fav().click() // segunda tentativa funciona
  await expect(unfav()).toHaveAttribute('aria-pressed', 'true')
  // Aguarda a mutation ser efetivada pelos handlers MSW antes do refresh (a UI já mostra o estado otimista).
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('mock:db:v2')!).favorites.u1.includes('nft-010'))).toBe(true)
  await page.reload()
  await expect(unfav()).toBeVisible() // persistiu
})

test('carrinho: quantidades, remoção, cupom e persistência após refresh e login', async ({ page }) => {
  await boot(page)
  await addToCart(page, 'nft-001')
  await addToCart(page, 'nft-003', 2)
  await page.goto('/carrinho')
  await expect(page.getByTestId('cart-line')).toHaveCount(2)
  const total = await page.getByTestId('summary-total').textContent()

  await page.getByLabel('Código promocional').fill('INVALIDO')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('Cupom inválido.')).toBeVisible()
  await page.getByLabel('Código promocional').fill('EXPIRED10')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('Cupom expirado.')).toBeVisible()
  await page.getByLabel('Código promocional').fill('welcome10')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText(/WELCOME10.* aplicado/)).toBeVisible()
  await expect(page.getByTestId('summary-total')).not.toHaveText(total!)

  await page.reload()
  await expect(page.getByTestId('cart-line')).toHaveCount(2) // persistiu após refresh
  await page.getByRole('button', { name: /Remover Aurora|Remover / }).first().click()
  await expect(page.getByTestId('cart-line')).toHaveCount(1)

  await login(page) // itens do visitante preservados ao autenticar
  await page.goto('/carrinho')
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
})
