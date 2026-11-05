import { delay, http, HttpResponse, type HttpResponseInit } from 'msw'
import type { ApiErrorCode, CartItem, Category, NftListQuery, NftSort, OrderInput, QuoteInput, NetworkId, WalletInput, Wallet } from '@/api/types'
import { isEth } from '@/lib/eth'
import * as db from '../db'

let seq = 0

/** Latência determinística (sem Math.random): reproduzível entre execuções. */
async function latency(override?: number) {
  const { min, max } = db.getScenario().latency
  const span = max - min
  await delay(override ?? min + (span ? (seq++ * 7919) % (span + 1) : 0))
}

function fail(status: number, code: ApiErrorCode, message: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json({ code, message, ...extra }, { status } as HttpResponseInit)
}

async function body<T>(request: Request): Promise<T | null> {
  try { return (await request.json()) as T } catch { return null }
}

const bearer = (request: Request) => request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null

type Auth = { userId: string; user: ReturnType<typeof db.getState>['users'][number]; token: string }

/** Autentica a requisição ou devolve a resposta de erro apropriada. */
function authenticate(request: Request): Auth | Response {
  const token = bearer(request)
  if (!token) return fail(401, 'unauthenticated', 'Faça login para continuar.')
  const s = db.resolveSession(token)
  if (s === 'expired') return fail(401, 'session_expired', 'Sua sessão expirou. Entre novamente.')
  if (!s) return fail(401, 'unauthenticated', 'Sessão inválida.')
  return { userId: s.user.id, user: s.user, token }
}

