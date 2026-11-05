import { useDocumentTitle } from '@/lib/title'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InputField, RevealToggle } from '@/components/ui/field'
import { AuthCard } from '@/features/auth-card'
import { EMAIL_RE, passwordIssue, useFormErrors } from '@/features/forms'
import { register } from '@/lib/useAuthActions'

const route = getRouteApi('/cadastro')

export default function RegisterPage() {
  useDocumentTitle('Criar conta')
  const search = route.useSearch()
  const router = useRouter()
  const f = useFormErrors()
  const [v, setV] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const [confirm, setConfirm] = useState('')
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (v.name.trim().length < 2) errs.name = 'Informe seu nome.'
    if (!EMAIL_RE.test(v.email)) errs.email = 'Informe um e-mail válido.'
    const pw = passwordIssue(v.password); if (pw) errs.password = pw
    else if (confirm !== v.password) errs.confirm = 'As senhas não coincidem.'
    if (!f.setLocal(errs)) return
    setBusy(true)
    try { await register(v); router.history.push(search.redirect ?? '/') }
    catch (err) { f.fromApi(err) }
    finally { setBusy(false) }
  }

  return (
    <AuthCard mode="register" redirect={search.redirect} intro="Crie seu perfil de colecionador e conecte sua carteira quando quiser.">
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        {f.formError && <p role="alert" className="rounded-[5px] bg-danger-bg px-3 py-2 text-sm font-medium text-danger">⚠ {f.formError}</p>}
        <InputField hideLabel label="Nome" autoComplete="name" placeholder="Nome de usuário" className="rounded-[5px] px-4" value={v.name} onChange={set('name')} error={f.errors.name} />
        <InputField hideLabel label="E-mail" type="email" autoComplete="email" placeholder="Digite seu e-mail" className="rounded-[5px] px-4" value={v.email} onChange={set('email')} error={f.errors.email} />
        <InputField hideLabel label="Senha" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Senha" className="rounded-[5px] px-4" value={v.password} onChange={set('password')} error={f.errors.password} hint="Mínimo de 8 caracteres, com letras e números." endAdornment={<RevealToggle shown={show} onToggle={() => setShow((x) => !x)} />} />
        <InputField hideLabel label="Confirmar senha" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Confirmar senha" className="rounded-[5px] px-4" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={f.errors.confirm} />
        <Button type="submit" size="lg" className="mt-3 w-full rounded-[5px] text-base" disabled={busy}>{busy ? 'Criando conta…' : 'Criar conta'}</Button>
      </form>
    </AuthCard>
  )
}
