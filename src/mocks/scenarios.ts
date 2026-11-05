/**
 * Cenários determinísticos e configuráveis da camada de rede simulada.
 * Podem ser combinados: `?scenario=slow,payment-declined`.
 */
export interface Scenario {
  latency: { min: number; max: number }
  /** Respostas do catálogo chegam fora de ordem (termos curtos demoram mais). */
  outOfOrder: boolean
  catalog: 'ok' | 'empty' | 'network-error' | 'server-error' | 'flaky'
  /** Quantas vezes o catálogo "flaky" falha antes de recuperar. */
  flakyFailures: number
  favoritesFailures: number
  sessionTtlMs: number
  orderOutcome: 'confirmed' | 'declined'
  /** Pedido criado, mas a resposta nunca chega (timeout). Recuperação por idempotência. */
  orderTimeoutOnce: boolean
  /** Primeira tentativa de pedido encontra preço alterado (409 quote_changed). */
  priceChangeOnCheckout: boolean
  /** Primeira tentativa de pedido encontra edição esgotada (409 availability_conflict). */
  soldOutOnCheckout: boolean
  walletRejects: boolean
  /** Tempo até o pedido pendente ser resolvido. */
  settleMs: number
}

export const BASE_SCENARIO: Scenario = {
  latency: { min: 80, max: 200 },
  outOfOrder: false,
  catalog: 'ok',
  flakyFailures: 2,
  favoritesFailures: 0,
  sessionTtlMs: 30 * 60 * 1000,
  orderOutcome: 'confirmed',
  orderTimeoutOnce: false,
  priceChangeOnCheckout: false,
  soldOutOnCheckout: false,
  walletRejects: false,
  settleMs: 1500,
}

export const SCENARIO_PRESETS: Record<string, Partial<Scenario>> = {
  default: {},
  empty: { catalog: 'empty' },
  slow: { latency: { min: 1800, max: 1800 } },
  'variable-latency': { latency: { min: 100, max: 900 }, outOfOrder: true },
  'network-error': { catalog: 'network-error' },
  'server-error': { catalog: 'server-error' },
  'flaky-catalog': { catalog: 'flaky', flakyFailures: 3 },
  'session-expired': { sessionTtlMs: 15_000 },
  'favorite-failure': { favoritesFailures: 1 },
  'payment-declined': { orderOutcome: 'declined' },
  'order-timeout': { orderTimeoutOnce: true },
  'price-changed': { priceChangeOnCheckout: true },
  'sold-out': { soldOutOnCheckout: true },
  'wallet-rejected': { walletRejects: true },
  'slow-settle': { settleMs: 6000 },
}

export function resolveScenario(names: string[], overrides: Partial<Scenario> = {}): Scenario {
  return names.reduce<Scenario>((acc, n) => ({ ...acc, ...(SCENARIO_PRESETS[n] ?? {}) }), { ...BASE_SCENARIO, ...overrides })
}
