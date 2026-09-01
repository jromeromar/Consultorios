'use client'

import { useActionState } from 'react'

import { registrarse, type FormState } from '@/lib/auth/actions'
import { SEGMENTS, SPECIALTIES } from '@/lib/benchmark/taxonomy'

type Props = {
  siguiente: string
  correo?: string
  especialidad?: string
  segmento?: string
}

export function RegisterForm({ siguiente, correo, especialidad, segmento }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(registrarse, null)

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="siguiente" value={siguiente} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" name="name" required autoComplete="name" />
        <Field
          label="Correo"
          name="email"
          type="email"
          defaultValue={correo}
          required
          autoComplete="email"
        />
        <Field
          label="Contraseña"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          hint="Mínimo 8 caracteres."
        />
        <Field label="Consultorio o clínica" name="clinicName" autoComplete="organization" />
      </div>

      <label className="block text-[13px]">
        <span className="font-medium text-[var(--color-ink)]">Especialidad principal</span>
        <select
          name="specialtySlug"
          defaultValue={especialidad ?? ''}
          required
          className="mt-1 w-full rounded-md border border-[var(--color-axis)] bg-[var(--color-surface)] px-3 py-2 text-[14px]"
        >
          <option value="" disabled>
            Selecciona una opción
          </option>
          {SPECIALTIES.map((specialty) => (
            <option key={specialty.slug} value={specialty.slug}>
              {specialty.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-[13px]">
        <span className="font-medium text-[var(--color-ink)]">Tamaño</span>
        <select
          name="segmentSlug"
          defaultValue={segmento ?? ''}
          required
          className="mt-1 w-full rounded-md border border-[var(--color-axis)] bg-[var(--color-surface)] px-3 py-2 text-[14px]"
        >
          <option value="" disabled>
            Selecciona una opción
          </option>
          {SEGMENTS.map((segment) => (
            <option key={segment.slug} value={segment.slug}>
              {segment.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ciudad (opcional)" name="city" autoComplete="address-level2" />
        <Field label="Teléfono (opcional)" name="phone" autoComplete="tel" />
      </div>

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
        {pending ? 'Creando la cuenta…' : 'Crear mi cuenta'}
      </button>
    </form>
  )
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
  autoComplete,
  hint,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  required?: boolean
  autoComplete?: string
  hint?: string
}) {
  return (
    <label className="block text-[13px]">
      <span className="font-medium text-[var(--color-ink)]">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        className="mt-1 w-full rounded-md border border-[var(--color-axis)] bg-[var(--color-surface)] px-3 py-2 text-[14px]"
      />
      {hint ? <span className="mt-1 block text-[11px] text-[var(--color-muted)]">{hint}</span> : null}
    </label>
  )
}
