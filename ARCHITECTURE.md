# ARCHITECTURE

## Visão geral e estrutura
```
src/
  api/          client.ts (Axios + ApiError + interceptors) · endpoints.ts (único ponto de chamadas REST) · types.ts (contratos)
  lib/          eth.ts (decimais exatos) · query.ts (QueryClient, chaves, purge) · session.ts (store de sessão) · hooks.ts · useAuthActions.ts
  realtime/     socket.ts (cliente Socket.IO: deduplicação, versões, reconciliação)
  mocks/        db.ts (banco simulado) · handlers/ (REST) · socket.ts (Socket.IO) · scenarios.ts · data/fixtures.ts · browser.ts
  pages/        uma página por rota (carregadas sob demanda)
  features/     peças compartilhadas (cards, estados, forms, tentativa de pedido)
  components/   ui/ (shadcn/ui: Button, Field, Sheet, Skeleton, Toaster) e layout/
e2e/            Playwright · lighthouse/ auditoria · scripts/ gerador de assets
```
Camadas: **UI → hooks (TanStack Query) → `api/endpoints` (Axios) → rede**. Componentes, hooks e o cliente Axios **não contêm respostas
fictícias nem caminhos de negócio alternativos**: toda a simulação está em `src/mocks`, interceptando na rede (MSW). O app só conhece o
mock por `VITE_ENABLE_MOCKS` em `main.tsx`.

## Contratos REST (`src/api/types.ts`)
Valores em ETH trafegam como **strings decimais** (`"0.125"`); `src/lib/eth.ts` calcula em `bigint` (wei, 18 casas), sem `number`. Quantidades são inteiros.

| Recurso | Endpoints |
|---|---|
| Sessão | `POST /auth/register` · `POST /auth/login` · `GET /auth/session` · `POST /auth/logout` (expiração ⇒ `401 session_expired`) |
| NFTs | `GET /nfts?q&category&collection&network&minPrice&maxPrice&inStock&sort&page&pageSize` (eco dos parâmetros aplicados + facets: coleções, contagem por categoria e por rede, faixa de preço) · `GET /nfts/:id` (inclui `tokenId`, `attributes`, `contract`, `royaltyPercent`, `rating`, `reviews`) |
| Favoritos | `GET /favorites` · `PUT /favorites/:nftId` · `DELETE /favorites/:nftId` |
| Carrinho | `GET /cart` · `POST /cart/items` · `PATCH /cart/items` · `DELETE /cart/items/:nftId/:editionId` · `PUT/DELETE /cart/coupon` · `POST /cart/merge` |
| Cotação | `POST /quote` → linhas, subtotal, desconto, taxa de rede, total, `quoteId`, `valid`, `couponError` |
| Pedidos | `POST /orders` (**`Idempotency-Key` obrigatório**) · `GET /orders/:id` · `GET /orders/pending` |
| Perfil | `GET/PUT /profile` · `POST /profile/avatar` (multipart) · `PUT /profile/password` |
| Carteiras | `GET/POST /wallets` · `PUT /wallets/:id` · `POST /wallets/:id/connect` · `POST /wallets/:id/disconnect` |

Erros: `{ code, message, fieldErrors?, quote? }` com `422 validation_error`, `401 unauthenticated|session_expired|invalid_credentials`, `403 forbidden|wallet_rejected`,
`404 not_found`, `409 email_taken|availability_conflict|quote_changed|idempotency_conflict`, `422 coupon_invalid|coupon_expired`, `5xx transient_failure`.
O Axios converte tudo em `ApiError` (inclui `network_error` e `timeout`).

**Idempotência:** a mesma chave com o mesmo conteúdo devolve o **mesmo pedido** (`Idempotent-Replayed: true`); com conteúdo diferente ⇒ `409 idempotency_conflict`.
**Cotação como referência:** o pedido envia `quoteId` + `expectedTotal`; se o servidor recalcular algo diferente ⇒ `409 quote_changed` com a cotação nova.

