import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cartApi, favoritesApi, nftApi, quoteApi } from '@/api/endpoints'
import { isApiError } from '@/api/client'
import type { CartItem, CartResponse, FavoritesResponse, NetworkId, NftListQuery } from '@/api/types'
import { qk, scopeOf } from '@/lib/query'
import { getGuestId, useSession } from '@/lib/session'
import { toast } from '@/components/ui/toaster'

export const useUserId = () => useSession().user?.id ?? null
export const useCartScope = () => scopeOf(useUserId(), getGuestId())

export const FEATURED_QUERY: NftListQuery = { sort: 'popular', page: 1, pageSize: 3 }
export const nftListOptions = (q: NftListQuery) => ({ queryKey: qk.nfts(q), queryFn: ({ signal }: { signal: AbortSignal }) => nftApi.list(q, { signal }) })

export function useNfts(q: NftListQuery) {
  // `signal` cancela a requisição obsoleta; `placeholderData` mantém a página anterior enquanto carrega a nova.
  return useQuery({ ...nftListOptions(q), placeholderData: (prev) => prev })
}

export const useNft = (id: string) => useQuery({ queryKey: qk.nft(id), queryFn: ({ signal }) => nftApi.detail(id, { signal }), retry: (n, e) => !(isApiError(e) && e.status === 404) && n < 2 && isApiError(e) && e.transient })

export function useFavorites() {
  const uid = useUserId()
  return useQuery({ queryKey: qk.favorites(uid ?? 'none'), queryFn: ({ signal }) => favoritesApi.list({ signal }), enabled: !!uid })
}

/** Favoritar com atualização otimista e rollback em caso de falha. */
export function useToggleFavorite() {
  const qc = useQueryClient()
  const uid = useUserId()
  return useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean }) => (favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId)),
    onMutate: async ({ nftId, favorite }) => {
      const key = qk.favorites(uid ?? 'none')
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<FavoritesResponse>(key)
      qc.setQueryData<FavoritesResponse>(key, (old) => {
        const ids = new Set(old?.nftIds ?? [])
        if (favorite) ids.add(nftId); else ids.delete(nftId)
        return { nftIds: [...ids] }
      })
      return { previous, key }
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.previous)
      toast('Não foi possível atualizar os favoritos. Tente novamente.', 'error')
    },
    onSettled: (_d, _e, _v, ctx) => { if (ctx) void qc.invalidateQueries({ queryKey: ctx.key }) },
  })
}

export function useCart() {
  const scope = useCartScope()
  return useQuery({ queryKey: qk.cart(scope), queryFn: ({ signal }) => cartApi.get({ signal }) })
}

export function useCartMutations() {
  const qc = useQueryClient()
  const scope = useCartScope()
  const onSuccess = (cart: CartResponse) => { qc.setQueryData(qk.cart(scope), cart); void qc.invalidateQueries({ queryKey: ['quote'] }) }
  const onError = (e: unknown) => toast(isApiError(e) ? e.message : 'Não foi possível atualizar o carrinho.', 'error')
  return {
    add: useMutation({ mutationFn: (i: CartItem) => cartApi.add(i), onSuccess: (c) => { onSuccess(c); toast('Adicionado ao carrinho.', 'success', 3000) }, onError }),
    update: useMutation({ mutationFn: (i: CartItem) => cartApi.update(i), onSuccess, onError }),
    remove: useMutation({ mutationFn: (i: { nftId: string; editionId: string }) => cartApi.remove(i.nftId, i.editionId), onSuccess, onError }),
    applyCoupon: useMutation({ mutationFn: (code: string) => cartApi.applyCoupon(code), onSuccess }),
    removeCoupon: useMutation({ mutationFn: () => cartApi.removeCoupon(), onSuccess, onError }),
  }
}

export function useQuote(items: CartItem[], coupon: string | null, network: NetworkId, enabled = true) {
  const scope = useCartScope()
  return useQuery({
    queryKey: qk.quote(scope, items, coupon, network),
    queryFn: ({ signal }) => quoteApi.get({ items, couponCode: coupon, network }, { signal }),
    enabled: enabled && items.length > 0,
    placeholderData: (prev) => prev,
  })
}
