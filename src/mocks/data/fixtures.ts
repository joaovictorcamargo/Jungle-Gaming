import type { Category, Edition, NetworkId, NftReview, Wallet } from '@/api/types'
import { fromWei, toWei } from '@/lib/eth'

/** PRNG determinístico (mulberry32) para fixtures reproduzíveis. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface NftRecord {
  id: string
  title: string
  creator: string
  collection: string
  category: Category
  network: NetworkId
  price: string
  image: string
  gallery: string[]
  description: string
  featured: boolean
  likes: number
  createdAt: string
  version: number
  editions: Edition[]
  tokenId: string
  attributes: string[]
  rating: { average: number; count: number }
  reviews: NftReview[]
}

const COLLECTIONS = ['Kurio Apes', 'Kurio Editions', 'Golden Frequencies', 'Violet Nomads', 'Ivory Society', 'Jade Club']
const CATEGORIES: Category[] = ['arte', 'musica', 'fotografia', 'games']
const NETWORKS: NetworkId[] = ['ethereum', 'polygon', 'base']
const CREATORS = ['Lia Moretti', 'Kaito Verde', 'Nox Atelier', 'Maya Quillon', 'Studio Aurora', 'Teo Bramante']
/** Nomes e retratos do arquivo do Figma (4 artes; cada nome usa a arte correspondente). */
const NAMES: [string, number, string[]][] = [
  ['Emerald Ape', 1, ['Óculos', 'Esmeralda', 'Raro']], ['Sage Nomad', 2, ['Chapéu', 'Moletom', 'Comum']],
  ['Neon Vessel', 3, ['Blazer', 'Gola alta', 'Raro']], ['Golden Beat', 4, ['Fones', 'Jaqueta', 'Incomum']],
  ['Cosmic Bloom', 2, ['Chapéu', 'Lavanda', 'Incomum']], ['Ivory Baron', 3, ['Brinco', 'Marfim', 'Lendário']],
  ['Golden Signal', 4, ['Fones', 'Verde-sálvia', 'Raro']], ['Violet Nomad', 2, ['Moletom', 'Violeta', 'Comum']],
  ['Golden Frequency', 4, ['Fones', 'Dourado', 'Lendário']], ['Jade Monarch', 1, ['Colar', 'Jade', 'Lendário']],
  ['Onyx Curator', 3, ['Gola alta', 'Ônix', 'Incomum']], ['Velvet Hood', 2, ['Capuz', 'Veludo', 'Raro']],
]
const REVIEWERS = ['Rafa M.', 'Bia Torres', 'Caio N.', 'Duda L.', 'Enzo P.']
const REVIEW_TEXTS = [
  'Arte impecável, a procedência apareceu na carteira em segundos.',
  'Edição muito bem acabada. Comprei a segunda unidade para presentear.',
  'Paleta linda e atributos raros. Valeu cada ETH.',
  'Ótima curadoria da coleção, entrega rápida e transparente.',
]

export const NFT_COUNT = 36