## Eventos Socket.IO
| Evento | Payload | Efeito no cliente |
|---|---|---|
| `nft.updated` | `eventId, nftId, version, price, available, editions[], occurredAt` | Atualiza detalhe e listas no cache; se o NFT está em alguma cotação ativa, avisa (toast acessível) e **invalida cotação e carrinho** (o REST é a fonte da verdade do resumo) |
| `order.updated` | `eventId, orderId, userId, version, status, occurredAt` | Ignorado se `userId` ≠ usuário atual; invalida pedido/carrinho/NFTs e anuncia confirmação ou recusa |

Regras: `eventId` já visto é descartado (duplicata); `version` ≤ à conhecida é descartada (evento antigo não regride estado nem reaplica efeitos);
pedidos confirmado/recusado são terminais. Ao `connect`/reconexão o cliente emite `subscribe` (token) e **reconcilia via REST** (`invalidateQueries` de NFTs, carrinho, cotação e pedidos).
`disconnectSocket()` roda no logout/troca de usuário (`removeAllListeners` + `disconnect`).

### Transporte no ambiente de mocks e limitações
O `socket.io-client` real conecta em `ws://<origem>/ws/socket.io/` (somente transporte WebSocket). O MSW intercepta a conexão (`ws.link`) e
`@mswjs/socket.io-binding` codifica/decodifica o protocolo. O banco simulado emite os eventos quando muda (`updateNft`, resolução de pedidos), então REST e eventos
sempre refletem os mesmos dados. Limitações: sem *long-polling*, rooms, namespaces ou acks; o handshake usa `sid` fixo e a autenticação é um evento
`subscribe` (o binding não expõe `auth` do handshake); heartbeats são enviados pelo mock; **o caminho `/ws/socket.io/` é usado porque o MSW 2.15 não interceptou a URL exata `/socket.io/?EIO=…`**
(conexões com um prefixo de caminho foram interceptadas normalmente). Num backend real basta ajustar `path`.
O `socket.io-client` é importado dinamicamente ao conectar e só depois de `backendReady` (`src/lib/backend-ready.ts`), ou seja, sempre depois do interceptor do MSW.

### Inicialização sem bloquear a interface
A interface é renderizada antes de o MSW ficar ativo (o hero aparece na primeira pintura). Toda requisição Axios passa por um interceptor que aguarda
`backendReady`, sinal resolvido quando o service worker do MSW está controlando a página (sem mocks, é resolvido imediatamente); o socket aguarda o mesmo sinal.
As rotas públicas não esperam a sessão; as privadas aguardam `ensureSession()` no `beforeLoad` antes de decidir pelo redirecionamento ao login.

## Sessão
Token opaco em `localStorage` (`nft:token`) com expiração no servidor (padrão 30 min; `session-expired` = 15 s). No boot, o `beforeLoad` da rota raiz chama
`GET /auth/session`. `401` em qualquer chamada autenticada aciona o handler global: encerra a sessão, **purga o cache privado e as subscriptions** e leva ao
`/login?redirect=<rota atual>&reason=expired`; após o login o usuário volta ao ponto de origem (o rascunho do checkout e a chave de tentativa de pedido estão no storage e são retomados).
Logout é **imediato no cliente** (limpa token, cache e socket antes de avisar o servidor em segundo plano). Troca de usuário: cache privado (`['u', userId, …]`, `cart`, `quote`) é removido e o socket reconecta com o novo token;
eventos `order.updated` de outro `userId` são descartados. Rotas privadas (`/checkout`, `/pedido/:id`, `/perfil`, `/carteiras`) usam `beforeLoad` com redirecionamento.

