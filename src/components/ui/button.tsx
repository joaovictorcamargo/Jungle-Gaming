import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-bold transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary text-bg hover:bg-primary-hover',
        outline: 'border border-primary bg-transparent font-medium text-primary-soft hover:bg-primary/10',
        ghost: 'font-medium text-fg hover:bg-surface-2',
        link: 'h-auto px-0 font-medium text-primary-soft hover:underline',
        danger: 'border border-danger/60 font-medium text-danger hover:bg-danger-bg',
      },
      size: { default: 'h-10 px-6', sm: 'h-9 px-4', lg: 'h-[45px] px-6 text-[15px]', icon: 'h-10 w-10' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
Button.displayName = 'Button'
