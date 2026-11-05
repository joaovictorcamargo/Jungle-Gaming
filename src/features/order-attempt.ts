import type { OrderInput } from '@/api/types'

/**
 * Tentativa de pedido: a chave de idempotência é reutilizada enquanto o conteúdo for idêntico.
 * Assim, clique repetido, timeout seguido de nova tentativa ou refresh recuperam o MESMO pedido.
 */
interface Attempt { key: string; fingerprint: string }
const k = (uid: string) => `nft:order-attempt:${uid}`
const fingerprint = (i: OrderInput) => JSON.stringify([i.items, i.couponCode, i.network, i.walletId, i.collector, i.quoteId, i.expectedTotal])

export function attemptFor(uid: string, input: OrderInput): string {
  const fp = fingerprint(input)
  try {
    const cur = JSON.parse(localStorage.getItem(k(uid)) ?? 'null') as Attempt | null
    if (cur && cur.fingerprint === fp) return cur.key
  } catch { /* ignora */ }
  const next: Attempt = { key: crypto.randomUUID(), fingerprint: fp }
  try { localStorage.setItem(k(uid), JSON.stringify(next)) } catch { /* noop */ }
  return next.key
}
export const hasAttempt = (uid: string) => { try { return !!localStorage.getItem(k(uid)) } catch { return false } }
export const clearAttempt = (uid: string) => { try { localStorage.removeItem(k(uid)) } catch { /* noop */ } }

/* Rascunho do checkout (sobrevive a refresh e à expiração de sessão do mesmo usuário). */
export interface Draft { name: string; email: string; document: string; walletId: string; network: string }
const dk = (uid: string) => `nft:checkout-draft:${uid}`
export const loadDraft = (uid: string): Draft | null => { try { return JSON.parse(localStorage.getItem(dk(uid)) ?? 'null') } catch { return null } }
export const saveDraft = (uid: string, d: Draft) => { try { localStorage.setItem(dk(uid), JSON.stringify(d)) } catch { /* noop */ } }
export const clearDraft = (uid: string) => { try { localStorage.removeItem(dk(uid)) } catch { /* noop */ } }
