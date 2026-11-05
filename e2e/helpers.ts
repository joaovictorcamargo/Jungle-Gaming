import { expect, type Page } from '@playwright/test'

/** Cada teste parte de um estado isolado: contexto novo (storage vazio) + reset do banco simulado. */
export async function boot(page: Page, scenario = 'default', path = '/') {
  await page.addInitScript(() => { try { sessionStorage.setItem('e2e', '1') } catch { /* noop */ } })
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}scenario=${scenario}`)
  await page.waitForFunction(() => !!window.__mocks)
  await page.evaluate(async (s) => { await window.__mocks!.reset(s.split(',')) }, scenario)
  await page.goto(path)
  await page.waitForFunction(() => !!window.__mocks)
}

export async function login(page: Page, email = 'ana@example.com', password = 'Senha@123') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
}

export async function waitSocket(page: Page) {
  await page.waitForFunction(() => !!window.__mocks)
  await expect.poll(() => page.evaluate(() => window.__mocks!.socketConnections())).toBeGreaterThan(0)
  await page.waitForTimeout(250) // subscribe + reconciliação inicial
}

export async function addToCart(page: Page, nftId: string, qty = 1) {
  await page.goto(`/nft/${nftId}`)
  for (let i = 1; i < qty; i++) await page.getByRole('button', { name: /Aumentar quantidade/ }).click()
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.getByText('Adicionado ao carrinho.')).toBeVisible()
}
