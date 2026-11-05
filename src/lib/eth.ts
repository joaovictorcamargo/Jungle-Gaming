/**
 * Aritmética decimal exata para valores em ETH.
 * Os valores trafegam como strings decimais ("0.125") e são calculados em wei (bigint, 18 casas).
 */
export type EthString = string

const DECIMALS = 18
const SCALE = 10n ** BigInt(DECIMALS)
const ETH_RE = /^\d+(\.\d{1,18})?$/

export function isEth(value: string): boolean {
  return ETH_RE.test(value)
}

export function toWei(value: EthString): bigint {
  if (!isEth(value)) throw new Error(`Valor ETH inválido: ${value}`)
  const [int = '0', frac = ''] = value.split('.')
  return BigInt(int) * SCALE + BigInt(frac.padEnd(DECIMALS, '0'))
}

export function fromWei(wei: bigint): EthString {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const int = abs / SCALE
  const frac = (abs % SCALE).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

export const ETH_ZERO: EthString = '0'

export function addEth(a: EthString, b: EthString): EthString {
  return fromWei(toWei(a) + toWei(b))
}

export function subEth(a: EthString, b: EthString): EthString {
  return fromWei(toWei(a) - toWei(b))
}

/** Multiplica por uma quantidade inteira. */
export function mulEthInt(a: EthString, qty: number): EthString {
  if (!Number.isInteger(qty) || qty < 0) throw new Error('Quantidade deve ser inteira')
  return fromWei(toWei(a) * BigInt(qty))
}

/** Aplica percentual em pontos-base (1% = 100 bps), arredondando para baixo. */
export function pctEth(a: EthString, bps: number): EthString {
  return fromWei((toWei(a) * BigInt(bps)) / 10000n)
}

export function cmpEth(a: EthString, b: EthString): number {
  const x = toWei(a)
  const y = toWei(b)
  return x < y ? -1 : x > y ? 1 : 0
}

export function eqEth(a: EthString, b: EthString): boolean {
  return toWei(a) === toWei(b)
}

/** Apresentação sem perda de precisão: mostra todas as casas significativas (mínimo 2). */
export function formatEth(value: EthString): string {
  const [int = '0', frac = ''] = value.split('.')
  return `${int}.${frac.padEnd(2, '0')} ETH`
}
