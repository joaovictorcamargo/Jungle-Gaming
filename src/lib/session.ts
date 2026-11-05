import { useSyncExternalStore } from 'react'
import type { Session, User } from '@/api/types'

const TOKEN_KEY = 'nft:token'
const GUEST_KEY = 'nft:guest-id'

export interface SessionState { status: 'loading' | 'authenticated' | 'anonymous'; user: User | null; token: string | null; expiresAt: string | null }

const safe = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* noop */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* noop */ } },
}

let state: SessionState = { status: safe.get(TOKEN_KEY) ? 'loading' : 'anonymous', user: null, token: safe.get(TOKEN_KEY), expiresAt: null }
const subs = new Set<() => void>()
const set = (next: SessionState) => { state = next; subs.forEach((s) => s()) }

export const getSession = () => state
export const getToken = () => state.token
export const subscribeSession = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn) } }
export const useSession = () => useSyncExternalStore(subscribeSession, getSession, getSession)

export function getGuestId(): string {
  let id = safe.get(GUEST_KEY)
  if (!id) { id = crypto.randomUUID(); safe.set(GUEST_KEY, id) }
  return id
}
export const getGuestIdIfAny = () => safe.get(GUEST_KEY)
export const clearGuestId = () => safe.del(GUEST_KEY)

export function setSession(s: Session) {
  safe.set(TOKEN_KEY, s.token)
  set({ status: 'authenticated', user: s.user, token: s.token, expiresAt: s.expiresAt })
}
export function updateUser(user: User) { set({ ...state, user }) }
export function clearSession() {
  safe.del(TOKEN_KEY)
  set({ status: 'anonymous', user: null, token: null, expiresAt: null })
}

/* Ponte para o roteador/cache (evita dependência circular): registrada em app/bootstrap. */
type UnauthorizedHandler = (reason: 'expired' | 'invalid') => void
let onUnauthorized: UnauthorizedHandler = () => clearSession()
export const setUnauthorizedHandler = (fn: UnauthorizedHandler) => { onUnauthorized = fn }
export const notifyUnauthorized = (reason: 'expired' | 'invalid') => onUnauthorized(reason)
