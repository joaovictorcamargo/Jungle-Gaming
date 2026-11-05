import { useDocumentTitle } from '@/lib/title'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Category, NetworkId, NftListQuery, NftListResponse, NftSort, NftSummary } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { EmptyState, ErrorState, NftCard, NftCardSkeleton } from '@/features/shared'
import { formatEth, isEth } from '@/lib/eth'
import { FEATURED_QUERY, useNfts } from '@/lib/hooks'
import { categoryLabel, networkLabel, sortLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { HomeSearch } from '@/router'
import { asset } from '@/lib/base'

const route = getRouteApi('/')
const PAGE_SIZE = 9
const CATEGORIES: Category[] = ['arte', 'fotografia', 'musica', 'games']
const NETWORKS: NetworkId[] = ['ethereum', 'polygon', 'base']

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

/** Lista de opções com contagem, como "Coleções" e "Rede" no Figma. Cada item é um botão alternável. */
function FacetList({ title, options, active, counts, labels, onToggle }: { title: string; options: string[]; active?: string; counts?: Record<string, number>; labels: Record<string, string>; onToggle: (v: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-lg font-bold leading-4 text-fg">{title}</legend>
      <ul className="flex flex-col px-3">
        {options.map((o) => {
          const on = active === o
          return (
            <li key={o}>
              <button type="button" aria-pressed={on} onClick={() => onToggle(o)} className={cn('flex w-full cursor-pointer items-center justify-between text-left text-[15px] leading-10 hover:text-primary-soft', on ? 'text-primary-soft' : 'text-muted')}>
                {labels[o]}
                <span aria-hidden="true" className="font-bold">({counts?.[o] ?? 0})</span>
              </button>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

function Filters({ search, facets, onChange }: { search: HomeSearch; facets?: NftListResponse['facets']; onChange: (patch: Partial<HomeSearch>) => void }) {
  const [min, setMin] = useState(search.minPrice ?? '')
  const [max, setMax] = useState(search.maxPrice ?? '')
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { setMin(search.minPrice ?? ''); setMax(search.maxPrice ?? ''); setErr(null) }, [search.minPrice, search.maxPrice])
  const apply = () => {
    if ((min && !isEth(min)) || (max && !isEth(max))) { setErr('Use valores em ETH, ex.: 0.5'); return }
    setErr(null); onChange({ minPrice: min || undefined, maxPrice: max || undefined })
  }
  const range = facets?.priceRange
  const priceText = `Preço: ${search.minPrice ?? (range ? formatEth(range.min).replace(' ETH', '') : '—')} - ${search.maxPrice ?? (range ? formatEth(range.max) : '—')}`
  const hasAny = !!(search.category || search.network || search.minPrice || search.maxPrice || search.inStock || search.collection)
  return (
    <form className="flex flex-col gap-10" onSubmit={(e) => { e.preventDefault(); apply() }} aria-label="Filtros">
      <FacetList title="Coleções" options={CATEGORIES} active={search.category} counts={facets?.categoryCounts} labels={categoryLabel} onToggle={(c) => onChange({ category: search.category === c ? undefined : (c as Category) })} />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-bold leading-4 text-fg">Faixa de preço</legend>
        <div className="flex flex-col gap-3 pl-3">
          <div aria-hidden="true" className="relative flex h-4 items-center">
            <span className="absolute inset-x-0 h-0.5 bg-line" />
            <span className="absolute left-0 right-[25%] h-[3px] bg-primary" />
            <span className="absolute left-0 h-[15px] w-[15px] rounded-full bg-primary" />
            <span className="absolute right-[25%] h-[15px] w-[15px] rounded-full bg-primary" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">Preço mín. (ETH)<input inputMode="decimal" placeholder="0.02" value={min} onChange={(e) => setMin(e.target.value)} className="h-9 rounded-[3px] border border-line bg-transparent px-2 text-sm text-fg placeholder:text-[#b39463]" /></label>
            <label className="flex flex-col gap-1 text-xs text-muted">Preço máx. (ETH)<input inputMode="decimal" placeholder="3.2" value={max} onChange={(e) => setMax(e.target.value)} className="h-9 rounded-[3px] border border-line bg-transparent px-2 text-sm text-fg placeholder:text-[#b39463]" /></label>
          </div>
          <p className="text-[15px] text-fg">{priceText}</p>
          {err && <p role="alert" className="text-xs text-danger">⚠ {err}</p>}
          <Button type="submit" size="sm" className="h-9 w-fit rounded-md px-3 text-base">Aplicar</Button>
        </div>
      </fieldset>
      <FacetList title="Rede" options={NETWORKS} active={search.network} counts={facets?.networkCounts} labels={networkLabel} onToggle={(n) => onChange({ network: search.network === n ? undefined : (n as NetworkId) })} />
      <div className="flex flex-col gap-3 px-3">
        <label className="flex cursor-pointer items-center gap-3 text-[15px] text-muted">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={!!search.inStock} onChange={(e) => onChange({ inStock: e.target.checked || undefined })} />
          Apenas disponíveis
        </label>
        {hasAny && <Button type="button" variant="link" className="w-fit" onClick={() => onChange({ category: undefined, collection: undefined, network: undefined, minPrice: undefined, maxPrice: undefined, inStock: undefined })}>Limpar filtros</Button>}
      </div>
    </form>
  )
}

function FeaturedBanner({ nft }: { nft?: NftSummary }) {
  return (
    <section aria-labelledby="destaque-titulo" className="relative overflow-hidden bg-gradient-to-b from-primary/10 to-primary/[0.03] pt-6">
      <h2 id="destaque-titulo" className="px-5 text-2xl font-bold leading-8 text-primary-soft">NFT EM DESTAQUE</h2>
      <p className="mt-4 px-5 text-center text-[22px] font-bold leading-4 text-fg">OFERTA LIMITADA</p>
      {nft ? (
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="mt-4 block" aria-label={`Ver ${nft.title}, ${formatEth(nft.price)}`}>
          <img src={nft.image} alt="" width={310} height={368} loading="lazy" className="h-[368px] w-full rounded-[22px] object-cover" />
        </Link>
      ) : <div className="mt-4 h-[368px] rounded-[22px] bg-surface-2" />}
    </section>
  )
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const sq = 'grid h-[35px] min-w-[35px] cursor-pointer place-items-center rounded border border-line px-2 text-lg text-fg hover:border-primary-soft disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <nav aria-label="Paginação" className="mt-16 flex flex-wrap items-center justify-end gap-2">
      <button type="button" className={sq} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior"><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
      {pages.map((p) => (
        <button key={p} type="button" className={cn(sq, p === page && 'border-primary bg-primary font-bold text-bg hover:border-primary')} aria-current={p === page ? 'page' : undefined} aria-label={`Página ${p}`} onClick={() => onPage(p)}>{p}</button>
      ))}
      <button type="button" className={sq} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Próxima página"><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
    </nav>
  )
}

const posts = [
  ['12 de setembro', '6 min', 'Como funciona a propriedade de NFTs', 'Aprenda a colecionar, negociar e verificar ativos digitais.'],
  ['13 de setembro', '2 min', '10 artistas digitais para acompanhar', 'Conheça criadores que moldam a cultura digital.'],
  ['15 de setembro', '3 min', 'Raridade, atributos e procedência', 'Entenda raridade, procedência, direitos autorais e utilidade.'],
  ['15 de setembro', '2 min', 'Como proteger sua carteira', 'Proteja sua carteira, seus ativos e sua identidade.'],
] as const

const BLOG_IMAGES = [3, 1, 2, 4].map((n) => asset(`nfts/ape-${n}.webp`))

function Promos() {
  const items = [
    ['Lançamentos gênesis de edição limitada', 'Colecione edições escassas diretamente dos criadores antes da revelação pública.', asset('nfts/ape-1.webp')],
    ['Arte digital selecionada e muito mais', 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.', asset('nfts/ape-3.webp')],
  ]
  return (
    <section id="promocoes" aria-label="Promoções" className="mt-24 grid scroll-mt-24 gap-6 [contain-intrinsic-size:auto_520px] [content-visibility:auto] lg:grid-cols-2 lg:[contain-intrinsic-size:auto_250px]">
      {items.map(([t, d, img]) => (
        <article key={t} className="flex min-h-[250px] items-stretch overflow-hidden rounded-lg bg-surface">
          <img src={img} alt="" width={290} height={250} loading="lazy" className="hidden w-[290px] shrink-0 rounded-[18px] object-cover sm:block" />
          <div className="flex flex-1 flex-col items-end gap-3 p-6 text-right sm:pr-7 sm:pt-9">
            <h2 className="text-lg font-bold leading-6">{t}</h2>
            <p className="max-w-[16rem] text-sm leading-6 text-muted">{d}</p>
            <Button asChild className="mt-auto w-[140px] gap-1 font-medium"><a href="#catalogo">Explorar <ChevronRight aria-hidden="true" className="h-4 w-4" /></a></Button>
          </div>
        </article>
      ))}
    </section>
  )
}

function Blog() {
  return (
    <section id="blog" aria-labelledby="blog-titulo" className="mt-24 scroll-mt-24 text-center [contain-intrinsic-size:auto_1400px] [content-visibility:auto] lg:[contain-intrinsic-size:auto_480px]">
      <h2 id="blog-titulo" className="text-[28px] font-bold">Diário da Cunhagem</h2>
      <p className="mt-3 text-sm text-muted">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <div className="mt-10 grid gap-6 text-left sm:grid-cols-2 lg:grid-cols-4">
        {posts.map(([date, read, title, desc], i) => (
          <article key={title} className="flex flex-col overflow-hidden rounded-lg bg-surface">
            <img src={BLOG_IMAGES[i]} alt="" width={268} height={195} loading="lazy" className="h-[195px] w-full object-cover" />
            <div className="flex flex-col gap-2 px-4 pb-4 pt-3">
              <p className="text-xs font-medium text-muted">{date} &nbsp;|&nbsp; Leitura de {read}</p>
              <h3 className="text-base font-bold text-fg">{title}</h3>
              <p className="text-xs font-medium text-muted">{desc}</p>
              <p className="text-xs font-bold text-primary-soft">Ler mais <span aria-hidden="true">→</span></p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

type Tab = 'all' | 'new' | 'hot'
const TABS: [Tab, string][] = [['all', 'Todos os NFTs'], ['new', 'Novos lançamentos'], ['hot', 'Em alta']]

export default function HomePage() {
  useDocumentTitle('Explorar NFTs')
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [drawer, setDrawer] = useState(false)
  const [text, setText] = useState(search.q ?? '')
  const debounced = useDebounced(text, 300)

  // URL é a fonte da verdade: busca, filtros, ordenação e página.
  useEffect(() => { setText(search.q ?? '') }, [search.q])
  useEffect(() => { if ((debounced || undefined) !== search.q) void navigate({ search: (p) => ({ ...p, q: debounced || undefined, page: undefined }), replace: true }) }, [debounced])

  const change = (patch: Partial<HomeSearch>) => void navigate({ search: (p) => ({ ...p, ...patch, page: undefined }) })
  const query: NftListQuery = { q: search.q, category: search.category, collection: search.collection, network: search.network, minPrice: search.minPrice, maxPrice: search.maxPrice, inStock: search.inStock, sort: search.sort ?? 'newest', page: search.page ?? 1, pageSize: PAGE_SIZE }
  const list = useNfts(query)
  const featured = useNfts(FEATURED_QUERY)
  const facets = list.data?.facets ?? featured.data?.facets
  const hasFilters = !!(search.q || search.category || search.collection || search.network || search.minPrice || search.maxPrice || search.inStock)
  const tab: Tab = search.sort === 'popular' ? 'hot' : search.sort === 'newest' ? 'new' : 'all'
  const selectTab = (t: Tab) => change(t === 'hot' ? { sort: 'popular' } : t === 'new' ? { sort: 'newest' } : { sort: undefined, category: undefined, network: undefined, minPrice: undefined, maxPrice: undefined, inStock: undefined, q: undefined })

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-8 pt-8 sm:px-6 xl:px-0">
      <section aria-labelledby="hero" className="relative flex items-center justify-between gap-3 overflow-hidden rounded-xl bg-gradient-to-br from-surface-dark/70 via-surface to-bg p-3 sm:gap-8 sm:px-10 md:min-h-[450px] md:py-0 md:pr-0">
        <div className="flex min-w-0 max-w-[600px] flex-1 flex-col gap-3 md:gap-8">
          <div className="flex flex-col gap-1.5 md:gap-2">
            <p className="text-xs font-medium tracking-[0.1em] text-fg md:text-sm">Bem-vindo à Kurio</p>
            <h1 id="hero" className="text-lg font-bold leading-snug text-fg sm:text-3xl md:text-[43px] md:leading-[70px]">SEJA DONO DO FUTURO<br className="hidden md:block" /> DA ARTE DIGITAL</h1>
            <p className="text-xs leading-5 text-muted md:hidden">Descubra NFTs selecionados de criadores do mundo todo.</p>
            <p className="hidden text-sm leading-6 text-muted md:block">Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.</p>
          </div>
          <a href="#catalogo" className="flex w-fit items-center gap-1 text-xs font-bold text-primary-soft md:hidden">EXPLORAR <ChevronRight aria-hidden="true" className="h-4 w-4" /></a>
          <Button asChild className="hidden w-[140px] text-base md:inline-flex"><a href="#catalogo">EXPLORAR</a></Button>
          <span aria-hidden="true" className="hidden gap-2 md:flex md:self-end"><i className="h-2 w-2 rounded-full bg-primary" /><i className="h-2 w-2 rounded-full bg-primary/60" /><i className="h-2 w-2 rounded-full bg-primary/30" /></span>
        </div>
        <img src={asset('nfts/ape-1.webp')} alt="" width={450} height={450} fetchPriority="high" className="aspect-square w-1/2 max-w-[188px] shrink-0 rounded-2xl object-cover sm:w-[220px] sm:max-w-none md:w-[450px] md:rounded-3xl" />
      </section>

      <section id="catalogo" aria-labelledby="catalogo-titulo" className="mt-8 scroll-mt-24 md:mt-24">
        <h2 id="catalogo-titulo" className="sr-only">Catálogo de NFTs</h2>
        <div className="grid gap-12 lg:grid-cols-[310px_1fr]">
          <aside className="hidden flex-col gap-6 lg:flex" aria-label="Filtros do catálogo">
            <div className="bg-surface p-5"><Filters search={search} facets={facets} onChange={change} /></div>
            <FeaturedBanner nft={featured.data?.items[1]} />
          </aside>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-4">
              <div className="order-1 flex w-full gap-2 lg:order-2 lg:w-auto">
                <label className="relative flex-1">
                  <span className="sr-only">Buscar</span>
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b39463]" />
                  <input id="busca" type="search" placeholder="Explorar coleções" value={text} onChange={(e) => setText(e.target.value)} className="h-[45px] w-full rounded-[10px] bg-surface pl-9 pr-3 text-sm font-bold text-fg placeholder:text-[#b39463] lg:h-9 lg:w-[120px] lg:rounded-[3px] lg:border lg:border-line lg:bg-transparent lg:font-normal" />
                </label>
                <button type="button" onClick={() => setDrawer(true)} aria-label={`Filtros${hasFilters ? ' (ativos)' : ''}`} className="grid h-[45px] w-[45px] shrink-0 cursor-pointer place-items-center rounded-[14px] bg-primary text-bg lg:hidden"><SlidersHorizontal aria-hidden="true" className="h-5 w-5" /></button>
              </div>
              <div role="group" aria-label="Visualização" className="order-2 flex gap-5 overflow-x-auto text-[15px] font-medium leading-4 lg:order-1 lg:gap-4">
                {TABS.map(([t, l]) => <button key={t} type="button" aria-pressed={tab === t} onClick={() => selectTab(t)} className={cn('cursor-pointer whitespace-nowrap border-b-2 pb-1.5', tab === t ? 'border-primary-soft text-primary-soft' : 'border-transparent text-fg hover:text-primary-soft')}>{l}</button>)}
              </div>
              <label className="order-3 flex items-center gap-2 text-[15px] text-fg">
                Ordenar por
                <select value={search.sort ?? 'newest'} onChange={(e) => change({ sort: e.target.value as NftSort })} className="cursor-pointer bg-bg text-[15px] text-fg">
                  {Object.entries(sortLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>

            <p role="status" aria-live="polite" className="mb-6 mt-4 flex min-h-5 items-center gap-3 text-sm text-muted">
              {list.data && <span data-testid="result-count">{list.data.total} {list.data.total === 1 ? 'resultado' : 'resultados'}</span>}
              {list.isFetching && !list.isLoading && <span>Atualizando…</span>}
            </p>
            {list.isLoading ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-[30px] xl:grid-cols-3" data-testid="catalog-skeleton" aria-busy="true"><span className="sr-only-live" role="status">Carregando catálogo…</span>{Array.from({ length: PAGE_SIZE }, (_, i) => <NftCardSkeleton key={i} />)}</div>
            ) : list.error && !list.data ? (
              <ErrorState error={list.error} onRetry={() => void list.refetch()} title="Não foi possível carregar o catálogo" />
            ) : list.data && list.data.items.length === 0 ? (
              <EmptyState title="Nenhum NFT encontrado">
                <p>Não encontramos resultados para a sua busca.</p>
                {hasFilters && <Button className="mt-4" variant="outline" onClick={() => void navigate({ search: {} })}>Limpar busca e filtros</Button>}
              </EmptyState>
            ) : (
              <>
                {list.error && <div className="mb-4"><ErrorState error={list.error} onRetry={() => void list.refetch()} title="Falha ao atualizar" /></div>}
                <ul className={cn('grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-[30px] xl:grid-cols-3', list.isPlaceholderData && 'opacity-60')} data-testid="catalog-grid">
                  {list.data?.items.map((n, i) => <li key={n.id}><NftCard nft={n} priority={i < 2} /></li>)}
                </ul>
                {list.data && <Pagination page={list.data.page} totalPages={list.data.totalPages} onPage={(p) => void navigate({ search: (s) => ({ ...s, page: p > 1 ? p : undefined }) })} />}
              </>
            )}
          </div>
        </div>
      </section>

      <Promos />
      <Blog />

      <Sheet open={drawer} onOpenChange={setDrawer} title="Filtros" description="Refine o catálogo.">
        <div className="overflow-y-auto"><Filters search={search} facets={facets} onChange={change} /></div>
        <Button onClick={() => setDrawer(false)}>Ver {list.data?.total ?? ''} resultados</Button>
      </Sheet>
    </div>
  )
}
