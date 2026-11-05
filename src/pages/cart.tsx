import { useDocumentTitle } from '@/lib/title'
import { Link } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { isApiError } from '@/api/client'
import type { NetworkId } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumb, EmptyState, ErrorState, NftCard, NftCardSkeleton, QuantityStepper, SummaryRows, SummarySkeleton } from '@/features/shared'
import { formatEth } from '@/lib/eth'
import { useCart, useCartMutations, useNfts, useQuote } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { asset } from '@/lib/base'

const COLS = 'sm:grid sm:grid-cols-[minmax(0,1fr)_88px_92px_96px_32px] sm:items-center sm:gap-4'

function LineSkeleton() {
  return <li className="flex h-[70px] items-center gap-4 bg-surface pr-4" aria-hidden="true"><Skeleton className="h-[70px] w-[70px] shrink-0 rounded-md" /><div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/4" /></div><Skeleton className="h-4 w-20" /></li>
}

function AlsoViewed() {
  const q = useNfts({ sort: 'popular', page: 1, pageSize: 5 })
  return (
    <section aria-labelledby="tambem" className="mt-24">
      <h2 id="tambem" className="text-[17px] font-bold text-primary-soft">Colecionadores também viram</h2>
      <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-7">
        {q.isLoading ? [0, 1, 2, 3, 4].map((i) => <li key={i}><NftCardSkeleton /></li>) : q.data?.items.map((n) => <li key={n.id}><NftCard nft={n} /></li>)}
      </ul>
    </section>
  )
}

