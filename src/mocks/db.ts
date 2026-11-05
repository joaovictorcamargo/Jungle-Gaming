import type {
  CartItem, CartResponse, NftDetail, NftListQuery, NftListResponse, NftSummary, NftUpdatedEvent, Order, OrderInput,
  OrderUpdatedEvent, Quote, QuoteInput, QuoteLine, Wallet, User,
} from '@/api/types'
import { addEth, cmpEth, eqEth, mulEthInt, pctEth, subEth } from '@/lib/eth'
import {
  COUPONS, NETWORK_FEES, buildNfts, buildUsers, buildWallets, sha256, type NftRecord, type UserRecord,
} from './data/fixtures'
import { BASE_SCENARIO, resolveScenario, type Scenario } from './scenarios'

const DB_KEY = 'mock:db:v2'
const SCENARIO_KEY = 'mock:scenario:v1'
export const MAX_PER_ORDER = 10

export interface OrderRecord extends Order {
  userId: string
  resolvesAt: number
  outcome: 'confirmed' | 'declined'
  settled: boolean
}

interface CartRecord { items: CartItem[]; couponCode: string | null; version: number }
interface SessionRecord { userId: string; expiresAt: number }

interface DbState {
  nfts: NftRecord[]
  users: UserRecord[]
  wallets: Record<string, Wallet[]>
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  sessions: Record<string, SessionRecord>
  orders: OrderRecord[]
  idempotency: Record<string, { userId: string; bodyHash: string; orderId: string }>
  counts: Record<string, number>
  seq: number
}

export type MockEvent = NftUpdatedEvent | OrderUpdatedEvent
type Listener = (event: MockEvent) => void

let state: DbState
let scenario: Scenario = BASE_SCENARIO
let scenarioNames: string[] = ['default']
const listeners = new Set<Listener>()

/* ---------- persistência ---------- */
function save() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(state)) } catch { /* armazenamento indisponível */ }
}

async function fresh(): Promise<DbState> {
  return {
    nfts: buildNfts(), users: await buildUsers(), wallets: buildWallets(), favorites: { u1: ['nft-002'], u2: [] },
    carts: {}, sessions: {}, orders: [], idempotency: {}, counts: {}, seq: 1,
  }
}

export async function initDb() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    state = raw ? (JSON.parse(raw) as DbState) : await fresh()
    const sc = JSON.parse(localStorage.getItem(SCENARIO_KEY) ?? 'null') as { names: string[]; overrides: Partial<Scenario> } | null
    if (sc) applyScenario(sc.names, sc.overrides, false)
  } catch {
    state = await fresh()
  }
  const fromUrl = new URLSearchParams(location.search).get('scenario')
  if (fromUrl) applyScenario(fromUrl.split(',').filter(Boolean), {}, true)
  save()
}

export function applyScenario(names: string[], overrides: Partial<Scenario> = {}, persist = true) {
  scenarioNames = names.length ? names : ['default']
  scenario = resolveScenario(scenarioNames, overrides)
  if (persist) {
    state.counts = {}
    try { localStorage.setItem(SCENARIO_KEY, JSON.stringify({ names: scenarioNames, overrides })) } catch { /* noop */ }
    save()
  }
}

export async function resetDb(names: string[] = ['default']) {
  state = await fresh()
  applyScenario(names, {}, true)
  save()
}

export const getScenario = () => scenario
export const getScenarioNames = () => scenarioNames
export const getState = () => state
export const persist = save

/** Contador de ocorrências (para falhas "apenas na primeira vez" / "N primeiras vezes"). */
export function hit(key: string): number {
  state.counts[key] = (state.counts[key] ?? 0) + 1
  save()
  return state.counts[key]!
}
export const hits = (key: string) => state.counts[key] ?? 0

/* ---------- eventos ---------- */
export function onEvent(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn) }
function emit(event: MockEvent) { listeners.forEach((l) => l(event)) }

