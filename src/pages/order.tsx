import { useDocumentTitle } from '@/lib/title'
import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { clearAttempt } from '@/features/order-attempt'
import { CircleX, Loader, WalletCards } from 'lucide-react'
import { isApiError } from '@/api/client'
import { orderApi } from '@/api/endpoints'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/features/shared'
import { formatEth } from '@/lib/eth'
import { networkLabel } from '@/lib/format'
import { qk } from '@/lib/query'
import { useSession } from '@/lib/session'
import { useSocketStatus } from '@/realtime/socket'

export default function OrderPage() {
  useDocumentTitle('Pedido')
  const { orderId } = useParams({ from: '/pedido/$orderId' })
  const uid = useSession().user!.id
  const socket = useSocketStatus()
  // Pedido pendente: polling de segurança (REST) além do evento order.updated; confirmado/recusado são terminais.
  const q = useQuery({
    queryKey: qk.order(uid, orderId), queryFn: ({ signal }) => orderApi.get(orderId, { signal }),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false),
    retry: (n, e) => !(isApiError(e) && (e.status === 403 || e.status === 404)) && n < 2 && isApiError(e) && e.transient,
  })
  const o = q.data
  // Pedido terminal (confirmado/recusado): a tentativa de envio chegou ao fim e a chave de idempotência pode ser descartada.
  useEffect(() => { if (o && o.status !== 'pending') clearAttempt(uid) }, [o, uid])

  if (q.isLoading) return <div className="mx-auto max-w-3xl px-4 py-8" aria-busy="true"><Skeleton className="h-10 w-64" /><Skeleton className="mt-6 h-72 w-full" /></div>
  if (isApiError(q.error) && (q.error.status === 404 || q.error.status === 403)) return <div className="mx-auto max-w-3xl px-4 py-8"><EmptyState title={q.error.status === 403 ? 'Sem permissão' : 'Pedido não encontrado'}><p>{q.error.message}</p><Button asChild className="mt-4"><Link to="/">Voltar ao início</Link></Button></EmptyState></div>
  if (!o) return <div className="mx-auto max-w-3xl px-4 py-8"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div>

  const head = 'flex flex-col items-center gap-4 px-6 pb-6 pt-8 text-center'
  return (
    <div className="px-4 py-10 sm:px-6">
      <div className="relative mx-auto w-full max-w-[578px] overflow-hidden bg-surface shadow-[0_0_40px_rgba(10,6,4,0.6)]">
        {o.status === 'pending' && (
          <section role="status" aria-live="polite" className={head} data-testid="order-pending">
            <Loader aria-hidden="true" className="h-14 w-14 animate-spin text-primary-soft motion-reduce:animate-none" />
            <h1 className="text-base font-bold text-muted">Aguardando confirmação da rede</h1>
            <p className="text-sm text-muted">Pedido {o.id} enviado. Você pode recarregar a página: seu pedido será recuperado.</p>
            {socket !== 'connected' && <p className="text-sm text-warning">Conexão em tempo real interrompida — acompanhando por consulta periódica.</p>}
          </section>
        )}
        {o.status === 'declined' && (
          <section role="alert" className={head} data-testid="order-declined">
            <CircleX aria-hidden="true" className="h-14 w-14 text-danger" />
            <h1 className="text-base font-bold text-fg">Pagamento recusado</h1>
            <p className="text-sm text-muted">{o.declineReason} Seus itens continuam no carrinho.</p>
            <Button asChild><Link to="/carrinho">Voltar ao carrinho</Link></Button>
          </section>
        )}
        {o.status === 'confirmed' && (
          <section aria-labelledby="ok" className={head} data-testid="order-confirmed">
            <WalletCards aria-hidden="true" className="h-16 w-16 text-primary-soft" strokeWidth={1.3} />
            <h1 id="ok" className="text-base font-bold text-muted">Seus NFTs agora estão na sua carteira</h1>
          </section>
        )}

        <div className="h-px bg-primary" />
        <dl className="grid grid-cols-2 gap-3 px-6 py-3 text-muted sm:grid-cols-4 sm:divide-x sm:divide-line-soft sm:px-9">
          <div className="sm:pr-3"><dt className="text-sm font-bold">ID da transação</dt><dd className="truncate text-[15px]" data-testid="tx-hash" title={o.txHash ?? undefined}>{o.txHash ? `${o.txHash.slice(0, 6)}…${o.txHash.slice(-4)}` : 'Aguardando'}</dd></div>
          <div className="sm:px-3"><dt className="text-sm">Data</dt><dd className="text-[15px]">{new Date(o.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(' de ', ' ').replace('. de ', ', ')}</dd></div>
          <div className="sm:px-3"><dt className="text-sm">Total</dt><dd className="text-[15px]">{formatEth(o.total)}</dd></div>
          <div className="sm:pl-3"><dt className="text-sm">Rede</dt><dd className="text-[15px]">{networkLabel[o.network]}</dd></div>
        </dl>
        <div className="h-px bg-primary" />

        <section aria-labelledby="recibo" className="px-6 pb-12 pt-5 sm:px-11">
          <h2 id="recibo" className="text-[15px] font-bold text-fg">Detalhes da transação</h2>
          <div aria-hidden="true" className="mt-3 flex justify-between text-base font-bold text-fg"><span>NFTs</span><span className="flex gap-12"><span>Edições</span><span className="font-medium">Subtotal</span></span></div>
          <ul className="mt-3 flex flex-col gap-3">
            {o.lines.map((l) => (
              <li key={l.nftId + l.editionId} className="flex items-center gap-3 bg-surface-2/40 pr-1 text-sm">
                <img src={l.image} alt={`Arte “${l.title}”`} width={70} height={70} className="h-[70px] w-[70px] rounded-lg object-cover" />
                <span className="min-w-0 flex-1"><span className="block truncate text-base font-bold text-fg">{l.title}</span><span className="text-[#b39463]">Edição: {l.editionLabel}<span className="hidden sm:inline"> · {formatEth(l.unitPrice)}</span></span></span>
                <span className="text-muted">(x {l.quantity})</span>
                <span className="whitespace-nowrap text-right text-base font-bold text-primary-soft sm:w-28 sm:text-lg">{formatEth(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="ml-auto mt-4 flex max-w-[321px] flex-col gap-3 text-[15px] text-fg">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="text-lg">{formatEth(o.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Desconto{o.couponCode ? ` (${o.couponCode})` : ''}</dt><dd>{o.discount === '0' ? '(-) 0.00' : `(-) ${formatEth(o.discount)}`}</dd></div>
            <div className="flex justify-between"><dt>Taxa de rede</dt><dd className="text-lg">{formatEth(o.networkFee)}</dd></div>
            <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd className="text-lg text-primary-soft" data-testid="receipt-total">{formatEth(o.total)}</dd></div>
          </dl>
          {o.status === 'confirmed' && (
            <>
              <p className="mt-6 text-center text-xs leading-5 text-muted">Transação confirmada na {networkLabel[o.network]}. A propriedade foi transferida para sua carteira conectada e registrada na rede. Colecionador: {o.collector.name}.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {o.explorerUrl && <Button asChild><a href={o.explorerUrl} target="_blank" rel="noopener noreferrer">Ver no Etherscan<span className="sr-only"> (simulado, abre em nova aba)</span></a></Button>}
                <Button asChild variant="outline"><Link to="/">Continuar explorando</Link></Button>
              </div>
            </>
          )}
        </section>
        <div aria-hidden="true" className="h-2.5 bg-primary" />
      </div>
    </div>
  )
}
