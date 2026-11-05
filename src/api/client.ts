import axios, { AxiosError } from 'axios'
import type { ApiErrorBody, ApiErrorCode, Quote } from './types'
import { getGuestId, getToken, notifyUnauthorized } from '@/lib/session'
import { backendReady } from '@/lib/backend-ready'

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly fieldErrors: Record<string, string>
  readonly quote?: Quote
  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.fieldErrors = body.fieldErrors ?? {}
    this.quote = body.quote
  }
  get transient() { return this.code === 'network_error' || this.code === 'timeout' || this.status >= 500 }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError

export const http = axios.create({ baseURL: '/api', timeout: 8000 })

http.interceptors.request.use(async (config) => {
  await backendReady // no modo demonstração, espera o service worker do MSW
  const token = getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  else config.headers.set('X-Guest-Id', getGuestId())
  return config
})

http.interceptors.response.use(
  (r) => r,
  (error: AxiosError<ApiErrorBody>) => {
    if (axios.isCancel(error)) return Promise.reject(error)
    if (error.response) {
      const body = error.response.data
      const apiErr = new ApiError(error.response.status, body && body.code ? body : { code: 'unknown', message: 'Erro inesperado.' })
      if (error.response.status === 401 && getToken()) notifyUnauthorized(apiErr.code === 'session_expired' ? 'expired' : 'invalid')
      return Promise.reject(apiErr)
    }
    const timeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
    return Promise.reject(new ApiError(0, { code: timeout ? 'timeout' : 'network_error', message: timeout ? 'A requisição demorou demais.' : 'Sem conexão com o servidor.' }))
  },
)
