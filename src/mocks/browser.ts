import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { socketHandler } from './socket'
import * as db from './db'
import * as sock from './socket'
import { DEMO_CREDENTIALS } from './data/fixtures'
import { SCENARIO_PRESETS, type Scenario } from './scenarios'
import { asset } from '@/lib/base'

/** Controles expostos em `window.__mocks` para demonstração e testes (cenários, reset, disparo de eventos). */
const controls = {
  scenarios: Object.keys(SCENARIO_PRESETS),
  credentials: DEMO_CREDENTIALS,
  getScenario: () => db.getScenarioNames(),
  setScenario: (names: string[], overrides?: Partial<Scenario>) => db.applyScenario(names, overrides),
  reset: async (names: string[] = ['default']) => { await db.resetDb(names) },
  expireSessions: () => db.expireAllSessions(),
  updateNft: (id: string, patch: Parameters<typeof db.updateNft>[1]) => db.updateNft(id, patch),
  /** Reenvia o último evento do NFT (duplicata). */
  duplicateNftEvent: (id: string) => { const e = db.currentNftEvent(id); if (e) sock.emitRaw('nft.updated', e) },
  /** Envia um evento antigo (versão anterior, preço antigo) que não deve regredir o estado. */
  staleNftEvent: (id: string, price = '9.99') => { const e = db.currentNftEvent(id); if (e) sock.emitRaw('nft.updated', { ...e, eventId: `evt_${id}_v${e.version - 1}`, version: e.version - 1, price }) },
  emitRaw: sock.emitRaw,
  disconnectSocket: sock.disconnectAll,
  reconnectSocket: sock.allowConnections,
  socketConnections: sock.connectionCount,
  settleOrders: () => db.settleDueOrders(Number.MAX_SAFE_INTEGER),
}
export type MockControls = typeof controls

declare global { interface Window { __mocks?: MockControls } }

export async function startMocks() {
  const worker = setupWorker(...handlers, socketHandler)
  // Banco simulado e service worker sobem em paralelo; as requisições só saem depois dos dois (backendReady).
  await Promise.all([db.initDb(), worker.start({ onUnhandledRequest: 'bypass', quiet: true, serviceWorker: { url: asset('mockServiceWorker.js') } })])
  window.__mocks = controls
  // Resolve pedidos pendentes vencidos e emite order.updated (também após refresh).
  setInterval(() => db.settleDueOrders(), 400)
}
