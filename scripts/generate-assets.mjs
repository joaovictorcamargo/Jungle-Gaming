// Gera os avatares de demonstração em SVG (assets locais, sem rede).
// As artes dos NFTs são os 4 retratos exportados do Figma, em public/nfts/ape-{1..4}.webp.
import { writeFileSync, mkdirSync } from 'node:fs'

// Paleta do Figma (tokens primary, surface-dark, foreground).
const PALETTES = [['#d28a4c', '#38220f', '#f5f1eb'], ['#e3a44e', '#241612', '#cfb28c']]
mkdirSync('public/avatars', { recursive: true })
for (const [name, seed] of [['ana', 0], ['bruno', 1]]) {
  const p = PALETTES[seed % PALETTES.length]
  writeFileSync(`public/avatars/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><rect width="128" height="128" fill="${p[0]}"/><circle cx="64" cy="52" r="24" fill="${p[2]}"/><path d="M20 118c6-28 30-38 44-38s38 10 44 38z" fill="${p[1]}"/></svg>`)
}
console.log('Gerados 2 avatares.')
