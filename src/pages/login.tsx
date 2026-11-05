import { useDocumentTitle } from '@/lib/title'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InputField, RevealToggle } from '@/components/ui/field'
import { toast } from '@/components/ui/toaster'
import { AuthCard } from '@/features/auth-card'
import { EMAIL_RE, useFormErrors } from '@/features/forms'
import { login } from '@/lib/useAuthActions'

const route = getRouteApi('/login')

export default function LoginPage() {
  useDocumentTitle('Entrar')
  const search = route.useSearch()
  const router = useRouter()
  const f = useFormErrors()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!EMAIL_RE.test(email)) errs.email = 'Informe um e-mail válido.'
    if (!password) errs.password = 'Informe sua senha.'
    if (!f.setLocal(errs)) return
    setBusy(true)
    try { await login({ email, password }); router.history.push(search.redirect ?? '/') }
    catch (err) { f.fromApi(err) }
    finally { setBusy(false) }
  }

  return (
    <AuthCard mode="login" redirect={search.redirect} intro="Entre para gerenciar sua carteira, coleção e perfil de criador.">
      {search.reason === 'expired' && <p role="status" className="mb-4 rounded-[5px] border border-warning/60 px-3 py-2 text-sm">Sua sessão expirou. Entre novamente — você voltará de onde parou.</p>}
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        {f.formError && <p role="alert" className="rounded-[5px] bg-danger-bg px-3 py-2 text-sm font-medium text-danger">⚠ {f.formError}</p>}
        <InputField hideLabel label="E-mail" type="email" autoComplete="email" placeholder="contato@email.com" className="h-10 rounded-[5px] px-4" value={email} onChange={(e) => setEmail(e.target.value)} error={f.errors.email} />
        <InputField hideLabel label="Senha" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Senha" className="h-10 rounded-[5px] px-4" value={password} onChange={(e) => setPassword(e.target.value)} error={f.errors.password} endAdornment={<RevealToggle shown={show} onToggle={() => setShow((x) => !x)} />} />
        <button type="button" onClick={() => toast('Enviamos as instruções de recuperação para o seu e-mail (simulado).', 'info')} className="cursor-pointer self-end text-sm text-primary-soft hover:underline">Esqueceu a senha?</button>
        <Button type="submit" size="lg" className="mt-3 w-full rounded-[5px] text-base" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</Button>
        <p className="text-center text-xs text-muted">Demonstração: <code>ana@example.com</code> / <code>Senha@123</code></p>
      </form>
    </AuthCard>
  )
}
