import { useDocumentTitle } from '@/lib/title'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { walletApi } from '@/api/endpoints'
import type { NetworkId, Wallet, WalletKind } from '@/api/types'
import { Button } from '@/components/ui/button'
import { InputField, SelectField } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toaster'
import { useFormErrors } from '@/features/forms'
import { ErrorState } from '@/features/shared'
import { AccountLayout } from '@/features/account-layout'
import { networkLabel } from '@/lib/format'
import { qk } from '@/lib/query'
import { useSession } from '@/lib/session'

const kindLabel: Record<WalletKind, string> = { primary: 'Principal', secondary: 'Secundária' }
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

function WalletForm({ kind, wallet, onDone }: { kind: WalletKind; wallet?: Wallet; onDone: () => void }) {
  const uid = useSession().user!.id
  const qc = useQueryClient()
  const f = useFormErrors()
  const [v, setV] = useState({ label: wallet?.label ?? '', address: wallet?.address ?? '', network: (wallet?.network ?? 'ethereum') as NetworkId })
  const m = useMutation({
    mutationFn: () => (wallet ? walletApi.update(wallet.id, { ...v, kind }) : walletApi.create({ ...v, kind })),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.wallets(uid) }); toast(wallet ? 'Carteira atualizada.' : 'Carteira cadastrada.', 'success'); onDone() },
    onError: (e) => f.fromApi(e),
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (v.label.trim().length < 2) errs.label = 'Informe um nome para a carteira.'
    if (!ADDRESS_RE.test(v.address)) errs.address = 'Endereço inválido (0x + 40 caracteres hexadecimais).'
    if (f.setLocal(errs)) m.mutate()
  }
  return (
    <form noValidate onSubmit={submit} aria-label={`${wallet ? 'Editar' : 'Cadastrar'} carteira ${kindLabel[kind].toLowerCase()}`} className="flex flex-col gap-6">
      {f.formError && <p role="alert" className="text-sm font-medium text-danger">⚠ {f.formError}</p>}
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        <InputField mark label="Nome da carteira" value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} error={f.errors.label} />
        <SelectField mark label="Rede" value={v.network} onChange={(e) => setV({ ...v, network: e.target.value as NetworkId })} error={f.errors.network}>
          {Object.entries(networkLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
        <InputField mark label="Endereço" wrapperClassName="md:col-span-2" className="font-mono" placeholder="Endereço 0x da carteira" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value.trim() })} error={f.errors.address} />
      </div>
      <div className="flex gap-3"><Button type="submit" size="sm" className="rounded-[3px]" disabled={m.isPending}>{m.isPending ? 'Salvando…' : 'Salvar carteira'}</Button><Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancelar</Button></div>
    </form>
  )
}

export default function WalletsPage() {
  useDocumentTitle('Carteiras')
  const uid = useSession().user!.id
  const q = useQuery({ queryKey: qk.wallets(uid), queryFn: ({ signal }) => walletApi.list({ signal }) })
  const [editing, setEditing] = useState<WalletKind | null>(null)
  const kinds: WalletKind[] = ['primary', 'secondary']

  return (
    <AccountLayout active="carteiras">
      <h1 className="text-base font-bold text-fg">Carteiras</h1>
      <p className="mt-2 text-sm text-muted">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados. A conexão é simulada.</p>
      {q.isLoading ? <div className="mt-6 flex flex-col gap-4" aria-busy="true"><Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" /></div> : q.error ? <div className="mt-6"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div> : (
        <ul className="mt-8 flex flex-col gap-10">
          {kinds.map((kind) => {
            const w = q.data?.find((x) => x.kind === kind)
            const name = `carteira ${kindLabel[kind].toLowerCase()}`
            return (
              <li key={kind} className="flex flex-col gap-4" data-testid={`wallet-${kind}`}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[17px] font-bold text-fg">Carteira {kindLabel[kind].toLowerCase()}</h2>
                  {editing !== kind && (w
                    ? <Button variant="link" onClick={() => setEditing(kind)} aria-label={`Editar ${name}`}>Editar</Button>
                    : <Button variant="link" onClick={() => setEditing(kind)} aria-label={`Adicionar ${name}`}>Adicionar</Button>)}
                </div>
                {editing === kind ? <WalletForm kind={kind} wallet={w} onDone={() => setEditing(null)} /> : w ? (
                  <dl className="grid gap-x-7 gap-y-3 rounded-[3px] border border-line p-4 text-sm md:grid-cols-3">
                    <div><dt className="text-[15px] text-fg">Nome</dt><dd className="text-muted">{w.label}</dd></div>
                    <div><dt className="text-[15px] text-fg">Rede</dt><dd className="text-muted">{networkLabel[w.network]}</dd></div>
                    <div className="md:col-span-3"><dt className="text-[15px] text-fg">Endereço da carteira</dt><dd className="break-all font-mono text-xs text-muted">{w.address}</dd></div>
                  </dl>
                ) : (
                  <p className="text-sm text-muted">Você ainda não adicionou uma {name}.</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </AccountLayout>
  )
}