## Carrinho
O servidor simulado guarda o carrinho por usuário (`user:<id>`) ou visitante (`guest:<uuid>` enviado em `X-Guest-Id`). Persiste após refresh (banco simulado em `localStorage`).
Ao autenticar, `POST /cart/merge` mescla o carrinho do visitante **antes** de expor a sessão à UI (limitando quantidade à disponibilidade); se falhar, o id do visitante é mantido e a fusão é retomada no boot.
Limites: disponibilidade da edição e `maxPerOrder` (10) validados na API (`409 availability_conflict`) e refletidos nos steppers. Os valores exibidos vêm sempre da **cotação** (`/quote`), nunca de cálculo local.
Após confirmação, só os itens/quantidades comprados são removidos; em recusa/falha o carrinho é preservado.

## Cache (TanStack Query) e política de retries
- `staleTime` 30 s, `gcTime` 5 min, `refetchOnWindowFocus` ligado.
- **Retries:** apenas consultas e apenas para falhas transitórias (`network_error`, `timeout`, 5xx): até 2 tentativas com *backoff* exponencial (400 ms, 800 ms…). 4xx não repete. **Mutations nunca têm retry automático**; a recuperação de pedidos é por idempotência.
- **Chaves:** `['nfts','list',query]`, `['nfts','detail',id]`, `['cart',scope]`, `['quote',scope,{items,coupon,network}]`, `['u',userId,'favorites'|'profile'|'wallets'|'order',…]`. O escopo por usuário/visitante e os parâmetros da consulta isolam os dados.
- **Respostas obsoletas:** `signal` do Query cancela o Axios; chave por parâmetros + `placeholderData` evitam que uma resposta lenta de uma busca antiga substitua a atual (cenário `variable-latency`).
- **Atualização otimista com rollback:** favoritos (`onMutate` → `setQueryData`; `onError` restaura o snapshot e avisa; `onSettled` revalida).
- **Invalidação:** após mutations do carrinho invalida cotações; eventos invalidam o necessário; reconexão reconcilia tudo.

## Checkout e pedidos
1. Formulário validado (nome, e-mail, CPF, carteira) e conexão simulada da carteira (conectar/recusa/desconectar).
2. **Revisão:** o usuário confirma uma cotação (`quoteId`). Se a cotação viva mudar (evento ou revalidação), o botão de compra fica desabilitado e exige **“Aceitar novos valores”**.
3. Envio: trava anti-clique-repetido (`inFlight`) e chave de idempotência **persistida por impressão digital do conteúdo** (`order-attempt.ts`), reutilizada em reenvios/timeout/refresh e descartada somente quando o pedido fica terminal.
4. Pedido `pending` → `confirmed|declined` (resolução *lazy* no servidor simulado + evento `order.updated`; a página do pedido também faz polling de 3 s como rede de segurança). O recibo é o **snapshot** do pedido. Um pedido pendente é recuperado ao reabrir o checkout (`GET /orders/pending`).

## Mocks
Banco em memória espelhado no `localStorage` (`mock:db:v2`), consistente entre catálogo, favoritos, carrinho, perfil, carteiras e pedidos; `__mocks.reset()` restaura fixtures e cenário.
36 NFTs determinísticos (PRNG com semente) com os nomes e os 4 retratos do Figma (Emerald Ape, Sage Nomad, Neon Vessel, Golden Beat…), 6 coleções (Kurio Apes, Kurio Editions…),
4 categorias, 3 redes (Ethereum, Polygon, Base), 3 edições; `nft-007` esgotado e `nft-008` com limite. Dois usuários. Latência determinística (sem aleatoriedade).
**Bundle:** `tough-cookie` é substituído por um stub (`src/mocks/vendor/tough-cookie-lite.ts`, alias no `vite.config.ts`). O MSW só o usa para persistir cookies de respostas simuladas e ele arrasta `tldts` (lista de sufixos públicos); como a app não usa cookies (a sessão vai no cabeçalho `Authorization`), o chunk do MSW caiu de 466 kB para 173 kB. Efeito colateral: `Set-Cookie` em respostas simuladas é ignorado.