function nftEvent(n: NftRecord): NftUpdatedEvent {
  return {
    eventId: `evt_${n.id}_v${n.version}`, type: 'nft.updated', nftId: n.id, version: n.version, price: n.price,
    available: n.editions.reduce((s, e) => s + e.available, 0),
    editions: n.editions.map((e) => ({ id: e.id, available: e.available })), occurredAt: new Date().toISOString(),
  }
}

/** Altera dados do NFT, incrementa a versão e emite nft.updated (REST e eventos permanecem coerentes). */
export function updateNft(nftId: string, patch: { price?: string; editions?: { id: string; available: number }[] }, silent = false): NftUpdatedEvent | null {
  const n = state.nfts.find((x) => x.id === nftId)
  if (!n) return null
  if (patch.price) n.price = patch.price
  patch.editions?.forEach((p) => { const e = n.editions.find((x) => x.id === p.id); if (e) e.available = Math.max(0, Math.min(p.available, e.supply)) })
  n.version += 1
  save()
  const ev = nftEvent(n)
  if (!silent) emit(ev)
  return ev
}
export const currentNftEvent = (nftId: string) => { const n = state.nfts.find((x) => x.id === nftId); return n ? nftEvent(n) : null }

/* ---------- NFTs ---------- */
const total = (n: NftRecord) => n.editions.reduce((s, e) => s + e.available, 0)
const summary = (n: NftRecord): NftSummary => ({
  id: n.id, title: n.title, creator: n.creator, collection: n.collection, category: n.category, network: n.network, price: n.price,
  available: total(n), image: n.image, featured: n.featured, likes: n.likes, version: n.version,
})
export const detail = (n: NftRecord): NftDetail => ({
  ...summary(n), description: n.description, gallery: n.gallery, editions: n.editions.map((e) => ({ ...e })),
  createdAt: n.createdAt, maxPerOrder: MAX_PER_ORDER, tokenId: n.tokenId, attributes: [...n.attributes],
  contract: '0x7A42…19E8', royaltyPercent: 5, rating: { ...n.rating }, reviews: n.reviews.map((x) => ({ ...x })),
})
export const findNft = (id: string) => state.nfts.find((n) => n.id === id)

function countBy<T, K extends string>(xs: T[], key: (x: T) => K, keys: readonly K[]): Record<K, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
  for (const x of xs) out[key(x)] += 1
  return out
}

export function listNfts(q: NftListQuery): NftListResponse {
  let items = state.nfts.filter((n) => {
    if (q.q) { const t = q.q.toLowerCase(); if (![n.title, n.creator, n.collection].some((s) => s.toLowerCase().includes(t))) return false }
    if (q.category && n.category !== q.category) return false
    if (q.collection && n.collection !== q.collection) return false
    if (q.network && n.network !== q.network) return false
    if (q.minPrice && cmpEth(n.price, q.minPrice) < 0) return false
    if (q.maxPrice && cmpEth(n.price, q.maxPrice) > 0) return false
    if (q.inStock && total(n) === 0) return false
    return true
  })
  items = [...items].sort((a, b) => {
    switch (q.sort) {
      case 'price_asc': return cmpEth(a.price, b.price) || a.id.localeCompare(b.id)
      case 'price_desc': return cmpEth(b.price, a.price) || a.id.localeCompare(b.id)
      case 'popular': return b.likes - a.likes || a.id.localeCompare(b.id)
      default: return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
    }
  })
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / q.pageSize))
  const page = Math.min(Math.max(1, q.page), totalPages)
  return {
    items: items.slice((page - 1) * q.pageSize, page * q.pageSize).map(summary),
    page, pageSize: q.pageSize, total: totalItems, totalPages, query: { ...q, page },
    facets: {
      collections: [...new Set(state.nfts.map((n) => n.collection))].sort(),
      categories: ['arte', 'musica', 'fotografia', 'games'],
      categoryCounts: countBy(state.nfts, (n) => n.category, ['arte', 'musica', 'fotografia', 'games'] as const),
      networkCounts: countBy(state.nfts, (n) => n.network, ['ethereum', 'polygon', 'base'] as const),
      priceRange: state.nfts.reduce((acc, n) => ({ min: cmpEth(n.price, acc.min) < 0 ? n.price : acc.min, max: cmpEth(n.price, acc.max) > 0 ? n.price : acc.max }), { min: state.nfts[0]!.price, max: state.nfts[0]!.price }),
    },
  }
}

