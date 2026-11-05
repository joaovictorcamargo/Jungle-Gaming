import { useDocumentTitle } from '@/lib/title'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { isApiError } from '@/api/client'
import { orderApi, walletApi } from '@/api/endpoints'
import type { NetworkId, Order, OrderInput, Quote } from '@/api/types'
import { Button } from '@/components/ui/button'
import { InputField, SelectField, TextareaField } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { EMAIL_RE, useFormErrors } from '@/features/forms'
import { attemptFor, hasAttempt, loadDraft, saveDraft } from '@/features/order-attempt'
import { Breadcrumb, EmptyState, ErrorState, SummaryRows, SummarySkeleton } from '@/features/shared'
import { formatEth } from '@/lib/eth'
import { networkLabel, shortAddress } from '@/lib/format'
import { useCart, useQuote } from '@/lib/hooks'
import { qk } from '@/lib/query'
import { useSession } from '@/lib/session'
import { useSocketStatus } from '@/realtime/socket'
import { cn } from '@/lib/utils'

type ConnState = { status: 'idle' | 'connecting' | 'connected'; walletId?: string; error?: string }

export default function CheckoutPage() {
  useDocumentTitle('Pagamento')
  const user = useSession().user!
  const uid = user.id
  const qc = useQueryClient()
  const navigate = useNavigate()
  const socket = useSocketStatus()
  const cart = useCart()
  const draft = useRef(loadDraft(uid)).current
  const f = useFormErrors()
  const [v, setV] = useState({ name: draft?.name ?? user.name, email: draft?.email ?? user.email, document: draft?.document ?? '' })
  const [walletId, setWalletId] = useState(draft?.walletId ?? '')
  const [network, setNetwork] = useState<NetworkId>((draft?.network as NetworkId) ?? 'ethereum')
  const [conn, setConn] = useState<ConnState>({ status: 'idle' })
  const [reviewed, setReviewed] = useState<Quote | null>(null) // cotação que o usuário revisou
  const [submitError, setSubmitError] = useState<{ message: string; recoverable: boolean } | null>(null)
  const inFlight = useRef(false)
  const [note, setNote] = useState('')

  const wallets = useQuery({ queryKey: qk.wallets(uid), queryFn: ({ signal }) => walletApi.list({ signal }) })
  const items = cart.data?.items ?? []
  const quote = useQuote(items, cart.data?.couponCode ?? null, network, !!cart.data)
  const pending = useQuery({ queryKey: qk.pendingOrder(uid), queryFn: ({ signal }) => orderApi.pending({ signal }), staleTime: 0 })

  useEffect(() => { saveDraft(uid, { ...v, walletId, network }) }, [uid, v, walletId, network])
  useEffect(() => { if (!walletId && wallets.data?.[0]) { setWalletId(wallets.data[0].id); setNetwork(wallets.data[0].network) } }, [wallets.data, walletId])
  // Pedido pendente (refresh/reconexão): recupera o estado sem criar outra compra.
  useEffect(() => { if (pending.data) void navigate({ to: '/pedido/$orderId', params: { orderId: pending.data.id }, replace: true }) }, [pending.data, navigate])

  const connect = useMutation({
    mutationFn: () => walletApi.connect(walletId, network),
    onMutate: () => setConn({ status: 'connecting', walletId }),
    onSuccess: () => setConn({ status: 'connected', walletId }),
    onError: (e) => setConn({ status: 'idle', error: isApiError(e) ? e.message : 'Falha ao conectar a carteira.' }),
  })
  const disconnect = useMutation({ mutationFn: () => walletApi.disconnect(walletId), onSuccess: () => setConn({ status: 'idle' }) })
  const connected = conn.status === 'connected' && conn.walletId === walletId

  const live = quote.data
  const changed = !!reviewed && !!live && live.quoteId !== reviewed.quoteId && !quote.isPlaceholderData

  const place = useMutation({
    mutationFn: (input: OrderInput) => orderApi.create(input, attemptFor(uid, input)),
    onSuccess: (order: Order) => {
      qc.setQueryData(qk.order(uid, order.id), order)
      void qc.invalidateQueries({ queryKey: qk.pendingOrder(uid) })
      // A chave de idempotência é mantida até o pedido ficar terminal (limpa na página do pedido); `inFlight` também
      // permanece travado após o sucesso para que nenhum clique durante a navegação crie outro pedido.
      void navigate({ to: '/pedido/$orderId', params: { orderId: order.id } })
    },
    onError: (e) => {
      inFlight.current = false
      if (isApiError(e) && (e.code === 'quote_changed' || e.code === 'availability_conflict') && e.quote) {
        // Cotação desatualizada: nova confirmação do usuário é obrigatória.
        qc.setQueryData(qk.quote(`${uid}`, items, cart.data?.couponCode ?? null, network), e.quote)
        void qc.invalidateQueries({ queryKey: ['quote'] }); void qc.invalidateQueries({ queryKey: ['cart'] })
        setSubmitError({ message: e.message, recoverable: false })
      } else if (isApiError(e) && (e.code === 'network_error' || e.code === 'timeout')) {
        setSubmitError({ message: 'Não recebemos resposta do servidor. Seu pedido pode ter sido criado — tentar novamente reaproveita a mesma tentativa e não duplica a compra.', recoverable: true })
      } else if (isApiError(e) && e.status >= 500) setSubmitError({ message: e.message, recoverable: true })
      else { f.fromApi(e); setSubmitError({ message: isApiError(e) ? e.message : 'Falha ao enviar o pedido.', recoverable: false }) }
    },
  })

  const review = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (v.name.trim().length < 2) errs.name = 'Informe o nome de exibição.'
    if (!EMAIL_RE.test(v.email)) errs.email = 'Informe um e-mail válido.'
    if (v.document.replace(/\D/g, '').length !== 11) errs.document = 'Informe um CPF com 11 dígitos.'
    if (!walletId) errs.walletId = 'Selecione uma carteira.'
    if (!f.setLocal(errs)) return
    if (!live?.valid) return
    setSubmitError(null); setReviewed(live)
  }

  const confirm = () => {
    if (inFlight.current || !reviewed || !connected) return // impede clique repetido
    inFlight.current = true
    place.mutate({ items, couponCode: cart.data?.couponCode ?? null, network, walletId, collector: { name: v.name.trim(), email: v.email, document: v.document }, quoteId: reviewed.quoteId, expectedTotal: reviewed.total })
  }

  if (cart.isLoading || pending.isLoading) return <div className="mx-auto max-w-5xl px-4 py-8" aria-busy="true"><Skeleton className="h-10 w-48" /><Skeleton className="mt-6 h-96 w-full" /></div>
  if (cart.error) return <div className="mx-auto max-w-5xl px-4 py-8"><ErrorState error={cart.error} onRetry={() => void cart.refetch()} /></div>
  if (!items.length) return <div className="mx-auto max-w-3xl px-4 py-8"><EmptyState title="Seu carrinho está vazio"><p>Adicione itens antes de pagar.</p><Button asChild className="mt-4"><Link to="/">Explorar NFTs</Link></Button></EmptyState></div>

  const noWallet = wallets.data && wallets.data.length === 0
  const wallet = wallets.data?.find((w) => w.id === walletId)
  const locked = !!reviewed

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 xl:px-0">
      <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', href: '/#catalogo' }, { label: 'Pagamento' }]} />
      <h1 className="sr-only">Pagamento</h1>
      {hasAttempt(uid) && !place.isPending && !submitError && <p role="status" className="mt-4 rounded-[3px] border border-warning/60 bg-surface px-4 py-3 text-sm">Encontramos uma tentativa de envio anterior sem resposta. Ao confirmar novamente com os mesmos dados, ela será recuperada sem duplicar a compra.</p>}
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,763px)_405px] lg:justify-between">
        <form id="checkout-form" noValidate onSubmit={review} className="flex flex-col gap-3" aria-labelledby="perfil-titulo">
          <h2 id="perfil-titulo" className="text-[17px] font-bold text-fg">Perfil do colecionador</h2>
          <fieldset disabled={locked} className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <legend className="sr-only">Dados do colecionador</legend>
            <InputField mark label="Nome de exibição" autoComplete="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={f.errors.name} />
            <InputField mark label="E-mail" type="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} error={f.errors.email} />
            <InputField mark label="CPF" inputMode="numeric" placeholder="000.000.000-00" value={v.document} onChange={(e) => setV({ ...v, document: e.target.value })} error={f.errors.document} />
            <SelectField mark label="Rede" value={network} onChange={(e) => { setNetwork(e.target.value as NetworkId); setConn({ status: 'idle' }) }}>
              {Object.entries(networkLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </SelectField>
            <InputField label="Endereço da carteira" readOnly value={wallet ? wallet.address : ''} placeholder="Endereço 0x da carteira" className="font-mono text-xs" hint="Preenchido pela carteira selecionada ao lado." />
            <InputField label="Tipo de carteira" readOnly value={wallet ? (wallet.kind === 'primary' ? 'Principal' : 'Secundária') : ''} placeholder="Selecione uma carteira" />
          </fieldset>
          <TextareaField label="Observação do colecionador (opcional)" wrapperClassName="mt-3 max-w-[350px]" value={note} disabled={locked} onChange={(e) => setNote(e.target.value)} maxLength={280} hint="Fica só neste dispositivo; não é enviada com o pedido." />
          {noWallet && <p className="mt-2 text-sm">Você ainda não tem carteiras. <Link to="/carteiras" className="font-semibold text-primary-soft underline">Cadastre uma carteira</Link> para continuar.</p>}
        </form>

        <aside className="flex h-fit flex-col gap-6 lg:sticky lg:top-24" aria-label="Revisão do pedido">
          <section aria-labelledby="seus-nfts" className="flex flex-col gap-3">
            <h2 id="seus-nfts" className="text-[17px] font-bold text-fg">{reviewed ? 'Revise e confirme' : 'Seus NFTs'}</h2>
            <div aria-hidden="true" className="flex justify-between text-base text-fg"><span className="font-bold">NFTs</span><span className="font-medium">Subtotal</span></div>
            <ul className="flex flex-col gap-3">
              {live?.lines.map((l) => (
                <li key={l.nftId + l.editionId} className="flex items-center gap-3 bg-surface pr-4 text-sm">
                  <img src={l.image} alt="" width={70} height={70} className="h-[70px] w-[70px] rounded-lg object-cover" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-base font-bold text-fg">{l.title}</span><span className="text-[#b39463]">Edição: {l.editionLabel}</span></span>
                  <span className="text-muted">(x {l.quantity})</span>
                  <span className="text-lg font-bold text-primary-soft">{formatEth(l.lineTotal)}</span>
                </li>
              )) ?? <SummarySkeleton />}
            </ul>
            <p className="text-center text-sm text-fg">Tem um código promocional? <Link to="/carrinho" className="text-primary-soft hover:underline">Aplique aqui</Link></p>
            <div className="min-h-32" aria-live="polite">{live ? <SummaryRows quote={live} /> : <SummarySkeleton />}</div>
          </section>

          <section aria-labelledby="carteira-titulo" className="flex flex-col gap-3">
            <h2 id="carteira-titulo" className="text-center text-base font-bold text-fg">Carteira e rede</h2>
            {wallets.isLoading ? <Skeleton className="h-[45px] w-full" /> : wallets.error ? <ErrorState error={wallets.error} onRetry={() => void wallets.refetch()} /> : (
              <fieldset disabled={locked} className="flex flex-col gap-3">
                <legend className="sr-only">Carteira</legend>
                {f.errors.walletId && <p role="alert" className="text-xs font-medium text-danger">⚠ {f.errors.walletId}</p>}
                {wallets.data?.map((w) => (
                  <label key={w.id} className={cn('flex min-h-[45px] cursor-pointer items-center gap-3 rounded-[3px] border px-3 py-2 text-[15px] text-fg has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent', walletId === w.id ? 'border-primary' : 'border-line')}>
                    <input type="radio" name="wallet" value={w.id} checked={walletId === w.id} onChange={() => { setWalletId(w.id); setConn({ status: 'idle' }); setNetwork(w.network) }} className="h-4 w-4 accent-primary" />
                    <span className="flex-1">{w.label}<span className="block text-xs text-muted">{shortAddress(w.address)} · {networkLabel[w.network]}</span></span>
                  </label>
                ))}
                <p className="rounded-md border border-line-soft bg-surface-dark px-2 py-1.5 text-center text-[9px] font-bold tracking-[0.1px] text-primary-soft">METAMASK • WALLETCONNECT • COINBASE</p>
              </fieldset>
            )}
            <p role="status" aria-live="polite" className={cn('text-sm', connected ? 'text-success' : 'text-muted')} data-testid="wallet-status">
              {connected ? `✓ Conectada: ${wallet?.label} na rede ${networkLabel[network]}.` : conn.status === 'connecting' ? 'Conectando…' : 'Carteira desconectada. Conecte para confirmar a compra.'}
            </p>
            {conn.error && <p role="alert" className="text-sm font-medium text-danger">⚠ {conn.error} Você pode tentar novamente ou escolher outra carteira.</p>}
            {connected ? <Button type="button" variant="outline" className="rounded-[3px]" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>Desconectar</Button> : <Button type="button" variant="outline" className="rounded-[3px]" disabled={!walletId || connect.isPending} onClick={() => connect.mutate()}>{connect.isPending ? 'Conectando…' : 'Conectar carteira'}</Button>}
          </section>

          {changed && (
            <div role="alert" className="rounded-[3px] border border-warning/70 bg-surface p-4 text-sm" data-testid="quote-changed">
              <p className="font-bold text-warning">⚠ Os valores mudaram desde a sua revisão.</p>
              <p className="mt-1 text-muted">Total revisado: {formatEth(reviewed!.total)} → novo total: {formatEth(live!.total)}. Confirme novamente para continuar.</p>
              <Button type="button" size="sm" className="mt-3" disabled={!live!.valid} onClick={() => { setReviewed(live!); setSubmitError(null) }}>Aceitar novos valores</Button>
            </div>
          )}
          {live && !live.valid && <p role="alert" className="text-sm font-medium text-danger">⚠ Há itens indisponíveis ou cupom inválido. <Link to="/carrinho" className="underline">Revise o carrinho</Link>.</p>}
          {submitError && <div role="alert" className="rounded-[3px] bg-danger-bg p-4 text-sm text-danger"><p className="font-medium">⚠ {submitError.message}</p>{submitError.recoverable && <Button type="button" size="sm" variant="outline" className="mt-3" onClick={confirm}>Tentar novamente (sem duplicar)</Button>}</div>}
          {socket !== 'connected' && <p role="status" className="text-xs text-warning">Atualizações em tempo real indisponíveis — os valores serão revalidados na confirmação.</p>}

          {!reviewed ? (
            <Button type="submit" form="checkout-form" size="lg" className="rounded-lg" disabled={!live?.valid || !!noWallet}>Revisar pedido</Button>
          ) : (
            <div className="flex flex-col gap-3">
              <Button type="button" size="lg" className="rounded-lg" disabled={!connected || changed || place.isPending || !live?.valid} onClick={confirm}>{place.isPending ? 'Enviando pedido…' : `Confirmar compra · ${formatEth(reviewed.total)}`}</Button>
              {!connected && <p className="text-xs text-muted">Conecte a carteira para confirmar.</p>}
              <Button type="button" variant="ghost" size="sm" disabled={place.isPending} onClick={() => { setReviewed(null); setSubmitError(null) }}>Editar dados</Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