## UI, acessibilidade e responsividade
Skeletons com *shimmer* e dimensões fixas (CLS 0); `prefers-reduced-motion` desliga animações. Foco visível global, *skip link*, Radix Dialog para filtros/menu (foco preso e devolvido ao gatilho),
labels + `aria-describedby`/`aria-invalid` nos campos, regiões `aria-live` para mutations/eventos, estados não dependentes de cor (ícones/texto), `alt` descritivo nas imagens.
Verificado sem overflow horizontal em 390/768/1440.

## Fidelidade ao Figma, desvios e limitações — **leia**
**Como o arquivo foi lido:** tokens pela coleção *Design Tokens* (painel de variáveis); estrutura, medidas, cores e textos de cada quadro pela API de plugins do Figma no navegador
e pelo `get_design_context` do MCP do Figma (quadro *Desktop / Início*); conferência visual com capturas dos 15 quadros (9 desktop, 6 mobile).

- **Tokens:** Roboto Mono (`@fontsource-variable/roboto-mono`, servida localmente), primária `#D28A4C`, fundo `#140D0A`, cartões `#241612`, superfície elevada `#2F1D15`, bordas `#3F2319`/`#55321F`,
  texto `#F7F3EC`/`#CFB28C`/`#B39463`, destaque `#E89B55`, erro `#F0805F`, `surface-dark` `#38220F` — em `@theme` (`src/styles/index.css`). Texto sobre a primária usa `#140D0A` (contraste AA).
- **Telas implementadas a partir dos quadros:** Início (hero, sidebar *Coleções / Faixa de preço / Rede*, banner *NFT em destaque*, abas *Todos os NFTs / Novos lançamentos / Em alta*, grade, paginação, promoções, *Diário da Cunhagem*, rodapé),
  Detalhes (galeria de 4 miniaturas, avaliações, edições, *COMPRAR/Favoritar*, ID do token/coleção/atributos, abas *Detalhes / Avaliações*, *Mais desta coleção*),
  Carrinho (tabela NFTs/Preço/Edições/Total, *Resumo da carteira*, código promocional, *Conectar e finalizar*, *Colecionadores também viram*),
  Pagamento (*Perfil do colecionador* em duas colunas, *Seus NFTs*, *Carteira e rede*), Confirmação (cartão de 578 px com ID da transação, data, total e detalhes),
  Login e Cadastro (cartão de 500 px com abas *Entrar | Criar conta* e acesso social), Perfil e Carteiras (menu lateral *Meu perfil*), e as versões mobile (hero compacto, busca + filtro, grade em 2 colunas, barra de navegação inferior).
- **Assets:** os 4 retratos de NFT do arquivo foram exportados do Figma em WebP 400×400 (`public/nfts/ape-{1..4}.webp`, ~10 kB cada) e reutilizados entre os 36 NFTs, como o próprio arquivo faz. Avatares de demonstração são SVGs gerados por `npm run assets` na paleta do Figma.
- **Desvios intencionais (funcionalidade ou acessibilidade):**
  - Login e Cadastro no Figma são modais sobre a Início; aqui são rotas próprias (`/login`, `/cadastro`) com o mesmo cartão, para que o redirecionamento pós-login, o histórico e o acesso direto funcionem.
    Os campos usam rótulos visualmente ocultos (o Figma mostra só *placeholders*) para manter nomes acessíveis. O Cadastro pede *Nome*, *E-mail*, *Senha* e *Confirmar senha* (o quadro tem *Nome de usuário* no lugar de *Nome*).
  - A Confirmação é uma rota (`/pedido/:id`) com o cartão do modal centralizado, que também cobre os estados pendente e recusado.
  - O Pagamento mantém os campos que o pedido realmente usa (nome de exibição, e-mail, CPF, rede) e mostra endereço e tipo da carteira selecionada; campos do quadro sem correspondência no contrato (ENS, código de indicação) não foram incluídos. A observação do colecionador é local e não é enviada.
  - O filtro *Rede* usa Ethereum/Polygon/Base (redes do checkout) em vez de Solana, para que rede do NFT e rede de pagamento sejam coerentes. *Coleções* do Figma corresponde às categorias do catálogo.
  - A busca do catálogo é um campo na barra da grade (o Figma desktop só mostra o ícone de lupa, que aqui leva até esse campo).
  - Itens do menu *Meu perfil* sem tela no escopo (Atividade, Lista de interesse, Ofertas, Arquivos baixados, Suporte) aparecem como "em breve", não como links.
  - No mobile, o retrato do hero ocupa metade da largura (no quadro é menor), para ser o elemento de LCP em vez da imagem do primeiro card, que depende da API.
