import { clearSession, clearGuestId, getGuestIdIfAny, setSession, getSession } from '@/lib/session'
import { purgePrivateCache, queryClient } from '@/lib/query'
import { authApi, cartApi } from '@/api/endpoints'
import type { LoginInput, RegisterInput, Session } from '@/api/types'
import { disconnectSocket } from '@/realtime/socket'

/**
 * Mescla o carrinho do visitante ao do usuário. Executa ANTES de expor a sessão à interface, para que uma navegação
 * logo após o login não aborte a operação. Se falhar, o id do visitante é mantido e a fusão é retomada no boot.
 */
export async function mergeGuestCart(token?: string) {
  const guestId = getGuestIdIfAny()
  if (!guestId) return
  try { await cartApi.merge(guestId, token); clearGuestId() } catch { /* mantém para nova tentativa */ }
  await queryClient.invalidateQueries({ queryKey: ['cart'] })
}

/** Efetiva a sessão, preservando o carrinho do visitante (merge) e isolando dados de usuários anteriores. */
async function establish(s: Session) {
  const prev = getSession().user?.id
  if (prev && prev !== s.user.id) purgePrivateCache()
  await mergeGuestCart(s.token)
  setSession(s)
  await queryClient.invalidateQueries({ queryKey: ['cart'] })
  return s
}

export const login = async (i: LoginInput) => establish(await authApi.login(i))
export const register = async (i: RegisterInput) => establish(await authApi.register(i))

export async function logout() {
  // O encerramento local é imediato (sem esperar a rede): nenhum dado privado ou token sobrevive a uma navegação logo após o logout.
  const token = getSession().token
  endSession()
  if (token) { try { await authApi.logout(token) } catch { /* melhor esforço: a sessão local já foi encerrada */ } }
}

/** Limpa sessão, cache privado e subscriptions (logout, expiração e troca de usuário). */
export function endSession() {
  disconnectSocket()
  clearSession()
  purgePrivateCache()
  queryClient.clear()
}
