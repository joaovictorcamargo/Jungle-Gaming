# KURIO · Marketplace de NFTs — Desafio Frontend (Jungle Gaming)

Marketplace de NFTs em **React + TypeScript** com descoberta, compra e conta do colecionador, versões desktop/mobile,
**MSW** (REST + Socket.IO), **TanStack Router/Query**, **Axios**, **Tailwind + shadcn/ui (Radix)**, **Playwright** e **Lighthouse**.
Tudo roda com dados simulados: não há backend, blockchain, carteira ou gateway reais.
O visual segue o arquivo do Figma (marca KURIO, tokens da coleção *Design Tokens*, Roboto Mono e os retratos de NFT do próprio arquivo).

| Responsabilidade | Tecnologia |
|---|---|
| Interface / linguagem | React 19 · TypeScript (strict) |
| Rotas e parâmetros de busca | TanStack Router |
| Estado remoto | TanStack Query |
| HTTP | Axios (`src/api/client.ts`) |
| Tempo real | `socket.io-client` (real) |
| Estilo / componentes | Tailwind CSS 4 · padrão shadcn/ui (Radix + `cva`) em `src/components/ui` |
| Mocking | MSW 2 + `@mswjs/socket.io-binding` |
| E2E e regressão visual | Playwright (Chromium) |
| Performance | Lighthouse |

## Setup

```bash
npm ci
npm run dev        # desenvolvimento com mocks (http://localhost:5173)
npm run build      # typecheck + build de produção COM mocks (build de demonstração)
npm run preview    # serve dist/ em http://localhost:4173
npm run typecheck && npm run lint
npm run test:e2e   # builda, sobe o preview e roda Playwright (desktop 1440 + mobile 390)
npm run lighthouse # requer `npm run preview` ativo; escreve lighthouse/reports/
```

Requisitos: Node ≥ 20. Para Playwright: `npx playwright install chromium`. Em ambientes sem acesso ao CDN,
use `CHROMIUM_PATH=/caminho/chrome npm run test:e2e` e `CHROME_PATH=/caminho/chrome npm run lighthouse`.

### Variáveis de ambiente
| Variável | Padrão | Uso |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` nos scripts `dev`/`build` | Liga a camada MSW (REST + Socket.IO). Inclusive na build publicada. |
| `CHROMIUM_PATH` | — | Chromium alternativo para o Playwright. |
| `CHROME_PATH` | — | Chrome alternativo para o Lighthouse. |
| `AUDIT_URL`, `AUDIT_RUNS` | `http://localhost:4173`, `3` | Parâmetros da auditoria. |

## Credenciais fictícias
| Usuário | E-mail | Senha |
|---|---|---|
| Ana (carteiras principal e secundária, favorito `nft-002`) | `ana@example.com` | `Senha@123` |
| Bruno (uma carteira, sem favoritos) | `bruno@example.com` | `Senha@456` |

Senhas são guardadas como hash SHA-256 com salt no banco simulado; nunca em claro.
Cupons: `WELCOME10` (10%), `COLLECTOR25` (25%), `EXPIRED10` (expirado). CPF aceita qualquer número de 11 dígitos.

## Cenários dos mocks (seleção e reset)
Os cenários são **determinísticos** (sem `Math.random`), combináveis e persistem no `localStorage` para sobreviver a refresh.

- **Pela URL:** `/?scenario=payment-declined` ou combinando `/?scenario=slow,order-timeout`. A URL reinicia o contador de falhas do cenário.
- **Pelo console** (`window.__mocks`): `__mocks.setScenario(['price-changed'])`, `await __mocks.reset(['default'])` (restaura integralmente o banco e o cenário), `__mocks.scenarios` (lista).

| Cenário | O que simula |
|---|---|
| `default` | Sucesso, latência 80–200 ms, pedido confirmado após 1,5 s |
| `empty` | Catálogo vazio |
| `slow` | Latência fixa de 1,8 s (skeletons) |
| `variable-latency` | Latência variável e **respostas fora de ordem** na busca |
| `network-error` | Falha de conexão (`Failed to fetch`) no catálogo |
| `server-error` | HTTP 500 no catálogo |
| `flaky-catalog` | 503 nas 3 primeiras chamadas, depois recupera |
| `session-expired` | Sessões vivem 15 s → `401 session_expired` |
| `favorite-failure` | A primeira mutation de favorito falha (rollback) |
| `payment-declined` | Pedido termina `declined` |
| `order-timeout` | O pedido **é criado**, mas a resposta nunca chega; reenvio recupera o mesmo pedido pela chave de idempotência |
| `price-changed` | Preço muda durante a compra → `409 quote_changed` |
| `sold-out` | Edição esgota durante a compra → `409 availability_conflict` |
| `wallet-rejected` | A carteira recusa a conexão |
| `slow-settle` | Pedido fica pendente por 6 s |

