import { expect, test, type Page } from '@playwright/test'
import { addToCart, boot, login, waitSocket } from './helpers'

async function fillCheckout(page: Page) {
  await page.goto('/checkout')
  await page.getByLabel('CPF').fill('52998224725')
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
}

test('compra completa do catálogo ao recibo confirmado', async ({ page }) => {
  await boot(page)
  await login(page)
  await waitSocket(page)
  await addToCart(page, 'nft-001', 2)
  await addToCart(page, 'nft-002')
  await fillCheckout(page)
  const total = await page.getByTestId('summary-total').textContent()
  await page.getByRole('button', { name: /Confirmar compra/ }).click()
  await expect(page.getByTestId('order-pending')).toBeVisible()
  await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('receipt-total')).toHaveText(total!)
  await expect(page.getByTestId('tx-hash')).toContainText('0x')
  await page.goto('/carrinho')
  await expect(page.getByText('Seu carrinho está vazio')).toBeVisible() // itens comprados removidos
})

test('pagamento recusado preserva os itens', async ({ page }) => {
  await boot(page, 'payment-declined')
  await login(page)
  await addToCart(page, 'nft-004')
  await fillCheckout(page)
  await page.getByRole('button', { name: /Confirmar compra/ }).click()
  await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 15000 })
  await page.goto('/carrinho')
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
})

test('clique repetido não duplica o pedido', async ({ page }) => {
  await boot(page, 'slow-settle')
  await login(page)
  await addToCart(page, 'nft-005')
  await fillCheckout(page)
  const btn = page.getByRole('button', { name: /Confirmar compra/ })
  await btn.dblclick() // dois cliques rápidos
  await expect(page).toHaveURL(/\/pedido\//)
  await expect(page.getByTestId('order-pending').or(page.getByTestId('order-confirmed'))).toBeVisible()
  const orders = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mock:db:v2')!).idempotency).length)
  expect(orders).toBe(1)
})

test('timeout após criação recupera o mesmo pedido por idempotência', async ({ page }) => {
  await boot(page, 'order-timeout,slow-settle')
  await login(page)
  await addToCart(page, 'nft-006')
  await fillCheckout(page)
  await page.getByRole('button', { name: /Confirmar compra/ }).click()
  await expect(page.getByText(/Não recebemos resposta do servidor/)).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /Tentar novamente/ }).click()
  await expect(page.getByTestId('order-pending').or(page.getByTestId('order-confirmed'))).toBeVisible({ timeout: 15000 })
  const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('mock:db:v2')!).orders.length)
  expect(orders).toBe(1) // um único pedido apesar da repetição
})

test('preço alterado via Socket.IO durante o checkout exige nova confirmação', async ({ page }) => {
  await boot(page)
  await login(page)
  await waitSocket(page)
  await addToCart(page, 'nft-009')
  await fillCheckout(page)
  const confirmBtn = page.getByRole('button', { name: /Confirmar compra/ })
  await expect(confirmBtn).toBeEnabled()
  await page.evaluate(() => window.__mocks!.updateNft('nft-009', { price: '7.77' }))
  await expect(page.getByTestId('quote-changed')).toBeVisible()
  await expect(confirmBtn).toBeDisabled() // cotação desatualizada bloqueia
  await page.getByRole('button', { name: 'Aceitar novos valores' }).click()
  await expect(confirmBtn).toBeEnabled()
  await expect(page.getByTestId('summary-total')).toContainText('7.77')
})

test('preço alterado no servidor durante a compra (409) e edição esgotada', async ({ page }) => {
  await boot(page, 'price-changed')
  await login(page)
  await addToCart(page, 'nft-011')
  await fillCheckout(page)
  await page.getByRole('button', { name: /Confirmar compra/ }).click()
  await expect(page.getByText(/Preços ou taxas mudaram/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Confirmar compra/ })).toBeDisabled()
})

test('carteira recusa a conexão', async ({ page }) => {
  await boot(page, 'wallet-rejected')
  await login(page)
  await addToCart(page, 'nft-012')
  await page.goto('/checkout')
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText(/A carteira recusou a conexão/)).toBeVisible()
})

test('pedido pendente é recuperado após refresh e desconexão do socket', async ({ page }) => {
  await boot(page, 'slow-settle')
  await login(page)
  await waitSocket(page)
  await addToCart(page, 'nft-013')
  await fillCheckout(page)
  await page.getByRole('button', { name: /Confirmar compra/ }).click()
  await expect(page.getByTestId('order-pending')).toBeVisible()
  await page.evaluate(() => window.__mocks!.disconnectSocket())
  await expect(page.getByText(/Conexão em tempo real interrompida/)).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('order-pending').or(page.getByTestId('order-confirmed'))).toBeVisible()
  await page.evaluate(() => window.__mocks!.reconnectSocket())
  await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 20000 })
  const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('mock:db:v2')!).orders.length)
  expect(orders).toBe(1)
})

test('sessão expira durante o checkout e o contexto é retomado', async ({ page }) => {
  await boot(page)
  await login(page)
  await addToCart(page, 'nft-017')
  await page.goto('/checkout')
  await page.getByLabel('CPF').fill('52998224725')
  await page.evaluate(() => window.__mocks!.expireSessions())
  await page.getByRole('button', { name: 'Conectar carteira' }).click() // chamada autenticada → 401 session_expired
  await expect(page).toHaveURL(/\/login\?.*redirect=/)
  await expect(page.getByText(/sua sessão expirou/i).first()).toBeVisible()
  await page.getByLabel('E-mail').fill('ana@example.com')
  await page.getByLabel('Senha').fill('Senha@123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout/)
  await expect(page.getByLabel('CPF')).toHaveValue('52998224725') // rascunho preservado
  await expect(page.getByTestId('summary-total')).toBeVisible() // carrinho preservado
})
