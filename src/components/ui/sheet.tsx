import * as Dialog from '@radix-ui/react-dialog'
import { useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  side?: 'left' | 'right' | 'center'
  children: ReactNode
}

/** Dialog/Drawer acessível (Radix): trava o foco, fecha com Esc e devolve o foco ao gatilho. */
export function Sheet({ open, onOpenChange, title, description, side = 'right', children }: SheetProps) {
  const opener = useRef<HTMLElement | null>(null)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content
          // Guarda o elemento que abriu o diálogo e devolve o foco a ele ao fechar.
          onOpenAutoFocus={() => { opener.current = document.activeElement as HTMLElement | null }}
          onCloseAutoFocus={(e) => { e.preventDefault(); opener.current?.focus() }}
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed z-50 flex flex-col gap-4 border-line bg-surface p-6 shadow-2xl',
            side === 'center' ? 'left-1/2 top-1/2 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border' : 'inset-y-0 w-[min(88vw,22rem)]',
            side === 'right' && 'right-0 border-l', side === 'left' && 'left-0 border-r',
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close className="rounded-full p-2 hover:bg-surface-2" aria-label="Fechar"><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
