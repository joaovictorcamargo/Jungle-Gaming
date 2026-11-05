import { useEffect } from 'react'

/** Define o título do documento por rota (leitores de tela, histórico e SEO). */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return
    const prev = document.title
    document.title = `${title} · KURIO`
    return () => { document.title = prev }
  }, [title])
}
