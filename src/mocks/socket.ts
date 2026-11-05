import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import * as db from './db'

/**
 * Transporte Socket.IO simulado: o `socket.io-client` real conecta em `ws://<origem>/ws/socket.io/` (apenas transporte
 * WebSocket); a conexão é interceptada pelo MSW e traduzida por @mswjs/socket.io-binding.
 * Limitações: sem polling HTTP, sem rooms/namespaces/ack; o handshake usa sid fixo e a autenticação é feita por
 * um evento `subscribe` (o payload de `auth` do handshake não é exposto pelo binding).
 */
const sio = ws.link(/\/ws\/socket\.io\//)

interface Conn {
  io: ReturnType<typeof toSocketIo>
  raw: { close: (code?: number, reason?: string) => void }
  userId: string | null
}
const conns = new Set<Conn>()
let online = true

export const socketHandler = sio.addEventListener('connection', (connection) => {
  if (!online) { connection.client.close(1011, 'mock offline'); return }
  const io = toSocketIo(connection)
  const conn: Conn = { io, raw: connection.client, userId: null }
  conns.add(conn)

  // Heartbeat do engine.io: o servidor envia ping ("2") e o client responde pong ("3").
  const ping = setInterval(() => { try { connection.client.send('2') } catch { /* fechado */ } }, 20_000)

  io.client.on('subscribe', (_e, payload: { token?: string } | undefined) => {
    const s = db.resolveSession(payload?.token ?? null)
    conn.userId = s && s !== 'expired' ? s.user.id : null
    io.client.emit('subscribed', { userId: conn.userId })
  })
  io.client.on('unsubscribe', () => { conn.userId = null })

  connection.client.addEventListener('close', () => { clearInterval(ping); conns.delete(conn) })
})

// Mudanças no "servidor" → eventos Socket.IO (nft.updated é público; order.updated só para o dono).
db.onEvent((ev) => {
  for (const c of conns) {
    if (ev.type === 'order.updated' && c.userId !== ev.userId) continue
    c.io.client.emit(ev.type, ev)
  }
})

/** Emissão manual de eventos (controles de teste): sempre passa pelo socket.io-client. */
export function emitRaw(event: string, payload: unknown) { for (const c of conns) c.io.client.emit(event, payload) }
export function disconnectAll() { online = false; for (const c of [...conns]) c.raw.close(1006, 'mock disconnect') }
export function allowConnections() { online = true }
export const connectionCount = () => conns.size
export const isOnline = () => online
