export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
export const networkLabel: Record<string, string> = { ethereum: 'Ethereum', polygon: 'Polygon', base: 'Base' }
export const categoryLabel: Record<string, string> = { arte: 'Arte digital', musica: 'Música', fotografia: 'Fotografia', games: 'Jogos' }
export const sortLabel: Record<string, string> = { newest: 'Listados recentemente', popular: 'Mais populares', price_asc: 'Menor preço', price_desc: 'Maior preço' }
export const formatDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })
