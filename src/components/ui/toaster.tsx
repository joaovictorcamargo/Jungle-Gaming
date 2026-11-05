import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'info' | 'success' | 'error'
interface Toast { id: number; message: string; tone: Tone }
let toasts: Toast[] = []
let n = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach((s) => s())

export function toast(message: string, tone: Tone = 'info', ms = 6000) {
  const id = ++n
  toasts = [...toasts, { id, message, tone }].slice(-4)
  emit()
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit() }, ms)
}

const tones: Record<Tone, string> = {
  info: 'border-primary-soft/50', success: 'border-success/60', error: 'border-danger/70',
}

/** Região ao vivo: erros são anunciados como alerta; demais como status. */
export function Toaster() {
  const list = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => toasts, () => toasts)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] mx-auto flex w-full max-w-md flex-col gap-2 px-4">
      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        {list.filter((t) => t.tone !== 'error').map((t) => (
          <p key={t.id} className={cn('pointer-events-auto rounded-xl border bg-surface-2 px-4 py-3 text-sm shadow-xl', tones[t.tone])}>{t.message}</p>
        ))}
      </div>
      <div role="alert" className="flex flex-col gap-2">
        {list.filter((t) => t.tone === 'error').map((t) => (
          <p key={t.id} className={cn('pointer-events-auto rounded-xl border bg-danger-bg px-4 py-3 text-sm text-danger shadow-xl', tones.error)}>{t.message}</p>
        ))}
      </div>
    </div>
  )
}
