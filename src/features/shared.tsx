import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Heart, Minus, Plus, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { NftSummary, Quote } from '@/api/types'
import { isApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { networkLabel } from '@/lib/format'
import { useFavorites, useToggleFavorite } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

export function ErrorState({ error, onRetry, title = 'Não foi possível carregar' }: { error: unknown; onRetry?: () => void; title?: string }) {
  const offline = isApiError(error) && (error.code === 'network_error' || error.code === 'timeout')
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-md border border-danger/50 bg-surface px-6 py-10 text-center">
      <TriangleAlert aria-hidden="true" className="h-8 w-8 text-danger" />
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="max-w-md text-sm text-muted">{offline ? 'Sem conexão com o servidor. Verifique sua internet e tente novamente.' : isApiError(error) ? error.message : 'Ocorreu um erro inesperado.'}</p>
      {onRetry && <Button variant="outline" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md bg-surface px-6 py-14 text-center">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="max-w-md text-sm text-muted">{children}</div>
    </div>
  )
}

export function FavoriteButton({ nftId, title, className }: { nftId: string; title: string; className?: string }) {
  const { status } = useSession()
  const { data } = useFavorites()
  const toggle = useToggleFavorite()
  const navigate = useNavigate()
  const location = useLocation()
  const active = data?.nftIds.includes(nftId) ?? false
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${active ? 'Remover dos favoritos' : 'Favoritar'}: ${title}`}
      className={cn('grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-line bg-surface-2/90 hover:border-primary', className)}
      onClick={(e) => {
        e.preventDefault(); e.stopPropagation()
        if (status !== 'authenticated') { void navigate({ to: '/login', search: { redirect: location.href } }); return }
        toggle.mutate({ nftId, favorite: !active })
      }}
    >
      <Heart aria-hidden="true" className={cn('h-[18px] w-[18px]', active ? 'fill-primary-soft text-primary-soft' : 'text-primary-soft')} />
    </button>
  )
}

export function NftCard({ nft, priority = false }: { nft: NftSummary; priority?: boolean }) {
  const soldOut = nft.available === 0
  return (
    <article className="group relative">
      <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="block" aria-label={`${nft.title}, ${formatEth(nft.price)}${soldOut ? ', esgotado' : ''}`}>
        <div className="bg-surface px-1 pb-7 pt-6 transition-colors group-hover:bg-surface-2">
          <img src={nft.image} alt={`Arte digital “${nft.title}” por ${nft.creator}`} width={400} height={400} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" className="aspect-square w-full rounded-[15px] object-cover" />
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <h3 className="truncate text-base text-fg">{nft.title}</h3>
          <p className="text-lg font-bold text-primary-soft" data-testid="price">{formatEth(nft.price)}</p>
          <p className="truncate text-xs text-muted">{nft.collection} · {soldOut ? 'Esgotado' : `${nft.available} disp.`}</p>
        </div>
      </Link>
      {soldOut && <span className="pointer-events-none absolute left-0 top-6 bg-primary px-3 py-1 text-sm font-medium text-bg">ESGOTADO</span>}
      <FavoriteButton nftId={nft.id} title={nft.title} className="absolute right-3 top-8" />
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="bg-surface px-1 pb-7 pt-6"><Skeleton className="aspect-square w-full rounded-[15px]" /></div>
      <div className="mt-3 flex flex-col gap-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-5 w-24" /><Skeleton className="h-3 w-1/2" /></div>
    </div>
  )
}

export function QuantityStepper({ value, min = 1, max, onChange, disabled, label }: { value: number; min?: number; max: number; onChange: (n: number) => void; disabled?: boolean; label: string }) {
  const btn = 'grid h-[30px] w-5 cursor-pointer place-items-center rounded-full border border-bg bg-primary text-bg hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-3">
      <button type="button" className={btn} aria-label={`Diminuir quantidade de ${label}`} disabled={disabled || value <= min} onClick={() => onChange(value - 1)}><Minus aria-hidden="true" className="h-3.5 w-3.5" /></button>
      <output aria-live="polite" aria-label={`Quantidade de ${label}`} className="min-w-4 text-center text-[17px] text-fg">{value}</output>
      <button type="button" className={btn} aria-label={`Aumentar quantidade de ${label}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}><Plus aria-hidden="true" className="h-3.5 w-3.5" /></button>
    </div>
  )
}

export function SummaryRows({ quote }: { quote: Quote }) {
  return (
    <dl className="flex flex-col gap-3 text-[15px] text-fg">
      <div className="flex items-center justify-between gap-4"><dt>Subtotal</dt><dd className="text-lg">{formatEth(quote.subtotal)}</dd></div>
      <div className="flex items-center justify-between gap-4"><dt>Desconto do lançamento{quote.coupon ? ` (${quote.coupon.code})` : ''}</dt><dd data-testid="summary-discount">{quote.discount === '0' ? '(-) 0.00' : `(-) ${formatEth(quote.discount)}`}</dd></div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4"><dt>Taxa de rede <span className="sr-only">({networkLabel[quote.network]})</span></dt><dd className="text-lg">{formatEth(quote.networkFee)}</dd></div>
        <p className="text-right text-xs text-primary-soft">Taxa estimada · {networkLabel[quote.network]}</p>
      </div>
      <div className="flex items-center justify-between gap-4 pt-1 text-base font-bold"><dt>Total</dt><dd className="text-lg text-primary-soft" data-testid="summary-total">{formatEth(quote.total)}</dd></div>
    </dl>
  )
}

export function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {[0, 1, 2].map((i) => <div key={i} className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-20" /></div>)}
      <div className="mt-2 flex justify-between border-t border-line pt-3"><Skeleton className="h-6 w-16" /><Skeleton className="h-6 w-28" /></div>
    </div>
  )
}

type Crumb = { label: string; to?: '/' | '/carrinho' | '/checkout'; href?: string }
/** Trilha "Início / Mercado / …" dos quadros do Figma. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Trilha" className="mb-3 text-[15px] font-bold text-fg">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => {
          const last = i === items.length - 1
          return (
            <li key={c.label} className="flex items-center gap-1">
              {last ? <span aria-current="page" className="truncate">{c.label}</span> : c.to ? <Link to={c.to} className="hover:text-primary-soft">{c.label}</Link> : <a href={c.href} className="hover:text-primary-soft">{c.label}</a>}
              {!last && <span aria-hidden="true">/</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
