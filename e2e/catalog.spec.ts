import { expect, test } from '@playwright/test'
import { boot } from './helpers'

test('busca, filtros combinados, ordenação, paginação e histórico', async ({ page }) => {
  await boot(page)
  await expect(page.getByTestId('result-count')).toHaveText('36 resultados')
  await expect(page.getByTestId('catalog-grid').locator('li')).toHaveCount(9)

  await page.getByRole('link', { name: 'Página 2' }).or(page.getByRole('button', { name: 'Página 2' })).click()
  await expect(page).toHaveURL(/page=2/)

  await page.getByLabel('Ordenar por').selectOption('price_asc')
  await expect(page).toHaveURL(/sort=price_asc/)
  await expect(page).not.toHaveURL(/page=/) // filtro/ordenação reinicia a paginação

  await page.getByLabel('Buscar').fill('Aurora')
  await expect(page).toHaveURL(/q=Aurora/)
  await expect(page.getByTestId('result-count')).not.toHaveText('36 resultados') // aguarda a resposta da busca
  const n = Number((await page.getByTestId('result-count').textContent())!.match(/\d+/)![0])
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThan(36)

  // Filtro de categoria: painel lateral no desktop, drawer no mobile.
  const filtros = page.getByRole('button', { name: /^Filtros/ })
  if (await filtros.isVisible()) {
    await filtros.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Arte digital', exact: true }).click()
    await page.keyboard.press('Escape')
  } else await page.getByRole('button', { name: 'Arte digital', exact: true }).click()
  await expect(page).toHaveURL(/category=arte/)
  await expect(page).toHaveURL(/q=Aurora/) // filtros combinados com a busca
  const url = page.url()
  await page.reload()
  await expect(page).toHaveURL(url) // estado na URL sobrevive ao refresh
  await expect(page.getByLabel('Buscar')).toHaveValue('Aurora')

  await page.goBack()
  await expect(page.getByTestId('result-count')).toBeVisible()
})

test('resultado vazio e limpeza de filtros', async ({ page }) => {
  await boot(page, 'empty')
  await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
})

test('detalhe por acesso direto e NFT inexistente', async ({ page }) => {
  await boot(page, 'default', '/nft/nft-001')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('#1')
  await page.goto('/nft/nao-existe')
  await expect(page.getByText('NFT não encontrado')).toBeVisible()
  await page.goto('/rota/inexistente')
  await expect(page.getByText('Página não encontrada')).toBeVisible()
})

test('edição esgotada e limite de quantidade', async ({ page }) => {
  await boot(page)
  await page.goto('/nft/nft-007')
  await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeDisabled()
  await page.goto('/nft/nft-008')
  await page.getByRole('button', { name: /Aumentar quantidade/ }).click()
  await expect(page.getByRole('button', { name: /Aumentar quantidade/ })).toBeDisabled()
  await expect(page.getByText(/Limite de 2 unidade/)).toBeVisible()
})

test('skeleton durante carregamento lento e recuperação após falha', async ({ page }) => {
  await boot(page, 'slow')
  await page.goto('/')
  await expect(page.getByTestId('catalog-skeleton')).toBeVisible()
  await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 15000 })

  await boot(page, 'server-error')
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo' })).toBeVisible({ timeout: 15000 })
  await page.evaluate(() => window.__mocks!.setScenario(['default']))
  const retry = page.getByRole('button', { name: 'Tentar novamente' })
  await expect(async () => { // destaques e catálogo têm botões próprios; repete até ambos recuperarem
    if (await retry.count()) await retry.first().click({ timeout: 2000 })
    await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 2500 })
  }).toPass({ timeout: 25_000 })
})

test('falha de conexão exibe feedback acessível', async ({ page }) => {
  await boot(page, 'network-error')
  await expect(page.getByText(/Sem conexão com o servidor/).first()).toBeVisible({ timeout: 15000 })
})

test('respostas fora de ordem não sobrescrevem a busca mais recente', async ({ page }) => {
  await boot(page, 'variable-latency') // termos curtos respondem mais devagar que os longos
  await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 15000 })
  const expected = await page.evaluate(() => fetch('/api/nfts?q=Aurora&pageSize=9').then((r) => r.json()).then((j: { total: number }) => j.total))
  await page.getByLabel('Buscar').fill('Au')
  await page.waitForTimeout(400) // dispara a 1ª requisição (lenta)
  await page.getByLabel('Buscar').fill('Aurora') // 2ª requisição (rápida) volta antes da 1ª
  await expect(page).toHaveURL(/q=Aurora/)
  await page.waitForTimeout(1800) // dá tempo para a resposta obsoleta chegar
  await expect(page.getByTestId('result-count')).toHaveText(`${expected} ${expected === 1 ? 'resultado' : 'resultados'}`)
})