Controles adicionais para demonstração/testes (todos passam pelo `socket.io-client` real): `__mocks.updateNft(id, {price, editions})`
(altera o banco e emite `nft.updated`), `duplicateNftEvent`, `staleNftEvent`, `disconnectSocket`/`reconnectSocket`, `expireSessions`, `settleOrders`.

### Reproduzindo os fluxos de falha
1. Falha de rede/5xx: abra `/?scenario=network-error` → mensagem de erro + "Tentar novamente"; no console `__mocks.setScenario(['default'])` e clique em tentar novamente.
2. Sessão expirada: `__mocks.expireSessions()` e navegue → volta ao login e **retorna à tela anterior** após entrar.
3. Pedido duplicado/timeout: `?scenario=order-timeout` → monte um pedido e confirme; após o aviso, "Tentar novamente (sem duplicar)" recupera o mesmo pedido.
4. Preço alterado em tempo real: com um item no checkout revisado, `__mocks.updateNft('nft-009', {price:'7.77'})` → banner exige nova confirmação.
5. Interrupção de conexão com pedido pendente: `?scenario=slow-settle`, confirme a compra, `__mocks.disconnectSocket()`, recarregue a página, `__mocks.reconnectSocket()`.

## Testes
`npm run test:e2e` executa **35 testes × 2 viewports (desktop 1440×900, mobile 390×844)** = 70 execuções, incluindo 4 de regressão visual por viewport.
Cada teste reinicia o banco simulado e parte de storage vazio. Relatório HTML em `playwright-report/` (`npm run test:e2e:report`);
traces/screenshots das falhas em `test-results/`. Baselines em `e2e/visual.spec.ts-snapshots/` (Linux/Chromium; para outro SO use `npm run test:e2e:update`).

Cobertura: busca/filtros combinados/ordenação/paginação/histórico · detalhe direto e inexistente · cadastro/login/expiração/logout/troca de usuário ·
favoritos com falha e rollback · carrinho (quantidades, remoção, cupom, refresh, login) · compra completa · pagamento recusado · clique repetido ·
timeout + idempotência · perfil, avatar, senha, carteiras · preço/disponibilidade via Socket.IO · eventos duplicados/antigos · desconexão e retomada de pedido pendente ·
teclado, foco em dialog, erros de formulário, overflow em 390/768/1440 · skeletons e recuperação · respostas fora de ordem · expiração de sessão durante o checkout com retomada.

## Lighthouse
`lighthouse/run.mjs` (versionado) audita Início e Detalhe, perfis mobile e desktop, **3 execuções cada** e reporta a mediana.
Relatórios HTML/JSON por execução e `summary.json` (versões, ambiente) em `lighthouse/reports/`. Resultados e análise em [ARCHITECTURE.md](./ARCHITECTURE.md#performance-lighthouse).

Medianas atuais: desktop Início **100**, Detalhe **99**; mobile Início **78**, Detalhe **81** (abaixo da meta de 90; causa e tentativas documentadas). Accessibility, Best Practices e SEO: **100** em todas.

## Deploy
A build publicada inclui o service worker do MSW (`/mockServiceWorker.js`) e o Socket.IO simulado, então todos os fluxos (inclusive tempo real) funcionam em produção sem backend.

- **Vercel:** `npx vercel --prod` na raiz (ou importar o repositório: framework *Vite*, `npm run build`, saída `dist`). `vercel.json` já define o fallback de SPA e o cache de assets.
- **Netlify (sem CLI):** `npm ci && npm run build` e arraste a pasta `dist/` em <https://app.netlify.com/drop>. O arquivo `public/_redirects` (copiado para `dist/`) faz o fallback `/* → /index.html 200`; arquivos existentes, como o service worker, continuam sendo servidos diretamente.
- **GitHub Pages (publicação atual):** `npm run build:pages` gera `dist-pages/` com caminho-base `/Jungle-Gaming/`, `404.html` (fallback de SPA para acesso direto e refresh) e `.nojekyll`; o conteúdo vai para o branch `gh-pages`. Todos os caminhos públicos (imagens, service worker do MSW, rotas) respeitam `import.meta.env.BASE_URL` (`src/lib/base.ts`). No GitHub Pages, rotas acessadas diretamente respondem com status 404 servindo a app (limitação da plataforma); a navegação funciona normalmente.
- **Cloudflare Pages:** mesmo comando de build, saída `dist`; o `_redirects` também é respeitado.

URL pública: **https://joaovictorcamargo.github.io/Jungle-Gaming/**

## Documentação
Contratos REST e de eventos, política de sessão, carrinho, cache, reconciliação REST × Socket.IO, limitações e desvios do Figma: **[ARCHITECTURE.md](./ARCHITECTURE.md)**.
