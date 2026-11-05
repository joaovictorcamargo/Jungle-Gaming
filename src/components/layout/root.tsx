import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { House, LayoutGrid, LogIn, LogOut, Menu, Search, ShoppingCart, UserRound, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/toaster'
import { useCart } from '@/lib/hooks'
import { useSession } from '@/lib/session'
import { logout } from '@/lib/useAuthActions'
import { connectSocket, useSocketStatus } from '@/realtime/socket'

function Brand() {
  return <Link to="/" className="text-sm font-bold tracking-[0.1em] text-fg">KURIO</Link>
}

const MARKET = /^\/(nft|carrinho|checkout|pedido)/

function NavLinks({ onNavigate, vertical }: { onNavigate?: () => void; vertical?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const market = MARKET.test(path)
  const items: { label: string; href: string; active: boolean }[] = [
    { label: 'Início', href: '/', active: !market },
    { label: 'Mercado', href: '/#catalogo', active: market },
    { label: 'Criadores', href: '/#promocoes', active: false },
    { label: 'Aprenda', href: '/#blog', active: false },
  ]
  return (
    <>
      {items.map((i) => {
        const cls = cn('relative text-base transition-colors hover:text-primary-soft', vertical ? 'rounded-md px-3 py-2' : 'pb-2 pt-1', i.active ? 'font-bold text-primary-soft' : 'text-fg')
        const bar = i.active && !vertical && <span aria-hidden="true" className="absolute inset-x-0 -bottom-[13px] h-[3px] bg-primary-soft" />
        return i.href === '/'
          ? <Link key={i.label} to="/" className={cls} onClick={onNavigate} aria-current={i.active ? 'page' : undefined}>{i.label}{bar}</Link>
          : <a key={i.label} href={i.href} className={cls} onClick={onNavigate} aria-current={i.active ? 'page' : undefined}>{i.label}{bar}</a>
      })}
    </>
  )
}

function CartLink({ count, className }: { count: number; className?: string }) {
  return (
    <Link to="/carrinho" className={cn('relative grid h-10 w-10 place-items-center text-fg hover:text-primary-soft', className)} aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
      <ShoppingCart aria-hidden="true" className="h-6 w-6" strokeWidth={1.6} />
      {count > 0 && <span aria-hidden="true" className="absolute right-0.5 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-medium text-bg">{count}</span>}
    </Link>
  )
}

function Header() {
  const { status, user } = useSession()
  const { data: cart } = useCart()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const count = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0
  // Nas telas de conta o "Sair" fica no menu lateral "Meu perfil" (como no Figma).
  const accountPage = useRouterState({ select: (s) => /^\/(perfil|carteiras)/.test(s.location.pathname) })
  return (
    <header className="sticky top-0 z-40 bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 border-b border-line px-4 sm:px-6 xl:px-0">
        <div className="flex w-40 items-center gap-1">
          <Button variant="ghost" size="icon" className="-ml-2 md:hidden" aria-label="Abrir menu" onClick={() => setMenu(true)}><Menu aria-hidden="true" /></Button>
          <Brand />
        </div>
        <nav aria-label="Principal" className="hidden items-center gap-10 md:flex"><NavLinks /></nav>
        <div className="flex items-center gap-3 md:gap-5">
          <a href="/#busca" className="hidden h-10 w-10 place-items-center text-fg hover:text-primary-soft sm:grid" aria-label="Pesquisar no catálogo"><Search aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} /></a>
          <CartLink count={count} />
          {status === 'authenticated' ? (
            <>
              <Link to="/perfil" className="hidden h-9 w-9 place-items-center overflow-hidden rounded-full border border-line sm:grid" aria-label={`Perfil de ${user?.name ?? ''}`}>
                {user?.avatarUrl ? <img src={user.avatarUrl} alt="" width={36} height={36} className="h-full w-full object-cover" /> : <UserRound aria-hidden="true" className="h-5 w-5" />}
              </Link>
              <Button size="sm" className={cn('h-[35px] w-[100px] gap-1 px-0 text-base font-medium', accountPage && 'hidden')} onClick={async () => { await logout(); void navigate({ to: '/' }) }}><LogOut aria-hidden="true" className="h-[18px] w-[18px]" />Sair</Button>
            </>
          ) : status === 'loading' ? (
            <span aria-hidden="true" className="h-[35px] w-[100px] rounded-md bg-surface" />
          ) : (
            <Button asChild size="sm" className="h-[35px] w-[100px] gap-1 px-0 text-base font-medium"><Link to="/login"><LogIn aria-hidden="true" className="h-[18px] w-[18px]" />Entrar</Link></Button>
          )}
        </div>
      </div>
      <Sheet open={menu} onOpenChange={setMenu} title="Menu" side="left">
        <nav aria-label="Menu móvel" className="flex flex-col gap-1">
          <NavLinks vertical onNavigate={() => setMenu(false)} />
          {status === 'authenticated' ? (
            <>
              <Link to="/perfil" className="rounded-md px-3 py-2 text-base text-fg hover:text-primary-soft" onClick={() => setMenu(false)}>Meu perfil</Link>
              <Link to="/carteiras" className="rounded-md px-3 py-2 text-base text-fg hover:text-primary-soft" onClick={() => setMenu(false)}>Carteiras</Link>
            </>
          ) : <Link to="/cadastro" className="rounded-md px-3 py-2 text-base text-fg hover:text-primary-soft" onClick={() => setMenu(false)}>Criar conta</Link>}
        </nav>
      </Sheet>
    </header>
  )
}

/** Barra de navegação inferior do mobile (quadro "Mobile / Início"). */
function BottomNav() {
  const { data: cart } = useCart()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const count = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0
  const item = 'grid h-12 w-12 place-items-center rounded-full text-fg hover:text-primary-soft'
  return (
    <nav aria-label="Atalhos" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-6">
        <Link to="/" className={cn(item, path === '/' && 'text-primary-soft')} aria-label="Início"><House aria-hidden="true" className="h-5 w-5" /></Link>
        <a href="/#catalogo" className={item} aria-label="Mercado"><LayoutGrid aria-hidden="true" className="h-5 w-5" /></a>
        <CartLink count={count} className={cn('h-12 w-12', path === '/carrinho' && 'text-primary-soft')} />
        <Link to="/perfil" className={cn(item, path === '/perfil' && 'text-primary-soft')} aria-label="Meu perfil"><UserRound aria-hidden="true" className="h-5 w-5" /></Link>
      </div>
    </nav>
  )
}

function ConnectionBanner() {
  const s = useSocketStatus()
  if (s === 'connected' || s === 'connecting') return <p className="sr-only-live" role="status">{s === 'connected' ? 'Atualizações em tempo real ativas.' : ''}</p>
  return (
    <p role="status" className="flex items-center justify-center gap-2 bg-surface-2 px-4 py-2 text-center text-sm text-warning">
      <WifiOff aria-hidden="true" className="h-4 w-4" /> Reconectando às atualizações em tempo real… os dados serão sincronizados ao voltar.
      <Wifi aria-hidden="true" className="hidden" />
    </p>
  )
}

const features = [
  ['W', 'Segurança da carteira', 'Proteja sua carteira e colecione arte digital verificada com confiança.'],
  ['C', 'Criadores em destaque', 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.'],
  ['D', 'Alertas de lançamentos', 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.'],
] as const
const columns: [string, string[]][] = [
  ['Meu perfil', ['Meu perfil', 'Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse']],
  ['Central de ajuda', ['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item']],
  ['Coleções', ['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade']],
]

function SiteFooter() {
  const [sent, setSent] = useState(false)
  return (
    <footer className="mx-auto mt-24 w-full max-w-[1200px] bg-surface pb-16 text-fg [contain-intrinsic-size:auto_660px] [content-visibility:auto] md:pb-0">
      <div className="px-6 py-8 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.35fr] lg:gap-0 lg:divide-x lg:divide-primary">
          {features.map(([l, t, d]) => (
            <div key={t} className="flex flex-col gap-3 lg:px-4">
              <span aria-hidden="true" className="grid h-[74px] w-[74px] place-items-center rounded-full bg-primary text-2xl font-bold text-bg">{l}</span>
              <p className="text-[17px] font-bold">{t}</p>
              <p className="max-w-[16rem] text-sm leading-[22px] text-muted">{d}</p>
            </div>
          ))}
          <form className="flex flex-col gap-3 lg:px-4" onSubmit={(e) => { e.preventDefault(); setSent(true) }} aria-label="Newsletter">
            <p className="text-lg font-bold">Antecipe-se ao próximo lançamento</p>
            <div className="flex h-10 overflow-hidden rounded-md bg-surface-dark">
              <input type="email" required aria-label="Receber novidades da Kurio" placeholder="digite seu e-mail..." className="min-w-0 flex-1 bg-transparent px-3 text-sm text-fg placeholder:text-[#b39463]" />
              <button type="submit" className="cursor-pointer bg-primary px-4 text-lg font-bold text-bg">Enviar</button>
            </div>
            <p role="status" className="text-[13px] leading-[22px] text-muted">{sent ? 'Obrigado! Você receberá nossos lançamentos.' : 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.'}</p>
          </form>
        </div>
      </div>
      <div className="bg-surface-dark">
        <div className="grid items-center gap-4 px-6 py-6 text-sm sm:px-8 md:grid-cols-4">
          <p className="font-bold tracking-[0.1em]">KURIO</p>
          <p className="leading-[22px]">Feito para colecionadores,<br />criadores e cultura</p>
          <p>contato@email.com</p>
          <p>+55 11 4002 8922</p>
        </div>
      </div>
      <div className="grid gap-8 px-6 py-8 text-sm sm:px-8 md:grid-cols-2 lg:grid-cols-4">
        {columns.map(([h, items]) => (
          <div key={h}>
            <p className="mb-2 text-lg font-bold">{h}</p>
            <ul>{items.map((i) => <li key={i} className="leading-[30px]">{i}</li>)}</ul>
          </div>
        ))}
        <div className="flex flex-col gap-3">
          <p className="text-lg font-bold">Redes sociais</p>
          <ul className="flex gap-2.5" aria-label="Redes sociais (demonstração)">
            {[['f', 'Facebook'], ['ig', 'Instagram'], ['x', 'X'], ['in', 'LinkedIn'], ['yt', 'YouTube']].map(([n, full]) => <li key={n} className="grid h-[30px] w-[30px] place-items-center rounded-md border border-primary text-[11px] font-bold uppercase text-primary-soft"><span aria-hidden="true">{n}</span><span className="sr-only">{full}</span></li>)}
          </ul>
          <p className="mt-2 text-lg font-bold">Carteiras compatíveis</p>
          <p className="rounded-md border border-line-soft bg-surface-dark px-2 py-1.5 text-center text-[9px] font-bold tracking-[0.1px] text-primary-soft">METAMASK • WALLETCONNECT • COINBASE</p>
        </div>
      </div>
      <p className="bg-bg pb-2 pt-2 text-center text-sm leading-[30px]">© 2026 Kurio. Propriedade digital para todos. <span className="text-muted">· Demonstração com dados simulados.</span></p>
    </footer>
  )
}

export function Root() {
  const { status, user, token } = useSession()
  const loading = useRouterState({ select: (s) => s.isLoading })
  useEffect(() => { if (status !== 'loading') connectSocket(user?.id ?? null, token) }, [status, user?.id, token])
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-bg">Ir para o conteúdo</a>
      <Header />
      <ConnectionBanner />
      <main id="conteudo" className="min-h-[calc(100dvh-4rem)] flex-1 pb-4" aria-busy={loading}><Outlet /></main>
      <SiteFooter />
      <BottomNav />
      <Toaster />
    </div>
  )
}