/* ---------- usuários e sessões ---------- */
export const publicUser = (u: UserRecord): User => ({ id: u.id, name: u.name, email: u.email, bio: u.bio, avatarUrl: u.avatarUrl })
export const findUserByEmail = (email: string) => state.users.find((u) => u.email.toLowerCase() === email.toLowerCase())

export function createSession(userId: string) {
  const token = `tok_${crypto.randomUUID()}`
  const expiresAt = Date.now() + scenario.sessionTtlMs
  state.sessions[token] = { userId, expiresAt }
  save()
  return { token, expiresAt: new Date(expiresAt).toISOString() }
}

export function resolveSession(token: string | null): { user: UserRecord } | 'expired' | null {
  if (!token) return null
  const s = state.sessions[token]
  if (!s) return null
  if (s.expiresAt <= Date.now()) { delete state.sessions[token]; save(); return 'expired' }
  const user = state.users.find((u) => u.id === s.userId)
  return user ? { user } : null
}
export function destroySession(token: string) { delete state.sessions[token]; save() }
export function expireAllSessions() { Object.values(state.sessions).forEach((s) => (s.expiresAt = Date.now() - 1)); save() }

export async function addUser(name: string, email: string, password: string) {
  const u: UserRecord = { id: `u${state.users.length + 1}`, name, email, bio: '', avatarUrl: null, passwordHash: await sha256(password) }
  state.users.push(u); state.wallets[u.id] = []; state.favorites[u.id] = []; save()
  return u
}
export { sha256 }

/* ---------- carrinho ---------- */
const cartOf = (key: string): CartRecord => (state.carts[key] ??= { items: [], couponCode: null, version: 0 })
export function getCart(key: string): CartResponse { const c = cartOf(key); return { items: c.items.map((i) => ({ ...i })), couponCode: c.couponCode, version: c.version } }

export function maxQty(nftId: string, editionId: string): number {
  const e = findNft(nftId)?.editions.find((x) => x.id === editionId)
  return e ? Math.min(e.available, MAX_PER_ORDER) : 0
}

export function mutateCart(key: string, fn: (c: CartRecord) => void): CartResponse {
  const c = cartOf(key); fn(c); c.version += 1; save(); return getCart(key)
}

export function mergeCarts(guestKey: string, userKey: string) {
  const g = state.carts[guestKey]
  if (!g) return getCart(userKey)
  mutateCart(userKey, (c) => {
    for (const it of g.items) {
      const ex = c.items.find((x) => x.nftId === it.nftId && x.editionId === it.editionId)
      const cap = Math.max(1, maxQty(it.nftId, it.editionId))
      if (ex) ex.quantity = Math.min(ex.quantity + it.quantity, cap)
      else if (maxQty(it.nftId, it.editionId) > 0) c.items.push({ ...it, quantity: Math.min(it.quantity, cap) })
    }
    c.couponCode ??= g.couponCode
  })
  delete state.carts[guestKey]; save()
  return getCart(userKey)
}

/* ---------- cotação ---------- */
export const cartKeyOf = (userId: string | null, guestId: string | null) => (userId ? `user:${userId}` : `guest:${guestId ?? 'anon'}`)

