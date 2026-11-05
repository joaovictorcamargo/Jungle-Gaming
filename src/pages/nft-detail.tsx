import { useDocumentTitle } from '@/lib/title'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Share2, ShoppingCart, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isApiError } from '@/api/client'
import type { NftDetail } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toaster'
import { Breadcrumb, EmptyState, ErrorState, FavoriteButton, NftCard, NftCardSkeleton, QuantityStepper } from '@/features/shared'
import { formatEth } from '@/lib/eth'
import { networkLabel } from '@/lib/format'
import { useCartMutations, useNft, useNfts } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { asset } from '@/lib/base'

function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[573px_1fr]" aria-busy="true" data-testid="detail-skeleton">
      <span className="sr-only-live" role="status">Carregando NFT…</span>
      <div className="flex gap-7"><div className="hidden flex-col gap-4 sm:flex">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[100px] w-[100px]" />)}</div><Skeleton className="aspect-square w-full max-w-[444px]" /></div>
      <div className="flex flex-col gap-4"><Skeleton className="h-9 w-3/4" /><Skeleton className="h-6 w-1/2" /><Skeleton className="h-24 w-full" /><Skeleton className="h-8 w-56" /><Skeleton className="h-12 w-72" /></div>
    </div>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span aria-hidden="true" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn('h-[15px] w-[15px]', i <= Math.round(value) ? 'fill-primary-soft text-primary-soft' : 'text-line-soft')} />)}
    </span>
  )
}