- **Ícones:** lucide-react no lugar do conjunto *Iconly* do arquivo; redes sociais como monogramas.
- shadcn/ui: componentes adaptados manualmente no padrão da biblioteca (Radix + `cva` + `tailwind-merge`), sem o CLI.
- Persistência e “banco” vivem no navegador (`localStorage`), logo cada navegador tem seu próprio estado simulado e não há comunicação entre abas além do storage.
- Avatar: arquivo de imagem até 150 KB guardado como *data URL* no banco simulado.
- Tablet (768 px) foi verificado por overflow e inspeção, mas não tem projeto E2E dedicado (os fluxos E2E rodam em 1440 e 390).

## Performance (Lighthouse)
Build otimizada (`npm run build && npm run preview`), cenário `default`, Lighthouse 13.6.0, Chrome 153 headless, Linux (2 vCPUs, sem controle de carga),
throttling simulado padrão (mobile: CPU 4×, RTT 150 ms), 3 execuções por página/perfil e mediana. Dados completos em `lighthouse/reports/summary.json`.

| Página / perfil | Perf (mediana · execuções) | A11y | Best Pr. | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| Início · desktop | **100** · 100/100/100 | 100 | 100 | 100 | 0,8 s | 0 | 26 ms |
| Detalhe · desktop | **99** · 99/99/99 | 100 | 100 | 100 | 0,9 s | 0 | 13 ms |
| Início · mobile | **78** · 80/78/77 | 100 | 100 | 100 | 3,1 s | 0 | 658 ms |
| Detalhe · mobile | **81** · 83/78/81 | 100 | 100 | 100 | 3,5 s | 0 | 418 ms |

Accessibility, Best Practices e SEO cumprem as metas em todas as páginas; Performance cumpre no desktop e **fica abaixo de 90 no mobile**.
Em rodadas avulsas durante o ajuste, o mobile variou entre 77 e 85: a máquina de medição é pequena e o TBT oscila bastante.

O que foi feito (com efeito medido):
1. **MSW fora do caminho crítico:** a interface renderiza sem esperar o service worker; Axios e Socket.IO aguardam `backendReady`. O MSW começa a ser carregado depois do primeiro frame.
2. **Bundle do MSW de 466 kB → 173 kB** com o stub de `tough-cookie` (ver *Mocks*).
3. **Cadeia de rede achatada:** a app e a página Início entram no chunk de entrada (o Vite gera `<link rel="modulepreload">`); o retrato do hero é pré-carregado no HTML.
4. **LCP desacoplado da API:** o elemento de LCP é o retrato do hero (estático, `fetchpriority=high`), não a primeira imagem do catálogo. LCP *observado* ≈ 0,5 s; o valor simulado (≈ 3 s) vem da cadeia de requisições sob o RTT simulado.
5. **CLS 0:** dimensões fixas em imagens e skeletons, e `main` com altura mínima de tela (o rodapé deixava de ser empurrado no Detalhe).

O que impede os 90 no mobile: o TBT (400–650 ms sob CPU 4×) vem da execução do React/TanStack (~450 ms simulados) e da avaliação e inicialização do MSW (~440 ms simulados),
obrigatório na build de demonstração. Tentativas sem ganho mensurável e revertidas: renderização inicial em `startTransition` e montagem adiada de seções abaixo da dobra.
Caminhos que restam: servir a build com um backend real (removendo o MSW do bundle publicado) ou trocar a camada de UI por uma mais leve (ex.: Preact), fora do escopo do desafio.
Não foram feitas simplificações exclusivas para a auditoria.
