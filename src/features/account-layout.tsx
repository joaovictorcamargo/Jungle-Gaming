import { Link, useNavigate } from '@tanstack/react-router'
import { BadgePercent, Download, Heart, LogOut, ShoppingCart, TriangleAlert, UserRound, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { logout } from '@/lib/useAuthActions'
import { cn } from '@/lib/utils'

const SOON: [string, typeof Heart][] = [['Atividade', ShoppingCart], ['Lista de interesse', Heart], ['Ofertas', BadgePercent], ['Arquivos baixados', Download], ['Suporte', TriangleAlert]]

/** Layout das telas "Perfil do colecionador" e "Carteiras": menu lateral "Meu perfil" + conteúdo. */
export function AccountLayout({ active, children }: { active: 'perfil' | 'carteiras'; children: ReactNode }) {
  const navigate = useNavigate()
  const item = 'flex h-[45px] items-center gap-3 border-l-[3px] px-4 text-[15px] text-primary-soft'
  return (
    <div className="mx-auto grid max-w-[1200px] gap-7 px-4 py-6 sm:px-6 lg:grid-cols-[310px_1fr] xl:px-0">
      <nav aria-label="Meu perfil" className="h-fit bg-surface py-2">
        <p className="px-2.5 py-2.5 text-lg font-bold text-fg">Meu perfil</p>
        <ul className="flex flex-wrap gap-x-1 lg:flex-col lg:flex-nowrap lg:gap-0">
          <li><Link to="/perfil" aria-current={active === 'perfil' ? 'page' : undefined} className={cn(item, 'whitespace-nowrap hover:bg-surface-2', active === 'perfil' ? 'border-primary' : 'border-transparent')}><UserRound aria-hidden="true" className="h-[18px] w-[18px]" />Dados do perfil</Link></li>
          <li><Link to="/carteiras" aria-current={active === 'carteiras' ? 'page' : undefined} className={cn(item, 'whitespace-nowrap hover:bg-surface-2', active === 'carteiras' ? 'border-primary' : 'border-transparent')}><Wallet aria-hidden="true" className="h-[18px] w-[18px]" />Carteiras</Link></li>
          {SOON.map(([label, Icon]) => (
            <li key={label} className={cn(item, 'hidden whitespace-nowrap border-transparent opacity-70 lg:flex')} title="Em breve"><Icon aria-hidden="true" className="h-[18px] w-[18px]" />{label}<span className="sr-only"> (em breve)</span></li>
          ))}
          <li className="shrink-0 lg:mt-1 lg:border-t lg:border-line">
            <button type="button" onClick={async () => { await logout(); void navigate({ to: '/' }) }} className={cn(item, 'h-[45px] cursor-pointer whitespace-nowrap lg:h-10 lg:w-full border-transparent font-bold hover:bg-surface-2')}><LogOut aria-hidden="true" className="h-[18px] w-[18px]" />Sair</button>
          </li>
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
