import { createRootRoute, createRoute, createRouter, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { authApi } from '@/api/endpoints'
import type { Category, NetworkId, NftSort } from '@/api/types'
import { clearSession, getSession, setSession } from '@/lib/session'
import { Root } from '@/components/layout/root'
import { NotFound } from '@/components/layout/not-found'
import { isEth } from '@/lib/eth'
import { queryClient } from '@/lib/query'
import { FEATURED_QUERY, nftListOptions } from '@/lib/hooks'
import { mergeGuestCart } from '@/lib/useAuthActions'

export interface HomeSearch { q?: string; category?: Category; collection?: string; network?: NetworkId; minPrice?: string; maxPrice?: string; inStock?: boolean; sort?: NftSort; page?: number }

let boot: Promise<void> | null = null
/** Resolve a sessão persistida uma única vez (refresh recupera a sessão). */
export function ensureSession(): Promise<void> {
  if (getSession().status !== 'loading') return Promise.resolve()
  boot ??= authApi.session().then(async (s) => { setSession(s); await mergeGuestCart() }).catch(() => clearSession())
  return boot
}

async function requireAuth({ location }: { location: { href: string } }) {
  await ensureSession()
  if (getSession().status !== 'authenticated') throw redirect({ to: '/login', search: { redirect: location.href } })
}

// Rotas públicas não esperam a sessão (renderização imediata); as privadas aguardam em `requireAuth`.
const rootRoute = createRootRoute({ component: Root, notFoundComponent: NotFound, beforeLoad: () => { void ensureSession() } })

const CATS: Category[] = ['arte', 'musica', 'fotografia', 'games']
const NETS: NetworkId[] = ['ethereum', 'polygon', 'base']
const SORTS: NftSort[] = ['newest', 'popular', 'price_asc', 'price_desc']
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined)

const indexRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/',
  validateSearch: (s: Record<string, unknown>): HomeSearch => {
    const page = Number(s.page)
    return {
      q: str(s.q), category: CATS.includes(s.category as Category) ? (s.category as Category) : undefined, collection: str(s.collection),
      network: NETS.includes(s.network as NetworkId) ? (s.network as NetworkId) : undefined,
      minPrice: isEth(String(s.minPrice ?? '')) ? String(s.minPrice) : undefined, maxPrice: isEth(String(s.maxPrice ?? '')) ? String(s.maxPrice) : undefined,
      inStock: s.inStock === 'true' || s.inStock === true ? true : undefined,
      sort: SORTS.includes(s.sort as NftSort) ? (s.sort as NftSort) : undefined, page: Number.isInteger(page) && page > 1 ? page : undefined,
    }
  },
  // Pré-busca os dados em paralelo ao carregamento do chunk da rota.
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => {
    void queryClient.prefetchQuery(nftListOptions(FEATURED_QUERY))
    void queryClient.prefetchQuery(nftListOptions({ ...deps, sort: deps.sort ?? 'newest', page: deps.page ?? 1, pageSize: 9 }))
  },
  component: lazyRouteComponent(() => import('./pages/home')),
})
const nftRoute = createRoute({ getParentRoute: () => rootRoute, path: '/nft/$nftId', component: lazyRouteComponent(() => import('./pages/nft-detail')) })
const cartRoute = createRoute({ getParentRoute: () => rootRoute, path: '/carrinho', component: lazyRouteComponent(() => import('./pages/cart')) })
const checkoutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/checkout', beforeLoad: requireAuth, component: lazyRouteComponent(() => import('./pages/checkout')) })
const orderRoute = createRoute({ getParentRoute: () => rootRoute, path: '/pedido/$orderId', beforeLoad: requireAuth, component: lazyRouteComponent(() => import('./pages/order')) })

const authSearch = (s: Record<string, unknown>): { redirect?: string; reason?: 'expired' } => ({ redirect: typeof s.redirect === 'string' && s.redirect.startsWith('/') && !s.redirect.startsWith('//') ? s.redirect : undefined, reason: s.reason === 'expired' ? 'expired' : undefined })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', validateSearch: authSearch, component: lazyRouteComponent(() => import('./pages/login')) })
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cadastro', validateSearch: authSearch, component: lazyRouteComponent(() => import('./pages/register')) })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/perfil', beforeLoad: requireAuth, component: lazyRouteComponent(() => import('./pages/profile')) })
const walletsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/carteiras', beforeLoad: requireAuth, component: lazyRouteComponent(() => import('./pages/wallets')) })

const routeTree = rootRoute.addChildren([indexRoute, nftRoute, cartRoute, checkoutRoute, orderRoute, loginRoute, registerRoute, profileRoute, walletsRoute])

const parseSearch = (s: string) => Object.fromEntries(new URLSearchParams(s)) as Record<string, string>
const stringifySearch = (o: Record<string, unknown>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const router = createRouter({ routeTree, basepath: import.meta.env.BASE_URL.replace(/\/$/, '') || '/', parseSearch, stringifySearch, defaultPreload: 'intent', scrollRestoration: true })
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