export default function CartPage() {
  useDocumentTitle('Carrinho')
  const { status } = useSession()
  const cart = useCart()
  const m = useCartMutations()
  const couponId = useId()
  const [network] = useState<NetworkId>('ethereum')
  const [code, setCode] = useState('')
  const [couponError, setCouponError] = useState<string | null>(null)
  const items = cart.data?.items ?? []
  const quote = useQuote(items, cart.data?.couponCode ?? null, network, !!cart.data)

  const apply = () => {
    setCouponError(null)
    m.applyCoupon.mutate(code, { onSuccess: () => setCode(''), onError: (e) => setCouponError(isApiError(e) ? (e.fieldErrors.code ?? e.message) : 'Não foi possível aplicar o cupom.') })
  }
  const cta = status === 'authenticated' ? 'Conectar e finalizar' : 'Entrar e finalizar'

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 xl:px-0">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', href: asset('#catalogo') }, { label: 'Carrinho' }]} />
      <h1 className="sr-only">Carrinho de NFTs</h1>
      {cart.isLoading ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_332px]" aria-busy="true"><ul className="flex flex-col gap-3"><LineSkeleton /><LineSkeleton /></ul><SummarySkeleton /></div>
      ) : cart.error && !cart.data ? (
        <div className="mt-6"><ErrorState error={cart.error} onRetry={() => void cart.refetch()} title="Não foi possível carregar o carrinho" /></div>
      ) : items.length === 0 ? (
        <div className="mt-6"><EmptyState title="Seu carrinho está vazio"><p>Explore o catálogo e adicione NFTs para começar.</p><Button asChild className="mt-4"><Link to="/">Explorar NFTs</Link></Button></EmptyState></div>
      ) : (
        <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,782px)_332px] lg:justify-between">
          <div>
            <div aria-hidden="true" className={`mb-3 hidden px-3 text-base text-fg ${COLS}`}><span className="font-bold">NFTs</span><span className="font-medium">Preço</span><span className="font-bold">Edições</span><span className="font-medium">Total</span><span /></div>
            <ul className="flex flex-col gap-3" data-testid="cart-lines">
              {quote.data ? quote.data.lines.map((l) => {
                const cap = Math.max(Math.min(l.available, 10), 1)
                const busy = m.update.isPending || m.remove.isPending
                return (
                  <li key={`${l.nftId}-${l.editionId}`} className="overflow-hidden rounded-[14px] bg-surface sm:rounded-none" data-testid="cart-line">
                    <div className={`grid grid-cols-[100px_minmax(0,1fr)_auto] items-center gap-x-3 pr-3 ${COLS} sm:pr-3`}>
                      <div className="contents sm:flex sm:min-w-0 sm:items-center sm:gap-4">
                        {l.image ? <img src={l.image} alt={`Arte “${l.title}”`} width={100} height={100} className="row-span-2 h-[100px] w-[100px] shrink-0 rounded-[14px] object-cover sm:h-[70px] sm:w-[70px] sm:rounded-md" /> : <div className="row-span-2 h-[100px] w-[100px] shrink-0 rounded-[14px] bg-surface-2 sm:h-[70px] sm:w-[70px]" />}
                        <div className="min-w-0 self-end sm:self-auto">
                          <h2 className="truncate text-[15px] font-bold text-fg sm:text-base"><Link to="/nft/$nftId" params={{ nftId: l.nftId }} className="hover:text-primary-soft">{l.title}</Link></h2>
                          <p className="text-sm text-[#b39463]">Edição: {l.editionLabel}</p>
                        </div>
                      </div>
                      <p className="hidden text-base font-bold text-muted sm:block"><span className="sr-only">Preço unitário: </span>{formatEth(l.unitPrice)}</p>
                      <div className="col-start-3 row-start-1 self-end sm:col-auto sm:row-auto sm:self-auto">
                        <QuantityStepper label={l.title} value={l.quantity} max={cap} disabled={busy} onChange={(n) => m.update.mutate({ nftId: l.nftId, editionId: l.editionId, quantity: n })} />
                      </div>
                      <p className="col-start-2 row-start-2 self-start text-lg font-bold text-primary-soft sm:col-auto sm:row-auto sm:self-auto sm:text-base"><span className="sr-only">Total do item: </span>{formatEth(l.lineTotal)}</p>
                      <button type="button" disabled={busy} onClick={() => m.remove.mutate({ nftId: l.nftId, editionId: l.editionId })} aria-label={`Remover ${l.title}`} className="col-start-3 row-start-2 grid h-8 w-8 cursor-pointer place-items-center self-start justify-self-end rounded text-fg hover:text-danger disabled:opacity-50 sm:col-auto sm:row-auto sm:self-auto"><Trash2 aria-hidden="true" className="h-5 w-5" strokeWidth={1.6} /></button>
                    </div>
                    {l.issue && <p role="alert" className="border-t border-line px-3 py-2 text-sm font-medium text-danger">⚠ {l.issue === 'sold_out' ? 'Esta edição esgotou. Remova o item para continuar.' : l.issue === 'insufficient' ? `Restam apenas ${l.available}. Reduza a quantidade.` : 'Item indisponível.'}</p>}
                  </li>
                )
              }) : quote.error ? <ErrorState error={quote.error} onRetry={() => void quote.refetch()} title="Não foi possível calcular o carrinho" /> : items.map((i) => <LineSkeleton key={i.nftId + i.editionId} />)}
            </ul>
          </div>

          <aside className="flex h-fit flex-col gap-6 rounded-[14px] bg-surface p-6 lg:sticky lg:top-24 lg:rounded-none lg:bg-transparent lg:p-0" aria-label="Resumo do pedido">
            <h2 className="text-lg font-bold leading-7 text-fg">Resumo da carteira</h2>
            <div className="flex flex-col gap-2">
              {cart.data?.couponCode && quote.data?.coupon ? (
                <div className="flex items-center justify-between gap-3 rounded-[3px] border border-primary px-3 py-2 text-sm"><span>Cupom <strong>{quote.data.coupon.code}</strong> aplicado (−{quote.data.coupon.percentOff}%)</span><Button size="sm" variant="link" onClick={() => m.removeCoupon.mutate()}>Remover</Button></div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); apply() }} className="flex flex-col gap-2">
                  <label htmlFor={couponId} className="text-sm font-bold text-fg">Código promocional</label>
                  <div className="flex h-10 overflow-hidden rounded-[3px] border border-primary">
                    <input id={couponId} value={code} onChange={(e) => { setCode(e.target.value); setCouponError(null) }} aria-invalid={!!couponError || undefined} aria-describedby={couponError ? `${couponId}-err` : undefined} placeholder="Digite o código promocional..." autoComplete="off" className="min-w-0 flex-1 bg-transparent px-2 text-xs text-fg placeholder:text-[#b39463]" />
                    <button type="submit" disabled={!code.trim() || m.applyCoupon.isPending} className="w-[102px] cursor-pointer bg-primary text-[15px] font-bold text-bg disabled:cursor-not-allowed disabled:opacity-60">Aplicar</button>
                  </div>
                  {couponError && <p id={`${couponId}-err`} className="text-xs font-medium text-danger">⚠ {couponError}</p>}
                </form>
              )}
              {quote.data?.couponError && <p role="alert" className="text-sm text-danger">⚠ {quote.data.couponError.message} <button className="cursor-pointer underline" onClick={() => m.removeCoupon.mutate()}>Remover cupom</button></p>}
            </div>
            <div className="min-h-40" aria-live="polite">{quote.data ? <SummaryRows quote={quote.data} /> : <SummarySkeleton />}</div>
            <div className="flex flex-col gap-3">
              {quote.data?.valid ? (
                <Button asChild className="w-full rounded-[3px] text-[15px]"><Link to="/checkout">{cta}</Link></Button>
              ) : (
                <Button className="w-full rounded-[3px] text-[15px]" disabled>{cta}</Button>
              )}
              <Link to="/" className="text-center text-[15px] text-primary-soft hover:underline">Continuar explorando</Link>
            </div>
          </aside>
        </div>
      )}
      <AlsoViewed />
    </div>
  )
}