function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function computeQuote(input: QuoteInput): Quote {
  const lines: QuoteLine[] = input.items.map((it) => {
    const n = findNft(it.nftId)
    const ed = n?.editions.find((e) => e.id === it.editionId)
    if (!n || !ed) return { nftId: it.nftId, editionId: it.editionId, editionLabel: '—', title: 'NFT indisponível', image: '', quantity: it.quantity, unitPrice: '0', lineTotal: '0', available: 0, issue: 'not_found' as const }
    const issue = ed.available === 0 ? 'sold_out' : it.quantity > ed.available ? 'insufficient' : null
    return { nftId: n.id, editionId: ed.id, editionLabel: ed.label, title: n.title, image: n.image, quantity: it.quantity, unitPrice: n.price, lineTotal: mulEthInt(n.price, it.quantity), available: ed.available, issue }
  })
  const subtotal = lines.reduce((s, l) => addEth(s, l.lineTotal), '0')
  let coupon: Quote['coupon'] = null
  let couponError: Quote['couponError'] = null
  if (input.couponCode) {
    const c = COUPONS.find((x) => x.code === input.couponCode!.trim().toUpperCase())
    if (!c) couponError = { code: 'coupon_invalid', message: 'Cupom inválido.' }
    else if (new Date(c.expiresAt).getTime() < Date.now()) couponError = { code: 'coupon_expired', message: 'Cupom expirado.' }
    else coupon = { code: c.code, percentOff: c.percentOff }
  }
  const discount = coupon ? pctEth(subtotal, coupon.percentOff * 100) : '0'
  const networkFee = lines.length ? NETWORK_FEES[input.network] : '0'
  const totalEth = addEth(subEth(subtotal, discount), networkFee)
  const valid = lines.length > 0 && lines.every((l) => !l.issue) && !couponError
  const quoteId = `q_${hash(JSON.stringify([lines.map((l) => [l.nftId, l.editionId, l.quantity, l.unitPrice, l.issue]), discount, networkFee, totalEth, input.network]))}`
  return { quoteId, network: input.network, lines, subtotal, discount, networkFee, total: totalEth, coupon, couponError, valid }
}

/* ---------- pedidos ---------- */
const orderBodyHash = (i: OrderInput) => hash(JSON.stringify([i.items, i.couponCode, i.network, i.walletId, i.collector, i.quoteId, i.expectedTotal]))
const fakeHash = (seed: string) => `0x${(hash(seed) + hash(seed + 'a') + hash(seed + 'b') + hash(seed + 'c') + hash(seed + 'd') + hash(seed + 'e') + hash(seed + 'f') + hash(seed + 'g'))}`

export type CreateOrderResult =
  | { kind: 'ok'; order: OrderRecord; replayed: boolean; dropResponse: boolean }
  | { kind: 'idempotency_conflict' }
  | { kind: 'quote_changed'; quote: Quote }
  | { kind: 'availability_conflict'; quote: Quote }
  | { kind: 'invalid'; message: string; fieldErrors?: Record<string, string> }
  | { kind: 'forbidden' }

