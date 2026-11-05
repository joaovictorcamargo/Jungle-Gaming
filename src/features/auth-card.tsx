import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

/** Cartão de autenticação dos quadros "Login" e "Cadastro": abas Entrar | Criar conta e acesso social. */
export function AuthCard({ mode, redirect, intro, children }: { mode: 'login' | 'register'; redirect?: string; intro: string; children: ReactNode }) {
  const tab = (active: boolean) => cn('text-xl font-medium', active ? 'text-primary-soft' : 'text-fg hover:text-primary-soft')
  return (
    <div className="px-4 py-10 sm:py-16">
      <p aria-hidden="true" className="mb-10 text-center text-[32px] font-bold text-fg sm:hidden">KURIO</p>
      <div className="relative mx-auto w-full max-w-[500px] overflow-hidden bg-surface shadow-[0_0_40px_rgba(10,6,4,0.6)]">
        <div className="flex flex-col items-center gap-6 px-6 pt-12 sm:px-12">
          <nav aria-label="Acesso" className="flex items-center gap-2">
            {mode === 'login' ? <h1 className={tab(true)}>Entrar</h1> : <Link to="/login" search={{ redirect }} className={tab(false)}>Entrar</Link>}
            <span aria-hidden="true" className="h-5 w-px bg-danger" />
            {mode === 'register' ? <h1 className={tab(true)}>Criar conta</h1> : <Link to="/cadastro" search={{ redirect }} className={tab(false)}>Criar conta</Link>}
          </nav>
          <p className="text-center text-[13px] text-fg">{intro}</p>
        </div>
        <div className="px-6 pb-2 pt-6 sm:px-20">{children}</div>
        <div className="flex flex-col items-center gap-3 px-6 pb-12 pt-6 sm:px-20">
          <p className="text-[13px] text-fg">Ou continue com</p>
          {(['Google', 'Facebook'] as const).map((p) => (
            <button key={p} type="button" onClick={() => toast(`Acesso com ${p} indisponível na demonstração.`, 'info')} className="flex h-10 w-full cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-line text-[13px] font-medium text-muted hover:border-primary">
              <span aria-hidden="true" className={cn('grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold', p === 'Google' ? 'bg-fg text-[#4086f4]' : 'bg-[#3b5999] text-white')}>{p[0]}</span>
              Continuar com {p}
            </button>
          ))}
        </div>
        <div aria-hidden="true" className="h-2.5 bg-primary" />
      </div>
    </div>
  )
}
