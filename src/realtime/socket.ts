import { backendReady } from '@/lib/backend-ready'
import type { Socket } from 'socket.io-client'
import { useSyncExternalStore } from 'react'
import type { NftDetail, NftListResponse, NftUpdatedEvent, Order, OrderUpdatedEvent, Quote } from '@/api/types'
import { queryClient } from '@/lib/query'
import { toast } from '@/components/ui/toaster'
import { formatEth } from '@/lib/eth'

/**
 * Cliente Socket.IO (real: `socket.io-client`). Regras:
 * - eventId deduplica; versão menor/igual à já conhecida é descartada (sem regredir nem reaplicar efeitos);
 * - order.updated só é aplicado se o userId do evento == usuário da sessão atual;
 * - ao (re)conectar: subscribe com o token + reconciliação REST dos recursos ativos;
 * - logout/troca de usuário: disconnect() e listeners liberados.
 */
export type SocketStatus = 'connecting' | 'connected' | 'disconnected'

let socket: Socket | null = null
let status: SocketStatus = 'disconnected'
let currentUserId: string | null = null
let currentToken: string | null = null
const seen = new Set<string>()
const orderVersions = new Map<string, number>()
const subs = new Set<() => void>()
const setStatus = (s: SocketStatus) => { status = s; subs.forEach((f) => f()) }
export const useSocketStatus = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => status, () => status)

function remember(id: string): boolean {
  if (seen.has(id)) return false
  seen.add(id)
  if (seen.size > 500) seen.delete(seen.values().next().value as string)
  return true
}

function announceCartChange(ev: NftUpdatedEvent) {
  const quotes = queryClient.getQueriesData<Quote>({ queryKey: ['quote'] })
  for (const [, q] of quotes) {
    const line = q?.lines.find((l) => l.nftId === ev.nftId)
    if (!line) continue
    const ed = ev.editions.find((e) => e.id === line.editionId)
    if (line.unitPrice !== ev.price) toast(`O preço de “${line.title}” mudou para ${formatEth(ev.price)}. O resumo foi atualizado.`, 'info')
    else if (ed && ed.available < line.quantity) toast(`A disponibilidade de “${line.title}” mudou: restam ${ed.available}. Ajuste a quantidade.`, 'info')
    return
  }
}

export function applyNftUpdated(ev: NftUpdatedEvent) {
  if (!remember(ev.eventId)) return
  let applied = false
  const detailKey = ['nfts', 'detail', ev.nftId]
  queryClient.setQueryData<NftDetail>(detailKey, (old) => {
    if (!old || old.version >= ev.version) return old
    applied = true
    return { ...old, version: ev.version, price: ev.price, available: ev.available, editions: old.editions.map((e) => ({ ...e, available: ev.editions.find((x) => x.id === e.id)?.available ?? e.available })) }
  })
  queryClient.setQueriesData<NftListResponse>({ queryKey: ['nfts', 'list'] }, (old) => {
    if (!old) return old
    return { ...old, items: old.items.map((i) => { if (i.id !== ev.nftId || i.version >= ev.version) return i; applied = true; return { ...i, version: ev.version, price: ev.price, available: ev.available } }) }
  })
  // O carrinho/cotação dependem de preço + disponibilidade: avisa e recalcula na API (fonte da verdade).
  const inCart = queryClient.getQueriesData<Quote>({ queryKey: ['quote'] }).some(([, q]) => q?.lines.some((l) => l.nftId === ev.nftId))
  if (inCart) { announceCartChange(ev); void queryClient.invalidateQueries({ queryKey: ['quote'] }); void queryClient.invalidateQueries({ queryKey: ['cart'] }) }
  else if (!applied) return
}

export function applyOrderUpdated(ev: OrderUpdatedEvent) {
  if (ev.userId !== currentUserId) return // isolamento entre sessões/usuários
  if (!remember(ev.eventId)) return
  if ((orderVersions.get(ev.orderId) ?? 0) >= ev.version) return
  orderVersions.set(ev.orderId, ev.version)
  const cached = queryClient.getQueryData<Order>(['u', ev.userId, 'order', ev.orderId])
  if (cached && cached.version >= ev.version) return
  void queryClient.invalidateQueries({ queryKey: ['u', ev.userId, 'order'] })
  if (ev.status === 'confirmed') {
    void queryClient.invalidateQueries({ queryKey: ['cart'] })
    void queryClient.invalidateQueries({ queryKey: ['nfts'] })
  }
  toast(ev.status === 'confirmed' ? 'Pedido confirmado!' : ev.status === 'declined' ? 'Pagamento recusado. Seus itens foram preservados.' : 'Pedido atualizado.', ev.status === 'declined' ? 'error' : 'success')
}

function reconcile() {
  // Eventos podem ter sido perdidos durante a desconexão: recarrega os recursos ativos via REST.
  void queryClient.invalidateQueries({ queryKey: ['nfts'] })
  void queryClient.invalidateQueries({ queryKey: ['cart'] })
  void queryClient.invalidateQueries({ queryKey: ['quote'] })
  if (currentUserId) void queryClient.invalidateQueries({ queryKey: ['u', currentUserId, 'order'] })
}

let generation = 0

/**
 * `socket.io-client` é carregado sob demanda (fora do caminho crítico de renderização). Isso também garante que ele só
 * é avaliado depois de o MSW (quando ativo) ter instalado o interceptor de WebSocket.
 */
export async function connectSocket(userId: string | null, token: string | null) {
  if (socket && currentUserId === userId && currentToken === token) return
  disconnectSocket()
  const mine = ++generation
  currentUserId = userId
  currentToken = token
  seen.clear(); orderVersions.clear()
  setStatus('connecting')
  await backendReady // o interceptor de WebSocket do MSW precisa estar ativo antes do socket.io-client
  const { io } = await import('socket.io-client')
  if (mine !== generation) return // sessão mudou enquanto o módulo carregava
  const s = io(window.location.origin, { path: '/ws/socket.io/', transports: ['websocket'], reconnectionDelay: 500, reconnectionDelayMax: 2000, timeout: 4000 })
  socket = s
  s.on('connect', () => {
    setStatus('connected')
    s.emit('subscribe', { token })
    reconcile()
  })
  s.on('disconnect', () => setStatus('disconnected'))
  s.on('connect_error', () => setStatus('disconnected'))
  s.on('nft.updated', applyNftUpdated)
  s.on('order.updated', applyOrderUpdated)
}

export function disconnectSocket() {
  generation++
  if (!socket) return
  socket.emit('unsubscribe')
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
  currentUserId = null; currentToken = null
  setStatus('disconnected')
}
