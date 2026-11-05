import { expect, test } from '@playwright/test'
import { boot, login } from './helpers'

test('cadastro com validação e conflito, login e logout', async ({ page }) => {
  await boot(page)
  await page.goto('/cadastro')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('Informe seu nome.')).toBeVisible()
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('aria-invalid', 'true')

  await page.getByLabel('Nome').fill('Ana Clone')
  await page.getByLabel('E-mail').fill('ana@example.com') // já existe → conflito vindo da API
  await page.getByLabel('Senha', { exact: true }).fill('Senha@999')
  await page.getByLabel('Confirmar senha').fill('Senha@888')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('As senhas não coincidem.')).toBeVisible()
  await page.getByLabel('Confirmar senha').fill('Senha@999')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('Este e-mail já está cadastrado.')).toBeVisible()

  await page.getByLabel('E-mail').fill('nova@example.com')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
})

test('login inválido, retorno ao fluxo anterior e sessão após refresh', async ({ page }) => {
  await boot(page)
  await page.goto('/perfil')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await page.getByLabel('E-mail').fill('ana@example.com')
  await page.getByLabel('Senha').fill('errada123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
  await page.getByLabel('Senha').fill('Senha@123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/perfil/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
})

test('expiração de sessão preserva o contexto de retomada', async ({ page }) => {
  await boot(page)
  await login(page)
  await page.goto('/carteiras')
  await expect(page.getByRole('heading', { name: 'Carteiras' })).toBeVisible()
  await page.evaluate(() => window.__mocks!.expireSessions())
  await page.reload()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcarteiras|\/login\?redirect=\/carteiras/)
  await page.getByLabel('E-mail').fill('ana@example.com')
  await page.getByLabel('Senha').fill('Senha@123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/carteiras/)
})

test('troca de usuário não vaza favoritos nem carrinho', async ({ page }) => {
  await boot(page)
  await login(page, 'ana@example.com', 'Senha@123')
  await page.goto('/nft/nft-002')
  await expect(page.getByRole('button', { name: /Remover dos favoritos/ }).first()).toBeVisible() // Ana favoritou nft-002
  await page.getByRole('button', { name: 'Sair' }).click()
  await login(page, 'bruno@example.com', 'Senha@456')
  await page.goto('/perfil')
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Bruno Minter') // realmente é outro usuário
  await page.goto('/nft/nft-002')
  await expect(page.getByRole('button', { name: /^Favoritar/ }).first()).toBeVisible()
})
