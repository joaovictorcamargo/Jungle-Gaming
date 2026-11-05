import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'
import { queryClient } from '@/lib/query'
import { router } from './router'
import { setUnauthorizedHandler } from '@/lib/session'
import { endSession } from '@/lib/useAuthActions'
import { toast } from '@/components/ui/toaster'

// Sessão expirada/inválida durante a navegação ou checkout: limpa dados privados e volta ao login preservando o contexto.
setUnauthorizedHandler((reason) => {
  const href = router.state.location.href
  endSession()
  toast(reason === 'expired' ? 'Sua sessão expirou. Entre novamente para continuar.' : 'Faça login para continuar.', 'error')
  if (!href.startsWith('/login')) void router.navigate({ to: '/login', search: { redirect: href, reason: reason === 'expired' ? 'expired' : undefined } })
})

export function App() {
  useEffect(() => { document.documentElement.lang = 'pt-BR' }, [])
  return <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>
}