/** Carrinho: usuário autenticado ou visitante (X-Guest-Id). */
function cartKey(request: Request): string | Response {
  if (bearer(request)) {
    const a = authenticate(request)
    return a instanceof Response ? a : `user:${a.userId}`
  }
  return db.cartKeyOf(null, request.headers.get('x-guest-id'))
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function passwordError(p: string): string | null {
  if (p.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'A senha deve conter letras e números.'
  return null
}
const validation = (fieldErrors: Record<string, string>) => fail(422, 'validation_error', 'Verifique os campos informados.', { fieldErrors })

export const handlers = [
  /* ---------------- Sessão e conta ---------------- */
  http.post('/api/auth/register', async ({ request }) => {
    await latency()
    const b = await body<{ name: string; email: string; password: string }>(request)
    const errors: Record<string, string> = {}
    if (!b?.name || b.name.trim().length < 2) errors.name = 'Informe seu nome.'
    if (!b?.email || !EMAIL_RE.test(b.email)) errors.email = 'Informe um e-mail válido.'
    const pe = passwordError(b?.password ?? '')
    if (pe) errors.password = pe
    if (Object.keys(errors).length) return validation(errors)
    if (db.findUserByEmail(b!.email)) return fail(409, 'email_taken', 'Este e-mail já está cadastrado.', { fieldErrors: { email: 'Este e-mail já está cadastrado.' } })
    const u = await db.addUser(b!.name.trim(), b!.email.trim(), b!.password)
    const s = db.createSession(u.id)
    return HttpResponse.json({ ...s, user: db.publicUser(u) }, { status: 201 })
  }),

  http.post('/api/auth/login', async ({ request }) => {
    await latency()
    const b = await body<{ email: string; password: string }>(request)
    const errors: Record<string, string> = {}
    if (!b?.email || !EMAIL_RE.test(b.email)) errors.email = 'Informe um e-mail válido.'
    if (!b?.password) errors.password = 'Informe sua senha.'
    if (Object.keys(errors).length) return validation(errors)
    const u = db.findUserByEmail(b!.email)
    if (!u || u.passwordHash !== (await db.sha256(b!.password))) return fail(401, 'invalid_credentials', 'E-mail ou senha incorretos.')
    const s = db.createSession(u.id)
    return HttpResponse.json({ ...s, user: db.publicUser(u) })
  }),

  http.get('/api/auth/session', async ({ request }) => {
    await latency()
    const a = authenticate(request)
    if (a instanceof Response) return a
    const exp = db.getState().sessions[a.token]!.expiresAt
    return HttpResponse.json({ token: a.token, expiresAt: new Date(exp).toISOString(), user: db.publicUser(a.user) })
  }),

  http.post('/api/auth/logout', async ({ request }) => {
    await latency()
    const t = bearer(request)
    if (t) db.destroySession(t)
    return new HttpResponse(null, { status: 204 })
  }),

  /* ---------------- NFTs ---------------- */
  http.get('/api/nfts', async ({ request }) => {
    const sp = new URL(request.url).searchParams
    const sc = db.getScenario()
    const q = sp.get('q') ?? undefined
    // Respostas fora de ordem: termos curtos demoram mais que termos longos.
    await latency(sc.outOfOrder ? (q ? Math.max(60, 1100 - q.length * 300) : 120) : undefined)
    if (sc.catalog === 'network-error') return HttpResponse.error()
    if (sc.catalog === 'server-error') return fail(500, 'transient_failure', 'Erro interno do servidor.')
    if (sc.catalog === 'flaky' && db.hit('catalog') <= sc.flakyFailures) return fail(503, 'transient_failure', 'Serviço temporariamente indisponível.')

    const sort = (sp.get('sort') ?? 'newest') as NftSort
    const page = Number(sp.get('page') ?? '1')
    const pageSize = Number(sp.get('pageSize') ?? '9')
    const errors: Record<string, string> = {}
    if (!['newest', 'popular', 'price_asc', 'price_desc'].includes(sort)) errors.sort = 'Ordenação inválida.'
    if (!Number.isInteger(page) || page < 1) errors.page = 'Página inválida.'
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 48) errors.pageSize = 'Tamanho de página inválido.'
    for (const k of ['minPrice', 'maxPrice']) { const v = sp.get(k); if (v && !isEth(v)) errors[k] = 'Valor ETH inválido.' }
    if (Object.keys(errors).length) return validation(errors)

    const query: NftListQuery = {
      q: q || undefined, category: (sp.get('category') as Category) || undefined, collection: sp.get('collection') || undefined,
      network: (['ethereum', 'polygon', 'base'].includes(sp.get('network') ?? '') ? sp.get('network') : undefined) as NftListQuery['network'],
      minPrice: sp.get('minPrice') || undefined, maxPrice: sp.get('maxPrice') || undefined, inStock: sp.get('inStock') === 'true' || undefined,
      sort, page, pageSize,
    }
    const res = db.listNfts(query)
    if (sc.catalog === 'empty') return HttpResponse.json({ ...res, items: [], total: 0, totalPages: 1, page: 1 })
    return HttpResponse.json(res)
  }),

  http.get('/api/nfts/:id', async ({ params }) => {
    await latency()
    const n = db.findNft(String(params.id))
    return n ? HttpResponse.json(db.detail(n)) : fail(404, 'not_found', 'NFT não encontrado.')
  }),

  /* ---------------- Favoritos ---------------- */
  http.get('/api/favorites', async ({ request }) => {
    await latency()
    const a = authenticate(request); if (a instanceof Response) return a
    return HttpResponse.json({ nftIds: db.getState().favorites[a.userId] ?? [] })
  }),
  http.put('/api/favorites/:nftId', async ({ request, params }) => {
    await latency()
    const a = authenticate(request); if (a instanceof Response) return a
    if (db.getScenario().favoritesFailures > db.hits('favorites')) { db.hit('favorites'); return fail(500, 'transient_failure', 'Não foi possível atualizar os favoritos.') }
    const id = String(params.nftId)
    if (!db.findNft(id)) return fail(404, 'not_found', 'NFT não encontrado.')
    const list = (db.getState().favorites[a.userId] ??= [])
    if (!list.includes(id)) list.push(id)
    db.persist()
    return HttpResponse.json({ nftIds: list })
  }),
  http.delete('/api/favorites/:nftId', async ({ request, params }) => {
    await latency()
    const a = authenticate(request); if (a instanceof Response) return a
    if (db.getScenario().favoritesFailures > db.hits('favorites')) { db.hit('favorites'); return fail(500, 'transient_failure', 'Não foi possível atualizar os favoritos.') }
    const st = db.getState()
    st.favorites[a.userId] = (st.favorites[a.userId] ?? []).filter((x) => x !== params.nftId)
    db.persist()
    return HttpResponse.json({ nftIds: st.favorites[a.userId] })
  }),

  /* ---------------- Carrinho ---------------- */
  http.get('/api/cart', async ({ request }) => {
    await latency()
    const k = cartKey(request); if (k instanceof Response) return k
    return HttpResponse.json(db.getCart(k))
  }),
  http.post('/api/cart/items', async ({ request }) => {
    await latency()
    const k = cartKey(request); if (k instanceof Response) return k
    const b = await body<CartItem>(request)
    if (!b || !Number.isInteger(b.quantity) || b.quantity < 1) return validation({ quantity: 'Quantidade deve ser um inteiro maior que zero.' })
    if (!db.findNft(b.nftId)?.editions.some((e) => e.id === b.editionId)) return fail(404, 'not_found', 'NFT ou edição não encontrados.')
    const cap = db.maxQty(b.nftId, b.editionId)
    const current = db.getCart(k).items.find((i) => i.nftId === b.nftId && i.editionId === b.editionId)?.quantity ?? 0
    if (cap === 0) return fail(409, 'availability_conflict', 'Esta edição está esgotada.')
    if (current + b.quantity > cap) return fail(409, 'availability_conflict', `Limite de ${cap} unidade(s) para esta edição.`)
    return HttpResponse.json(db.mutateCart(k, (c) => {
      const ex = c.items.find((i) => i.nftId === b.nftId && i.editionId === b.editionId)
      if (ex) ex.quantity += b.quantity; else c.items.push({ nftId: b.nftId, editionId: b.editionId, quantity: b.quantity })
    }), { status: 201 })
  }),
  http.patch('/api/cart/items', async ({ request }) => {
    await latency()
    const k = cartKey(request); if (k instanceof Response) return k
    const b = await body<CartItem>(request)
    if (!b || !Number.isInteger(b.quantity) || b.quantity < 1) return validation({ quantity: 'Quantidade deve ser um inteiro maior que zero.' })
    if (!db.getCart(k).items.some((i) => i.nftId === b.nftId && i.editionId === b.editionId)) return fail(404, 'not_found', 'Item não está no carrinho.')
    const cap = db.maxQty(b.nftId, b.editionId)
    if (b.quantity > cap) return fail(409, 'availability_conflict', cap === 0 ? 'Esta edição está esgotada.' : `Limite de ${cap} unidade(s) para esta edição.`)
    return HttpResponse.json(db.mutateCart(k, (c) => { c.items.find((i) => i.nftId === b.nftId && i.editionId === b.editionId)!.quantity = b.quantity }))
  }),
  http.delete('/api/cart/items/:nftId/:editionId', async ({ request, params }) => {
    await latency()
    const k = cartKey(request); if (k instanceof Response) return k
    return HttpResponse.json(db.mutateCart(k, (c) => { c.items = c.items.filter((i) => !(i.nftId === params.nftId && i.editionId === params.editionId)) }))
  }),
  http.put('/api/cart/coupon', async ({ request }) => {
    await latency()
    const k = cartKey(request); if (k instanceof Response) return k
    const b = await body<{ code: string }>(request)
    if (!b?.code?.trim()) return validation({ code: 'Informe o cupom.' })
    const q = db.computeQuote({ items: [], couponCode: b.code, network: 'ethereum' })
    if (q.couponError) return fail(422, q.couponError.code, q.couponError.message, { fieldErrors: { code: q.couponError.message } })
    return HttpResponse.json(db.mutateCart(k, (c) => { c.couponCode = b.code.trim().toUpperCase() }))
  }),
  http.delete('/api/cart/coupon', async ({ request }) => {
    await latency()
    const k = cartKey(request); if (k instanceof Response) return k
    return HttpResponse.json(db.mutateCart(k, (c) => { c.couponCode = null }))
  }),
  http.post('/api/cart/merge', async ({ request }) => {
    await latency()
    const a = authenticate(request); if (a instanceof Response) return a
    const b = await body<{ guestId: string }>(request)
    if (!b?.guestId) return validation({ guestId: 'Identificador do visitante ausente.' })
    return HttpResponse.json(db.mergeCarts(`guest:${b.guestId}`, `user:${a.userId}`))
  }),

  /* ---------------- Cotação ---------------- */
  http.post('/api/quote', async ({ request }) => {
    await latency()
    const b = await body<QuoteInput>(request)
    if (!b || !Array.isArray(b.items) || !['ethereum', 'polygon', 'base'].includes(b.network)) return validation({ network: 'Rede inválida.' })
    return HttpResponse.json(db.computeQuote(b))
  }),

  /* ---------------- Pedidos ---------------- */
  http.post('/api/orders', async ({ request }) => {
    const a = authenticate(request); if (a instanceof Response) { await latency(); return a }
    const key = request.headers.get('idempotency-key')
    if (!key) { await latency(); return validation({ 'Idempotency-Key': 'Cabeçalho obrigatório.' }) }
    const b = await body<OrderInput>(request)
    const errors: Record<string, string> = {}
    if (!b?.collector?.name?.trim()) errors.name = 'Informe o nome do colecionador.'
    if (!b?.collector?.email || !EMAIL_RE.test(b.collector.email)) errors.email = 'Informe um e-mail válido.'
    if (!b?.collector?.document || b.collector.document.replace(/\D/g, '').length < 11) errors.document = 'Informe um documento válido (CPF).'
    if (!b?.walletId) errors.walletId = 'Selecione uma carteira.'
    if (Object.keys(errors).length) { await latency(); return validation(errors) }
    const r = db.createOrder(a.userId, key, b!)
    if (r.kind === 'ok' && r.dropResponse) await delay('infinite') // pedido criado; resposta nunca chega
    await latency()
    switch (r.kind) {
      case 'ok': return HttpResponse.json(db.publicOrder(r.order), { status: r.replayed ? 200 : 201, headers: { 'Idempotent-Replayed': String(r.replayed) } })
      case 'idempotency_conflict': return fail(409, 'idempotency_conflict', 'Chave de idempotência já usada com outro conteúdo.')
      case 'quote_changed': return fail(409, 'quote_changed', 'Preços ou taxas mudaram. Revise e confirme novamente.', { quote: r.quote })
      case 'availability_conflict': return fail(409, 'availability_conflict', 'Algum item não está mais disponível na quantidade solicitada.', { quote: r.quote })
      case 'forbidden': return fail(403, 'forbidden', 'Carteira não pertence à sua conta.')
      default: return validation(r.fieldErrors ?? { form: r.message })
    }
  }),
  http.get('/api/orders/pending', async ({ request }) => {
    await latency()
    const a = authenticate(request); if (a instanceof Response) return a
    db.settleDueOrders()
    const o = db.getState().orders.filter((x) => x.userId === a.userId && x.status === 'pending').at(-1)
    return HttpResponse.json({ order: o ? db.publicOrder(o) : null })
  }),
  http.get('/api/orders/:id', async ({ request, params }) => {
    await latency()
    const a = authenticate(request); if (a instanceof Response) return a
    db.settleDueOrders()
    const o = db.getState().orders.find((x) => x.id === params.id)
    if (!o) return fail(404, 'not_found', 'Pedido não encontrado.')
    if (o.userId !== a.userId) return fail(403, 'forbidden', 'Você não tem acesso a este pedido.')
    return HttpResponse.json(db.publicOrder(o))
  }),

  /* ---------------- Perfil ---------------- */
  http.get('/api/profile', async ({ request }) => {
    await latency()
    const a = authenticate(request); if (a instanceof Response) return a
    return HttpResponse.json(db.publicUser(a.user))
  }),
  http.put('/api/profile', async ({ request }) => {
    await latency()
    const a = authenticate(request); if (a instanceof Response) return a
    const b = await body<{ name: string; email: string; bio: string }>(request)
    const errors: Record<string, string> = {}
    if (!b?.name || b.name.trim().length < 2) errors.name = 'Informe seu nome.'
    if (!b?.email || !EMAIL_RE.test(b.email)) errors.email = 'Informe um e-mail válido.'
    if ((b?.bio ?? '').length > 160) errors.bio = 'A bio deve ter até 160 caracteres.'
    if (Object.keys(errors).length) return validation(errors)
    const other = db.findUserByEmail(b!.email)
    if (other && other.id !== a.userId) return fail(409, 'email_taken', 'Este e-mail já está em uso.', { fieldErrors: { email: 'Este e-mail já está em uso.' } })
    Object.assign(a.user, { name: b!.name.trim(), email: b!.email.trim(), bio: b!.bio ?? '' })
    db.persist()
    return HttpResponse.json(db.publicUser(a.user))
  }),
  http.post('/api/profile/avatar', async ({ request }) => {
    await latency()
    const a = authenticate(request); if (a instanceof Response) return a
    const form = await request.formData().catch(() => null)
    const file = form?.get('avatar')
    if (!(file instanceof File)) return validation({ avatar: 'Selecione uma imagem.' })
    if (!file.type.startsWith('image/')) return validation({ avatar: 'O arquivo deve ser uma imagem.' })
    if (file.size > 150 * 1024) return validation({ avatar: 'A imagem deve ter até 150 KB.' })
    const bytes = new Uint8Array(await file.arrayBuffer())
    let bin = ''; bytes.forEach((b) => (bin += String.fromCharCode(b)))
    a.user.avatarUrl = `data:${file.type};base64,${btoa(bin)}`
    db.persist()
    return HttpResponse.json(db.publicUser(a.user))
  }),
  http.put('/api/profile/password', async ({ request }) => {
    await latency()
    const a = authenticate(request); if (a instanceof Response) return a
    const b = await body<{ currentPassword: string; newPassword: string }>(request)
    const errors: Record<string, string> = {}
    if (!b?.currentPassword) errors.currentPassword = 'Informe a senha atual.'
    const pe = passwordError(b?.newPassword ?? ''); if (pe) errors.newPassword = pe
    if (Object.keys(errors).length) return validation(errors)
    if (a.user.passwordHash !== (await db.sha256(b!.currentPassword))) return validation({ currentPassword: 'Senha atual incorreta.' })
    a.user.passwordHash = await db.sha256(b!.newPassword)
    db.persist()
    return new HttpResponse(null, { status: 204 })
  }),

  /* ---------------- Carteiras ---------------- */
  http.get('/api/wallets', async ({ request }) => {
    await latency()
    const a = authenticate(request); if (a instanceof Response) return a
    return HttpResponse.json({ wallets: db.getState().wallets[a.userId] ?? [] })
  }),
  http.post('/api/wallets', async ({ request }) => {
    await latency()
    const a = authenticate(request); if (a instanceof Response) return a
    const b = await body<WalletInput>(request)
    const errors = walletErrors(b)
    if (Object.keys(errors).length) return validation(errors)
    const list = (db.getState().wallets[a.userId] ??= [])
    if (list.some((w) => w.kind === b!.kind)) return fail(409, 'validation_error', 'Você já possui uma carteira deste tipo.', { fieldErrors: { kind: 'Você já possui uma carteira deste tipo.' } })
    const w: Wallet = { id: `w${Date.now().toString(36)}${list.length}`, ...b! }
    list.push(w); db.persist()
    return HttpResponse.json(w, { status: 201 })
  }),
  http.put('/api/wallets/:id', async ({ request, params }) => {
    await latency()
    const a = authenticate(request); if (a instanceof Response) return a
    const w = db.getState().wallets[a.userId]?.find((x) => x.id === params.id)
    if (!w) return fail(404, 'not_found', 'Carteira não encontrada.')
    const b = await body<WalletInput>(request)
    const errors = walletErrors(b ? { ...b, kind: w.kind } : null)
    if (Object.keys(errors).length) return validation(errors)
    Object.assign(w, { label: b!.label.trim(), address: b!.address, network: b!.network }); db.persist()
    return HttpResponse.json(w)
  }),
  http.post('/api/wallets/:id/connect', async ({ request, params }) => {
    await latency(400)
    const a = authenticate(request); if (a instanceof Response) return a
    const w = db.getState().wallets[a.userId]?.find((x) => x.id === params.id)
    if (!w) return fail(404, 'not_found', 'Carteira não encontrada.')
    const b = await body<{ network: NetworkId }>(request)
    if (db.getScenario().walletRejects) return fail(403, 'wallet_rejected', 'A carteira recusou a conexão.')
    return HttpResponse.json({ walletId: w.id, connected: true, network: b?.network ?? w.network })
  }),
  http.post('/api/wallets/:id/disconnect', async ({ request, params }) => {
    await latency(150)
    const a = authenticate(request); if (a instanceof Response) return a
    return HttpResponse.json({ walletId: String(params.id), connected: false, network: 'ethereum' })
  }),
]

function walletErrors(b: WalletInput | null): Record<string, string> {
  const e: Record<string, string> = {}
  if (!b?.label || b.label.trim().length < 2) e.label = 'Informe um nome para a carteira.'
  if (!b?.address || !/^0x[0-9a-fA-F]{40}$/.test(b.address)) e.address = 'Endereço inválido (0x + 40 caracteres hexadecimais).'
  if (!b?.network || !['ethereum', 'polygon', 'base'].includes(b.network)) e.network = 'Selecione uma rede.'
  if (!b?.kind || !['primary', 'secondary'].includes(b.kind)) e.kind = 'Tipo de carteira inválido.'
  return e
}
