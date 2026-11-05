import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Skeleton com shimmer (animação desligada com prefers-reduced-motion). Dimensões vêm do chamador para evitar CLS. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('skeleton', className)} {...props} />
}
