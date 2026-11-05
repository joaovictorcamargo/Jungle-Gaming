import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/api/client'
import type { CartItem, NetworkId, NftListQuery } from '@/api/types'

/**
 * Política de cache (documentada em ARCHITECTURE.md):
 * - staleTime 30s para leituras públicas; refetch ao reconectar o socket e ao focar a janela.
 * - gcTime 5 min. Dados privados vivem sob a chave ['u', userId, ...] e são removidos no logout/troca de usuário.
 * - Retry apenas para consultas (GET) com falha transitória (rede, timeout, 5xx): até 2 tentativas, backoff exponencial.
 * - Mutations nunca fazem retry automático (evita duplicar operações); o pedido usa chave de idempotência.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => count < 2 && isApiError(error) && error.transient,
      retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 3000),
    },
    mutations: { retry: false },
  },
})

export const scopeOf = (userId: string | null, guestId: string) => userId ?? `guest:${guestId}`

export const qk = {
  session: ['session'] as const,
  nfts: (q: NftListQuery) => ['nfts', 'list', q] as const,
  nft: (id: string) => ['nfts', 'detail', id] as const,
  favorites: (uid: string) => ['u', uid, 'favorites'] as const,
  cart: (scope: string) => ['cart', scope] as const,
  quote: (scope: string, items: CartItem[], coupon: string | null, network: NetworkId) => ['quote', scope, { items, coupon, network }] as const,
  profile: (uid: string) => ['u', uid, 'profile'] as const,
  wallets: (uid: string) => ['u', uid, 'wallets'] as const,
  order: (uid: string, id: string) => ['u', uid, 'order', id] as const,
  pendingOrder: (uid: string) => ['u', uid, 'order', 'pending'] as const,
}

/** Remove todos os dados privados em cache (logout, expiração, troca de usuário). */
export function purgePrivateCache() {
  queryClient.cancelQueries()
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] === 'u' || q.queryKey[0] === 'cart' || q.queryKey[0] === 'quote' })
}
