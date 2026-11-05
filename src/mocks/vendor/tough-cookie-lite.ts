/**
 * Substituto mínimo de `tough-cookie` para o bundle do navegador (alias em vite.config.ts).
 *
 * O MSW usa `tough-cookie` (e, por tabela, `tldts` com a lista de sufixos públicos, ~250 KB) apenas para
 * persistir cookies definidos por respostas simuladas. Esta aplicação não usa cookies — a sessão vai no
 * cabeçalho `Authorization` —, então o armazenamento de cookies do MSW pode ser um no-op.
 * Efeito: `request.cookies` nos handlers reflete só `document.cookie`, e `Set-Cookie` em respostas simuladas é ignorado.
 */
export class Cookie {
  static fromJSON(): Cookie | null { return null }
  toJSON(): Record<string, unknown> { return {} }
}

export class MemoryCookieStore {
  idx: Record<string, unknown> = {}
}

export class CookieJar {
  constructor(_store?: MemoryCookieStore) { void _store }
  getCookiesSync(_url: string): Cookie[] { void _url; return [] }
  async setCookie(_cookie: string, _url: string): Promise<void> { void _cookie; void _url }
}
