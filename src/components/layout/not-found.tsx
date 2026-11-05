import { useDocumentTitle } from '@/lib/title'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFound() {
  useDocumentTitle('Página não encontrada')
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-primary-soft" aria-hidden="true">404</p>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-muted">O endereço que você acessou não existe ou foi movido.</p>
      <Button asChild><Link to="/">Voltar ao início</Link></Button>
    </section>
  )
}
