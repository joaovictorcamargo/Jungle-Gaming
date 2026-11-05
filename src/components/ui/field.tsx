import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const control = 'w-full rounded-[3px] border bg-transparent px-3 text-sm text-fg placeholder:text-[#b39463] focus:border-primary disabled:opacity-60'

interface FieldShellProps { label: string; error?: string; hint?: string; children: (p: { id: string; describedBy?: string; invalid: boolean }) => ReactNode; className?: string; mark?: boolean; hideLabel?: boolean }

/** Label + controle + mensagem de erro/ajuda associados (aria-describedby, aria-invalid). */
export function Field({ label, error, hint, children, className, mark, hideLabel }: FieldShellProps) {
  const id = useId()
  const errId = `${id}-err`
  const hintId = `${id}-hint`
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className={cn('flex items-center gap-0.5', hideLabel && 'sr-only')}>
        <label htmlFor={id} className="text-[15px] text-fg">{label}</label>
        {mark && <span aria-hidden="true" className="text-[22px] leading-none text-danger">*</span>}
      </div>
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && <p id={hintId} className="text-xs text-muted">{hint}</p>}
      {error && <p id={errId} className="flex items-center gap-1 text-xs font-medium text-danger"><span aria-hidden="true">⚠</span>{error}</p>}
    </div>
  )
}

type Extra = { label: string; error?: string; hint?: string; wrapperClassName?: string; mark?: boolean; hideLabel?: boolean; endAdornment?: ReactNode }
type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & Extra
export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(({ label, error, hint, wrapperClassName, className, mark, hideLabel, endAdornment, ...props }, ref) => (
  <Field label={label} error={error} hint={hint} className={wrapperClassName} mark={mark} hideLabel={hideLabel}>
    {({ id, describedBy, invalid }) => (
      <div className="relative">
        <input ref={ref} id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={cn(control, 'h-10', endAdornment && 'pr-11', invalid ? 'border-danger' : 'border-line', className)} {...props} />
        {endAdornment && <div className="absolute inset-y-0 right-1 flex items-center">{endAdornment}</div>}
      </div>
    )}
  </Field>
))
InputField.displayName = 'InputField'

type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string; wrapperClassName?: string }
export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(({ label, error, hint, className, wrapperClassName, ...props }, ref) => (
  <Field label={label} error={error} hint={hint} className={wrapperClassName}>
    {({ id, describedBy, invalid }) => (
      <textarea ref={ref} id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={cn(control, 'min-h-[152px] py-3', invalid ? 'border-danger' : 'border-line', className)} {...props} />
    )}
  </Field>
))
TextareaField.displayName = 'TextareaField'

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & Omit<Extra, 'endAdornment'>
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(({ label, error, hint, wrapperClassName, className, children, mark, hideLabel, ...props }, ref) => (
  <Field label={label} error={error} hint={hint} className={wrapperClassName} mark={mark} hideLabel={hideLabel}>
    {({ id, describedBy, invalid }) => (
      <select ref={ref} id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={cn(control, 'h-10 bg-bg', invalid ? 'border-danger' : 'border-line', className)} {...props}>{children}</select>
    )}
  </Field>
))
SelectField.displayName = 'SelectField'

/** Botão de mostrar/ocultar senha para usar como `endAdornment` (o nome acessível evita colidir com o rótulo do campo). */
export function RevealToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-pressed={shown} aria-label={shown ? 'Ocultar caracteres' : 'Exibir caracteres'} onClick={onToggle} className="grid h-8 w-8 cursor-pointer place-items-center rounded text-[#b39463] hover:text-fg">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{!shown && <path d="M4 4l16 16" />}</svg>
    </button>
  )
}
