/**
 * Sinaliza quando o "backend" está pronto para receber requisições.
 * No build de demonstração isso acontece quando o service worker do MSW fica ativo; sem mocks, de imediato.
 * A interface é renderizada antes disso (o hero aparece cedo); só as requisições aguardam este sinal.
 */
let resolve!: () => void
export const backendReady = new Promise<void>((r) => { resolve = r })
export const markBackendReady = () => resolve()
