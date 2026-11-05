import type { EthString } from '@/lib/eth'

/* ---------- Erros ---------- */
export type ApiErrorCode =
  | 'validation_error'
  | 'invalid_credentials'
  | 'email_taken'
  | 'unauthenticated'
  | 'session_expired'
  | 'forbidden'
  | 'not_found'
  | 'availability_conflict'
  | 'quote_changed'
  | 'idempotency_conflict'
  | 'coupon_invalid'
  | 'coupon_expired'
  | 'wallet_rejected'
  | 'transient_failure'
  | 'network_error'
  | 'timeout'
  | 'unknown'

export interface ApiErrorBody {
  code: ApiErrorCode
  message: string
  fieldErrors?: Record<string, string>
  /** Cotação atualizada quando code = quote_changed / availability_conflict */
  quote?: Quote
}

/* ---------- Conta ---------- */
export interface User {
  id: string
  name: string
  email: string
  bio: string
  avatarUrl: string | null
}

export interface Session {
  token: string
  expiresAt: string
  user: User
}

export interface LoginInput { email: string; password: string }
export interface RegisterInput { name: string; email: string; password: string }
export interface ProfileInput { name: string; email: string; bio: string }
export interface PasswordInput { currentPassword: string; newPassword: string }

/* ---------- NFTs ---------- */
export type Category = 'arte' | 'musica' | 'fotografia' | 'games'
export type NftSort = 'newest' | 'popular' | 'price_asc' | 'price_desc'

export interface Edition {
  id: string
  label: string
  supply: number
  available: number
}

export interface NftSummary {
  id: string
  title: string
  creator: string
  collection: string
  category: Category
  /** Rede em que o token foi cunhado. */
  network: NetworkId
  price: EthString
  available: number
  image: string
  featured: boolean
  likes: number
  version: number
}

export interface NftReview { id: string; author: string; rating: number; text: string }

export interface NftDetail extends NftSummary {
  description: string
  gallery: string[]
  editions: Edition[]
  createdAt: string
  maxPerOrder: number
  /** Número do token no contrato (ex.: "0042"). */
  tokenId: string
  attributes: string[]
  contract: string
  royaltyPercent: number
  rating: { average: number; count: number }
  reviews: NftReview[]
}

export interface NftListQuery {
  q?: string
  category?: Category
  collection?: string
  network?: NetworkId
  minPrice?: EthString
  maxPrice?: EthString
  inStock?: boolean
  sort: NftSort
  page: number
  pageSize: number
}

export interface NftListResponse {
  items: NftSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  /** Eco dos parâmetros efetivamente aplicados pela API. */
  query: NftListQuery
  facets: { collections: string[]; categories: Category[]; categoryCounts: Record<Category, number>; networkCounts: Record<NetworkId, number>; priceRange: { min: EthString; max: EthString } }
}

/* ---------- Favoritos ---------- */
export interface FavoritesResponse { nftIds: string[] }

/* ---------- Carrinho ---------- */
export interface CartItem { nftId: string; editionId: string; quantity: number }
export interface CartResponse { items: CartItem[]; couponCode: string | null; version: number }

/* ---------- Cotação ---------- */
export type NetworkId = 'ethereum' | 'polygon' | 'base'

export interface QuoteInput {
  items: CartItem[]
  couponCode?: string | null
  network: NetworkId
}

export interface QuoteLine {
  nftId: string
  editionId: string
  editionLabel: string
  title: string
  image: string
  quantity: number
  unitPrice: EthString
  lineTotal: EthString
  /** Disponibilidade atual da edição. */
  available: number
  issue: null | 'sold_out' | 'insufficient' | 'not_found'
}

export interface Quote {
  /** Identificador determinístico do conteúdo da cotação (preços, descontos, taxas). */
  quoteId: string
  network: NetworkId
  lines: QuoteLine[]
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  coupon: null | { code: string; percentOff: number }
  couponError: null | { code: 'coupon_invalid' | 'coupon_expired'; message: string }
  valid: boolean
}

/* ---------- Carteiras ---------- */
export type WalletKind = 'primary' | 'secondary'
export interface Wallet {
  id: string
  kind: WalletKind
  label: string
  address: string
  network: NetworkId
}
export interface WalletInput { kind: WalletKind; label: string; address: string; network: NetworkId }
export interface WalletConnection { walletId: string; connected: boolean; network: NetworkId }

/* ---------- Pedidos ---------- */
export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface Collector { name: string; email: string; document: string }

export interface OrderInput {
  items: CartItem[]
  couponCode: string | null
  network: NetworkId
  walletId: string
  collector: Collector
  /** Cotação que o usuário revisou e confirmou. */
  quoteId: string
  expectedTotal: EthString
}

export interface OrderReceiptLine {
  nftId: string
  editionId: string
  editionLabel: string
  title: string
  image: string
  quantity: number
  unitPrice: EthString
  lineTotal: EthString
}

export interface Order {
  id: string
  status: OrderStatus
  version: number
  createdAt: string
  updatedAt: string
  network: NetworkId
  walletAddress: string
  collector: Collector
  /** Snapshot imutável do pedido. */
  lines: OrderReceiptLine[]
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  couponCode: string | null
  txHash: string | null
  explorerUrl: string | null
  declineReason: string | null
}

/* ---------- Tempo real ---------- */
export interface NftUpdatedEvent {
  eventId: string
  type: 'nft.updated'
  nftId: string
  version: number
  price: EthString
  available: number
  editions: { id: string; available: number }[]
  occurredAt: string
}

export interface OrderUpdatedEvent {
  eventId: string
  type: 'order.updated'
  orderId: string
  userId: string
  version: number
  status: OrderStatus
  occurredAt: string
}
