import { useState } from 'react'
import { isApiError } from '@/api/client'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export type FieldErrors = Record<string, string>

export function passwordIssue(p: string): string | undefined {
  if (p.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'A senha deve conter letras e números.'
  return undefined
}

/** Estado de formulário com erros locais + erros devolvidos pela API (fieldErrors) associados aos campos. */
export function useFormErrors() {
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  return {
    errors, formError,
    clear: () => { setErrors({}); setFormError(null) },
    setLocal: (e: FieldErrors) => { setErrors(e); setFormError(null); return Object.keys(e).length === 0 },
    fromApi: (err: unknown, fallback = 'Não foi possível concluir a operação. Tente novamente.') => {
      if (isApiError(err)) { setErrors(err.fieldErrors); setFormError(Object.keys(err.fieldErrors).length ? null : err.message) }
      else setFormError(fallback)
    },
  }
}
