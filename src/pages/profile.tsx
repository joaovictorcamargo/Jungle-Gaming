import { useDocumentTitle } from '@/lib/title'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { profileApi } from '@/api/endpoints'
import { Button } from '@/components/ui/button'
import { InputField, RevealToggle, TextareaField } from '@/components/ui/field'
import { AccountLayout } from '@/features/account-layout'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toaster'
import { EMAIL_RE, passwordIssue, useFormErrors } from '@/features/forms'
import { ErrorState } from '@/features/shared'
import { qk } from '@/lib/query'
import { updateUser, useSession } from '@/lib/session'

function PasswordForm() {
  const f = useFormErrors()
  const [v, setV] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const m = useMutation({ mutationFn: profileApi.changePassword })
  const [show, setShow] = useState(false)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!v.currentPassword) errs.currentPassword = 'Informe a senha atual.'
    const pw = passwordIssue(v.newPassword); if (pw) errs.newPassword = pw
    if (v.confirm !== v.newPassword) errs.confirm = 'As senhas não coincidem.'
    if (!f.setLocal(errs)) return
    m.mutate({ currentPassword: v.currentPassword, newPassword: v.newPassword }, {
      onSuccess: () => { toast('Senha alterada com sucesso.', 'success'); setV({ currentPassword: '', newPassword: '', confirm: '' }) },
      onError: (err) => f.fromApi(err),
    })
  }
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }))
  const eye = <RevealToggle shown={show} onToggle={() => setShow((x) => !x)} />
  return (
    <form noValidate onSubmit={submit} aria-labelledby="senha-titulo" className="flex max-w-[417px] flex-col gap-4">
      <h2 id="senha-titulo" className="text-base font-medium text-fg">Alterar senha</h2>
      {f.formError && <p role="alert" className="text-sm font-medium text-danger">⚠ {f.formError}</p>}
      <InputField label="Senha atual" type={show ? 'text' : 'password'} autoComplete="current-password" value={v.currentPassword} onChange={set('currentPassword')} error={f.errors.currentPassword} endAdornment={eye} />
      <InputField label="Nova senha" type={show ? 'text' : 'password'} autoComplete="new-password" value={v.newPassword} onChange={set('newPassword')} error={f.errors.newPassword} endAdornment={eye} />
      <InputField label="Confirmar nova senha" type={show ? 'text' : 'password'} autoComplete="new-password" value={v.confirm} onChange={set('confirm')} error={f.errors.confirm} endAdornment={eye} />
      <Button type="submit" className="w-fit rounded-[3px] px-8" disabled={m.isPending}>{m.isPending ? 'Salvando…' : 'Alterar senha'}</Button>
    </form>
  )
}

export default function ProfilePage() {
  useDocumentTitle('Perfil do colecionador')
  const { user } = useSession()
  const qc = useQueryClient()
  const uid = user!.id
  const q = useQuery({ queryKey: qk.profile(uid), queryFn: ({ signal }) => profileApi.get({ signal }) })
  const f = useFormErrors()
  const [v, setV] = useState({ name: '', email: '', bio: '' })
  const file = useRef<HTMLInputElement>(null)
  const [avatarError, setAvatarError] = useState<string | undefined>()
  useEffect(() => { if (q.data) setV({ name: q.data.name, email: q.data.email, bio: q.data.bio }) }, [q.data])

  const onUser = (u: NonNullable<typeof q.data>) => { qc.setQueryData(qk.profile(uid), u); updateUser(u) }
  const save = useMutation({ mutationFn: profileApi.update, onSuccess: (u) => { onUser(u); toast('Perfil atualizado.', 'success') }, onError: (e) => f.fromApi(e) })
  const avatar = useMutation({ mutationFn: profileApi.uploadAvatar, onSuccess: (u) => { onUser(u); setAvatarError(undefined); toast('Avatar atualizado.', 'success') }, onError: (e) => setAvatarError((e as { fieldErrors?: Record<string, string> }).fieldErrors?.avatar ?? 'Não foi possível enviar a imagem.') })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (v.name.trim().length < 2) errs.name = 'Informe seu nome.'
    if (!EMAIL_RE.test(v.email)) errs.email = 'Informe um e-mail válido.'
    if (v.bio.length > 160) errs.bio = 'A bio deve ter até 160 caracteres.'
    if (f.setLocal(errs)) save.mutate(v)
  }

  return (
    <AccountLayout active="perfil">
      <h1 className="text-base font-bold text-fg">Perfil do colecionador</h1>
      {q.isLoading ? <div className="mt-6 flex flex-col gap-4" aria-busy="true"><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></div> : q.error ? <div className="mt-6"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div> : (
        <div className="mt-6 flex flex-col gap-10">
          <form noValidate onSubmit={submit} aria-label="Dados do perfil" className="flex flex-col gap-6">
            {f.formError && <p role="alert" className="text-sm font-medium text-danger">⚠ {f.formError}</p>}
            <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
              <InputField mark label="Nome" autoComplete="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={f.errors.name} />
              <InputField mark label="E-mail" type="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} error={f.errors.email} />
              <TextareaField label="Bio" className="min-h-[96px]" value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} error={f.errors.bio} hint={`${v.bio.length}/160`} />
              <section aria-labelledby="avatar-titulo" className="flex flex-col gap-2.5">
                <h2 id="avatar-titulo" className="text-[15px] text-fg">Avatar</h2>
                <div className="flex items-center gap-5">
                  {q.data?.avatarUrl ? <img src={q.data.avatarUrl} alt={`Avatar de ${q.data.name}`} width={50} height={50} className="h-[50px] w-[50px] rounded-full border border-line object-cover" /> : <div className="grid h-[50px] w-[50px] place-items-center rounded-full border border-line bg-surface-2 font-bold" aria-hidden="true">{q.data?.name[0]}</div>}
                  <input ref={file} type="file" accept="image/*" className="sr-only" id="avatar-input" aria-label="Escolher imagem de avatar" onChange={(e) => { const fl = e.target.files?.[0]; if (fl) avatar.mutate(fl); e.target.value = '' }} />
                  <Button type="button" size="sm" className="w-[98px] rounded-[3px]" disabled={avatar.isPending} onClick={() => file.current?.click()}>{avatar.isPending ? 'Enviando…' : 'Alterar'}</Button>
                  <p className="text-xs text-muted">Imagem de até 150 KB.</p>
                </div>
                {avatarError && <p role="alert" className="text-xs font-medium text-danger">⚠ {avatarError}</p>}
              </section>
            </div>
            <Button type="submit" className="w-fit rounded-[3px] px-8" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar alterações'}</Button>
          </form>
          <PasswordForm />
        </div>
      )}
    </AccountLayout>
  )
}
