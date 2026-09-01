'use client'

import { useActionState } from 'react'

import { entrar, type FormState } from '@/lib/auth/actions'

export function LoginForm({ siguiente }: { siguiente: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(entrar, null)

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="siguiente" value={siguiente} />
      <label className="block text-[13px]">
        <span className="font-medium text-[var(--color-ink)]">Correo</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-[var(--color-axis)] bg-[var(--color-surface)] px-3 py-2 text-[14px]"
        />
      </label>
      <label className="block text-[13px]">
        <span className="font-medium text-[var(--color-ink)]">Contraseña</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-[var(--color-axis)] bg-[var(--color-surface)] px-3 py-2 text-[14px]"
        />
      </label>

      {state?.error ? (
        <p role="alert" className="text-[13px] text-[var(--color-critical)]">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--color-brand)] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[var(--color-accent)] disabled:opacity-60"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
