/** Caminho-base da publicação (`/` localmente; `/Jungle-Gaming/` no GitHub Pages). Definido por `BASE_PATH` no build. */
export const BASE = import.meta.env.BASE_URL
/** Prefixa um caminho de arquivo público (ex.: `nfts/ape-1.webp`) com o caminho-base. */
export const asset = (p: string) => BASE + p.replace(/^\//, '')