function Detail({ nft }: { nft: NftDetail }) {
  const navigate = useNavigate()
  const { add } = useCartMutations()
  const firstAvailable = nft.editions.find((e) => e.available > 0)?.id ?? nft.editions[0]!.id
  const [editionId, setEditionId] = useState(firstAvailable)
  const [qty, setQty] = useState(1)
  const [img, setImg] = useState(0)
  const [tab, setTab] = useState<'details' | 'reviews'>('details')
  const edition = nft.editions.find((e) => e.id === editionId)!
  const max = Math.min(edition.available, nft.maxPerOrder)
  useEffect(() => { setQty((q) => Math.max(1, Math.min(q, max || 1))) }, [max])
  const unavailable = max === 0
  const item = { nftId: nft.id, editionId, quantity: qty }
  const share = async () => {
    try { await navigator.clipboard.writeText(location.href); toast('Link copiado.', 'success', 2500) } catch { toast('Não foi possível copiar o link.', 'error') }
  }

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[573px_1fr]">
        <div className="flex flex-col-reverse gap-4 sm:flex-row sm:gap-7">
          <ul className="flex gap-3 sm:flex-col sm:gap-4" aria-label="Galeria">
            {nft.gallery.map((src, i) => (
              <li key={src}>
                <button type="button" aria-label={`Ver imagem ${i + 1}`} aria-pressed={img === i} onClick={() => setImg(i)} className={cn('block h-[72px] w-[72px] cursor-pointer overflow-hidden rounded-lg border sm:h-[100px] sm:w-[100px]', img === i ? 'border-primary' : 'border-transparent')}>
                  <img src={src} alt="" width={100} height={100} loading="lazy" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
          <div className="relative h-fit w-full max-w-[444px] self-start rounded-md bg-surface p-4">
            <img src={nft.gallery[img]} alt={`${nft.title} — imagem ${img + 1} de ${nft.gallery.length}`} width={404} height={404} fetchPriority="high" className="aspect-square w-full rounded-3xl object-cover" />
            <FavoriteButton nftId={nft.id} title={nft.title} className="absolute right-6 top-6" />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <h1 className="text-[28px] font-bold leading-9 text-fg">{nft.title}</h1>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[22px] font-bold leading-5 text-primary-soft" data-testid="detail-price" aria-live="polite">{formatEth(nft.price)}</p>
              <p className="flex items-center gap-2 text-[15px] text-fg"><Stars value={nft.rating.average} /><span><span className="sr-only">Nota {nft.rating.average} de 5, </span>{nft.rating.count} avaliações de colecionadores</span></p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-[15px] font-bold text-fg">Sobre este NFT:</h2>
            <p className="text-sm leading-6 text-muted">{nft.description}</p>
            <p className="text-sm text-muted">Criado por <span className="text-fg">{nft.creator}</span> · <span data-testid="detail-available">{nft.available === 0 ? 'Esgotado' : `${nft.available} unidades disponíveis no total`}</span></p>
          </div>

          <fieldset>
            <legend className="mb-3 text-[15px] font-bold text-fg">Edição:</legend>
            <div className="flex flex-wrap gap-1.5">
              {nft.editions.map((e) => {
                const out = e.available === 0
                const on = editionId === e.id
                return (
                  <label key={e.id} title={out ? 'Edição esgotada' : `${e.available} de ${e.supply} disponíveis`} className={cn('flex cursor-pointer flex-col rounded-[10px] border px-3 py-1.5 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent', on ? 'border-primary-soft font-medium text-primary-soft' : 'border-transparent text-muted hover:text-fg', out && 'cursor-not-allowed line-through opacity-60')}>
                    <input type="radio" name="edition" value={e.id} className="sr-only" checked={on} disabled={out} onChange={() => setEditionId(e.id)} />
                    <span>{e.label} · 1/{e.supply}</span>
                    <span className="sr-only">{out ? 'Indisponível (esgotada)' : `${e.available} de ${e.supply} disponíveis`}</span>
                  </label>
                )
              })}
            </div>
            <p className={cn('mt-2 text-xs', edition.available === 0 ? 'text-danger' : 'text-muted')} aria-live="polite">{edition.available === 0 ? 'Indisponível (esgotada)' : `${edition.available} de ${edition.supply} disponíveis nesta edição`}</p>
          </fieldset>

          <div className="flex flex-wrap items-center gap-4">
            <QuantityStepper label="NFT" value={qty} max={max} disabled={unavailable} onChange={setQty} />
            <div className="flex flex-wrap gap-2">
              <Button className="w-[130px]" disabled={unavailable || add.isPending} onClick={() => add.mutate(item, { onSuccess: () => void navigate({ to: '/carrinho' }) })}>COMPRAR</Button>
              <Button variant="outline" className="w-[130px] gap-1 px-0" disabled={unavailable || add.isPending} onClick={() => add.mutate(item)} aria-label="Adicionar ao carrinho"><ShoppingCart aria-hidden="true" className="h-4 w-4" />{add.isPending ? 'Adicionando…' : 'Carrinho'}</Button>
            </div>
            <p className="w-full text-xs text-muted">{unavailable ? 'Edição indisponível.' : qty >= max ? `Limite de ${max} unidade(s) para esta edição.` : `Máximo ${max} por pedido.`}</p>
          </div>

          <dl className="flex flex-col gap-3 text-[15px] text-[#b39463]">
            <div className="flex gap-1"><dt>ID do token:</dt><dd>#{nft.tokenId}</dd></div>
            <div className="flex gap-1"><dt>Coleção:</dt><dd>{nft.collection}</dd></div>
            <div className="flex gap-1"><dt>Atributos:</dt><dd>{nft.attributes.join(', ')}</dd></div>
          </dl>
          <div className="flex items-center gap-3 text-[15px] font-bold text-fg">
            Compartilhar este NFT:
            <button type="button" onClick={() => void share()} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-primary-soft hover:bg-surface-2" aria-label="Copiar link do NFT"><Share2 aria-hidden="true" className="h-[18px] w-[18px]" /></button>
          </div>
        </div>
      </div>

      <section className="mt-24 border-t border-line pt-6" aria-label="Informações do NFT">
        <div role="tablist" aria-label="Seções" className="flex gap-8 text-[17px]">
          <button role="tab" id="tab-details" aria-selected={tab === 'details'} aria-controls="panel-details" onClick={() => setTab('details')} className={cn('cursor-pointer border-b-2 pb-1', tab === 'details' ? 'border-primary-soft font-bold text-primary-soft' : 'border-transparent text-fg')}>Detalhes do NFT</button>
          <button role="tab" id="tab-reviews" aria-selected={tab === 'reviews'} aria-controls="panel-reviews" onClick={() => setTab('reviews')} className={cn('cursor-pointer border-b-2 pb-1', tab === 'reviews' ? 'border-primary-soft font-bold text-primary-soft' : 'border-transparent text-fg')}>Avaliações de colecionadores ({nft.rating.count})</button>
        </div>
        {tab === 'details' ? (
          <div role="tabpanel" id="panel-details" aria-labelledby="tab-details" className="mt-5 flex flex-col gap-3 text-sm leading-6 text-muted">
            <p>{nft.title} é uma obra digital da coleção {nft.collection}, finalizada à mão por {nft.creator}. Cada atributo fica armazenado nos metadados do token e verificado na rede, com procedência registrada a cada transferência.</p>
            <p><strong className="text-fg">Rede:</strong> cunhado na {networkLabel[nft.network]} com procedência imutável e metadados armazenados no IPFS.</p>
            <p><strong className="text-fg">Contrato:</strong> {nft.contract} • Contrato inteligente ERC-721 verificado.</p>
            <p><strong className="text-fg">Direitos autorais:</strong> {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente ao criador.</p>
          </div>
        ) : (
          <ul role="tabpanel" id="panel-reviews" aria-labelledby="tab-reviews" className="mt-5 flex flex-col gap-4">
            {nft.reviews.map((r) => (
              <li key={r.id} className="rounded-md bg-surface p-4 text-sm">
                <p className="flex items-center gap-2 font-bold text-fg">{r.author}<Stars value={r.rating} /><span className="sr-only">Nota {r.rating} de 5</span></p>
                <p className="mt-1 text-muted">{r.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <MoreFromCollection nft={nft} />
    </>
  )
}

function MoreFromCollection({ nft }: { nft: NftDetail }) {
  const q = useNfts({ collection: nft.collection, sort: 'popular', page: 1, pageSize: 6 })
  const items = (q.data?.items ?? []).filter((n) => n.id !== nft.id).slice(0, 5)
  if (q.isSuccess && items.length === 0) return null
  return (
    <section aria-labelledby="mais" className="mt-16">
      <h2 id="mais" className="text-[17px] font-bold text-primary-soft">Mais desta coleção</h2>
      <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-7">
        {q.isLoading ? [0, 1, 2, 3, 4].map((i) => <li key={i}><NftCardSkeleton /></li>) : items.map((n) => <li key={n.id}><NftCard nft={n} /></li>)}
      </ul>
    </section>
  )
}

export default function NftDetailPage() {
  const { nftId } = useParams({ from: '/nft/$nftId' })
  const q = useNft(nftId)
  useDocumentTitle(q.data?.title ?? (q.error ? 'NFT não encontrado' : 'Carregando NFT'))
  const notFound = isApiError(q.error) && q.error.status === 404
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 xl:px-0">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', href: asset('#catalogo') }, ...(q.data ? [{ label: q.data.title }] : [])]} />
      {q.isLoading ? <DetailSkeleton /> : notFound ? (
        <EmptyState title="NFT não encontrado"><p>O NFT “{nftId}” não existe ou foi removido.</p><Button asChild className="mt-4"><Link to="/">Explorar catálogo</Link></Button></EmptyState>
      ) : q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.refetch()} title="Não foi possível carregar este NFT" /> : q.data ? <Detail nft={q.data} key={q.data.id} /> : null}
    </div>
  )
}