export function buildNfts(): NftRecord[] {
  const r = rng(2026)
  const baseDate = Date.UTC(2026, 0, 1)
  return Array.from({ length: NFT_COUNT }, (_, i) => {
    const n = i + 1
    const id = `nft-${String(n).padStart(3, '0')}`
    const price = (0.04 + r() * 3.2).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
    const supply = 3 + Math.floor(r() * 18)
    const split = [Math.ceil(supply * 0.6), Math.ceil(supply * 0.3)]
    const legendary = Math.max(1, supply - split[0]! - split[1]!)
    const editions: Edition[] = [
      { id: 'standard', label: 'Standard', supply: split[0]!, available: split[0]! },
      { id: 'rare', label: 'Rare', supply: split[1]!, available: split[1]! },
      { id: 'legendary', label: 'Legendary', supply: legendary, available: legendary },
    ]
    // Casos determinísticos para os testes
    if (n === 7) editions.forEach((e) => (e.available = 0)) // esgotado
    if (n === 8) { editions[0]!.available = 2; editions[1]!.available = 0; editions[2]!.available = 0 } // limite de quantidade
    const [name, art, attributes] = NAMES[i % NAMES.length]!
    const ratingCount = 4 + Math.floor(r() * 30)
    const reviews: NftReview[] = Array.from({ length: Math.min(3, ratingCount) }, (_, k) => ({
      id: `${id}-r${k}`, author: REVIEWERS[(i + k) % REVIEWERS.length]!, rating: 4 + ((i + k) % 2), text: REVIEW_TEXTS[(i + k) % REVIEW_TEXTS.length]!,
    }))
    return {
      id,
      title: `${name} #${n}`,
      creator: CREATORS[i % CREATORS.length]!,
      collection: COLLECTIONS[i % COLLECTIONS.length]!,
      category: CATEGORIES[(i * 3 + 1) % CATEGORIES.length]!,
      network: NETWORKS[(i * 7 + 2) % NETWORKS.length]!,
      price,
      image: `/nfts/ape-${art}.webp`,
      // Galeria: a arte do NFT seguida das demais artes da coleção (4 vistas, como no Figma).
      gallery: [art, ...[1, 2, 3, 4].filter((a) => a !== art)].map((a) => `/nfts/ape-${a}.webp`),
      description:
        'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.',
      tokenId: String(n * 7 + 35).padStart(4, '0'),
      attributes,
      rating: { average: Math.round((4.2 + r() * 0.7) * 10) / 10, count: ratingCount },
      reviews,
      featured: n <= 6,
      likes: Math.floor(r() * 900),
      createdAt: new Date(baseDate + i * 86_400_000 * 3).toISOString(),
      version: 1,
      editions: editions.map((e) => ({ ...e, available: Math.min(e.available, e.supply) })),
    }
  })
}

export interface UserRecord {
  id: string
  name: string
  email: string
  bio: string
  avatarUrl: string | null
  passwordHash: string
}

/** Senhas fictícias: SHA-256 hex. Ana: "Senha@123" · Bruno: "Senha@456". */
export const DEMO_CREDENTIALS = [
  { email: 'ana@example.com', password: 'Senha@123' },
  { email: 'bruno@example.com', password: 'Senha@456' },
]

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`nft-salt:${text}`))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function buildUsers(): Promise<UserRecord[]> {
  return [
    { id: 'u1', name: 'Ana Colecionadora', email: 'ana@example.com', bio: 'Colecionando arte digital desde 2021.', avatarUrl: '/avatars/ana.svg', passwordHash: await sha256('Senha@123') },
    { id: 'u2', name: 'Bruno Minter', email: 'bruno@example.com', bio: 'Curador de coleções generativas.', avatarUrl: '/avatars/bruno.svg', passwordHash: await sha256('Senha@456') },
  ]
}

export function buildWallets(): Record<string, Wallet[]> {
  return {
    u1: [
      { id: 'w1', kind: 'primary', label: 'Carteira principal', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', network: 'ethereum' },
      { id: 'w2', kind: 'secondary', label: 'Carteira Polygon', address: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30', network: 'polygon' },
    ],
    u2: [{ id: 'w3', kind: 'primary', label: 'Carteira do Bruno', address: '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E', network: 'base' }],
  }
}

export interface CouponRecord { code: string; percentOff: number; expiresAt: string }
export const COUPONS: CouponRecord[] = [
  { code: 'WELCOME10', percentOff: 10, expiresAt: '2099-12-31T23:59:59Z' },
  { code: 'COLLECTOR25', percentOff: 25, expiresAt: '2099-12-31T23:59:59Z' },
  { code: 'EXPIRED10', percentOff: 10, expiresAt: '2020-01-01T00:00:00Z' },
]

export const NETWORK_FEES: Record<NetworkId, string> = {
  ethereum: '0.0021',
  polygon: '0.0003',
  base: '0.0005',
}

export function sumWei(values: string[]): string {
  return fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))
}