export function createOrder(userId: string, key: string, input: OrderInput): CreateOrderResult {
  const bodyHash = orderBodyHash(input)
  const prev = state.idempotency[key]
  if (prev && prev.userId === userId) {
    if (prev.bodyHash !== bodyHash) return { kind: 'idempotency_conflict' }
    return { kind: 'ok', order: state.orders.find((o) => o.id === prev.orderId)!, replayed: true, dropResponse: false }
  }
  const wallet = state.wallets[userId]?.find((w) => w.id === input.walletId)
  if (!wallet) return { kind: 'forbidden' }
  if (!input.items.length) return { kind: 'invalid', message: 'Carrinho vazio.' }

  if (scenario.priceChangeOnCheckout && hits('priceChange') === 0) {
    hit('priceChange')
    const n = findNft(input.items[0]!.nftId)
    if (n) updateNft(n.id, { price: addEth(n.price, '0.01') })
    return { kind: 'quote_changed', quote: computeQuote(input) }
  }
  if (scenario.soldOutOnCheckout && hits('soldOut') === 0) {
    hit('soldOut')
    const it = input.items[0]!
    updateNft(it.nftId, { editions: [{ id: it.editionId, available: 0 }] })
    return { kind: 'availability_conflict', quote: computeQuote(input) }
  }

  const quote = computeQuote(input)
  if (quote.lines.some((l) => l.issue)) return { kind: 'availability_conflict', quote }
  if (quote.couponError) return { kind: 'invalid', message: quote.couponError.message, fieldErrors: { coupon: quote.couponError.message } }
  if (quote.quoteId !== input.quoteId || !eqEth(quote.total, input.expectedTotal)) return { kind: 'quote_changed', quote }

  const id = `ord_${String(state.seq++).padStart(5, '0')}`
  const now = new Date().toISOString()
  const order: OrderRecord = {
    id, userId, status: 'pending', version: 1, createdAt: now, updatedAt: now, network: input.network, walletAddress: wallet.address,
    collector: input.collector,
    lines: quote.lines.map(({ nftId, editionId, editionLabel, title, image, quantity, unitPrice, lineTotal }) => ({ nftId, editionId, editionLabel, title, image, quantity, unitPrice, lineTotal })),
    subtotal: quote.subtotal, discount: quote.discount, networkFee: quote.networkFee, total: quote.total, couponCode: quote.coupon?.code ?? null,
    txHash: null, explorerUrl: null, declineReason: null, resolvesAt: Date.now() + scenario.settleMs, outcome: scenario.orderOutcome, settled: false,
  }
  state.orders.push(order)
  state.idempotency[key] = { userId, bodyHash, orderId: id }
  let dropResponse = false
  if (scenario.orderTimeoutOnce && hits('orderTimeout') === 0) { hit('orderTimeout'); dropResponse = true }
  save()
  return { kind: 'ok', order, replayed: false, dropResponse }
}

const orderEvent = (o: OrderRecord): OrderUpdatedEvent => ({
  eventId: `evt_${o.id}_v${o.version}`, type: 'order.updated', orderId: o.id, userId: o.userId, version: o.version, status: o.status, occurredAt: new Date().toISOString(),
})

/** Resolve pedidos pendentes vencidos. É lazy: sobrevive a refresh e é chamado por handlers e por um timer. */
export function settleDueOrders(now = Date.now()) {
  for (const o of state.orders) {
    if (o.status !== 'pending' || o.resolvesAt > now) continue
    if (o.outcome === 'confirmed') {
      for (const l of o.lines) {
        const n = findNft(l.nftId); const e = n?.editions.find((x) => x.id === l.editionId)
        if (n && e) updateNft(n.id, { editions: [{ id: e.id, available: e.available - l.quantity }] })
      }
      const key = `user:${o.userId}`
      if (state.carts[key]) mutateCart(key, (c) => {
        for (const l of o.lines) { const it = c.items.find((i) => i.nftId === l.nftId && i.editionId === l.editionId); if (it) it.quantity -= l.quantity }
        c.items = c.items.filter((i) => i.quantity > 0)
      })
      o.status = 'confirmed'; o.txHash = fakeHash(o.id); o.explorerUrl = `https://etherscan.io/tx/${o.txHash}`
    } else {
      o.status = 'declined'; o.declineReason = 'Pagamento recusado pela carteira (simulação).'
    }
    o.version += 1; o.updatedAt = new Date().toISOString(); o.settled = true
    save(); emit(orderEvent(o))
  }
}

export const publicOrder = (o: OrderRecord): Order => {
  const { userId: _u, resolvesAt: _r, outcome: _o, settled: _s, ...rest } = o
  void _u; void _r; void _o; void _s
  return rest
}
export const currentOrderEvent = orderEvent
