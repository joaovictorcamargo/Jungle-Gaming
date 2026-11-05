import { http } from './client'
import type {
  CartItem, CartResponse, FavoritesResponse, LoginInput, NftDetail, NftListQuery, NftListResponse, Order, OrderInput,
  PasswordInput, ProfileInput, Quote, QuoteInput, RegisterInput, Session, User, Wallet, WalletConnection, WalletInput, NetworkId,
} from './types'

type Opts = { signal?: AbortSignal }

export const authApi = {
  register: (i: RegisterInput) => http.post<Session>('/auth/register', i).then((r) => r.data),
  login: (i: LoginInput) => http.post<Session>('/auth/login', i).then((r) => r.data),
  session: (o?: Opts) => http.get<Session>('/auth/session', o).then((r) => r.data),
  logout: (token: string) => http.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } }).then(() => undefined),
}

export const nftApi = {
  list: (q: NftListQuery, o?: Opts) => http.get<NftListResponse>('/nfts', { params: q, ...o }).then((r) => r.data),
  detail: (id: string, o?: Opts) => http.get<NftDetail>(`/nfts/${encodeURIComponent(id)}`, o).then((r) => r.data),
}

export const favoritesApi = {
  list: (o?: Opts) => http.get<FavoritesResponse>('/favorites', o).then((r) => r.data),
  add: (id: string) => http.put<FavoritesResponse>(`/favorites/${encodeURIComponent(id)}`).then((r) => r.data),
  remove: (id: string) => http.delete<FavoritesResponse>(`/favorites/${encodeURIComponent(id)}`).then((r) => r.data),
}

export const cartApi = {
  get: (o?: Opts) => http.get<CartResponse>('/cart', o).then((r) => r.data),
  add: (i: CartItem) => http.post<CartResponse>('/cart/items', i).then((r) => r.data),
  update: (i: CartItem) => http.patch<CartResponse>('/cart/items', i).then((r) => r.data),
  remove: (nftId: string, editionId: string) => http.delete<CartResponse>(`/cart/items/${nftId}/${editionId}`).then((r) => r.data),
  applyCoupon: (code: string) => http.put<CartResponse>('/cart/coupon', { code }).then((r) => r.data),
  removeCoupon: () => http.delete<CartResponse>('/cart/coupon').then((r) => r.data),
  merge: (guestId: string, token?: string) =>
    http.post<CartResponse>('/cart/merge', { guestId }, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined).then((r) => r.data),
}

export const quoteApi = {
  get: (i: QuoteInput, o?: Opts) => http.post<Quote>('/quote', i, o).then((r) => r.data),
}

export const orderApi = {
  create: (i: OrderInput, idempotencyKey: string) =>
    http.post<Order>('/orders', i, { headers: { 'Idempotency-Key': idempotencyKey }, timeout: 4000 }).then((r) => r.data),
  get: (id: string, o?: Opts) => http.get<Order>(`/orders/${id}`, o).then((r) => r.data),
  pending: (o?: Opts) => http.get<{ order: Order | null }>('/orders/pending', o).then((r) => r.data.order),
}

export const profileApi = {
  get: (o?: Opts) => http.get<User>('/profile', o).then((r) => r.data),
  update: (i: ProfileInput) => http.put<User>('/profile', i).then((r) => r.data),
  uploadAvatar: (file: File) => { const f = new FormData(); f.append('avatar', file); return http.post<User>('/profile/avatar', f).then((r) => r.data) },
  changePassword: (i: PasswordInput) => http.put('/profile/password', i).then(() => undefined),
}

export const walletApi = {
  list: (o?: Opts) => http.get<{ wallets: Wallet[] }>('/wallets', o).then((r) => r.data.wallets),
  create: (i: WalletInput) => http.post<Wallet>('/wallets', i).then((r) => r.data),
  update: (id: string, i: WalletInput) => http.put<Wallet>(`/wallets/${id}`, i).then((r) => r.data),
  connect: (id: string, network: NetworkId) => http.post<WalletConnection>(`/wallets/${id}/connect`, { network }).then((r) => r.data),
  disconnect: (id: string) => http.post<WalletConnection>(`/wallets/${id}/disconnect`).then((r) => r.data),
}
