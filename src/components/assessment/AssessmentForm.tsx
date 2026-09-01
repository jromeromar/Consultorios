'use client'

import { useActionState, useMemo, useState } from 'react'

import { enviarAssessment, type EnviarState } from '@/lib/assessment/actions'
import { BLOCKS, KPIS, kpiQuestion, type Kpi } from '@/lib/benchmark/kpis'
import { PRACTICES, type Practice } from '@/lib/benchmark/practices'
import { SEGMENTS, SPECIALTIES, getSpecialty } from '@/lib/benchmark/taxonomy'

type Prefill = {
  leadName?: string
  leadEmail?: string
  clinicName?: string
  specialtySlug?: string
  segmentSlug?: string
  /** El usuario ya tiene sesión: no pedimos de nuevo los datos de contacto. */
  autenticado?: boolean
}

const UNIT_SUFFIX: Record<Kpi['unit'], string> = {
  currency: '$',
  percent: '%',
  count: 'al mes',
  minutes: 'minutos',
}

type Answers = Record<string, string>

export function AssessmentForm({ prefill = {} }: { prefill?: Prefill }) {
  const [state, formAction, pending] = useActionState<EnviarState, FormData>(
    enviarAssessment,
    null,
  )

  const [specialtySlug, setSpecialtySlug] = useState(prefill.specialtySlug ?? '')
  const [segmentSlug, setSegmentSlug] = useState(prefill.segmentSlug ?? '')
  const [answers, setAnswers] = useState<Answers>({})
  const [noMide, setNoMide] = useState<Record<string, boolean>>({})
  const [step, setStep] = useState(0)

  const anchor = getSpecialty(specialtySlug)?.anchor ?? 'tu tratamiento de mayor valor'

  const steps = useMemo(
    () => [
      { id: 'perfil', title: 'Tu consultorio' },
      ...BLOCKS.map((block) => ({ id: block.id, title: block.name })),
      { id: 'contacto', title: prefill.autenticado ? 'Confirmar y calcular' : 'Recibir el resultado' },
    ],
    [prefill.autenticado],
  )

  const respuestas = useMemo(() => {
    const payload: Record<string, string | number | null> = {}
    for (const [key, value] of Object.entries(answers)) {
      if (noMide[key] || value === '') continue
      payload[key] = value
    }
    return JSON.stringify(payload)
  }, [answers, noMide])

  const perfilListo = specialtySlug !== '' && segmentSlug !== ''
  const total = steps.length
  const progreso = Math.round((step / (total - 1)) * 100)

  const setAnswer = (slug: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [slug]: value }))

  const toggleNoMide = (slug: string) =>
    setNoMide((prev) => {
      const next = { ...prev, [slug]: !prev[slug] }
      if (next[slug]) setAnswers((a) => ({ ...a, [slug]: '' }))
      return next
    })

  const currentBlock = BLOCKS.find((b) => b.id === steps[step].id)
  const blockKpis = currentBlock ? KPIS.filter((k) => k.block === currentBlock.id) : []
  const blockPractices = currentBlock ? PRACTICES.filter((p) => p.block === currentBlock.id) : []

  const respondidas = Object.entries(answers).filter(
    ([slug, value]) => value !== '' && !noMide[slug],
  ).length

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="respuestas" value={respuestas} />
      <input type="hidden" name="specialtySlug" value={specialtySlug} />
      <input type="hidden" name="segmentSlug" value={segmentSlug} />

      <div>
        <div className="mb-2 flex items-baseline justify-between text-[12px] text-[var(--color-muted)]">
          <span>
            Paso {step + 1} de {total} · {steps[step].title}
          </span>
          <span className="tabular">{respondidas} respuestas</span>
        </div>
        <div className="h-1.5 rounded bg-[var(--color-surface-2)]">
          <div
            className="h-full rounded bg-[var(--color-series-1)] transition-[width]"
            style={{ width: `${Math.max(3, progreso)}%` }}
          />
        </div>
      </div>

      {steps[step].id === 'perfil' ? (
        <fieldset className="space-y-6">
          <legend className="sr-only">Tu consultorio</legend>

          <div>
            <label
              htmlFor="especialidad"
              className="block text-[14px] font-medium text-[var(--color-ink)]"
            >
              ¿Cuál es tu especialidad principal?
            </label>
            <p className="mt-1 text-[12px] text-[var(--color-ink-2)]">
              Define contra qué distribución del sector te comparamos.
            </p>
            <select
              id="especialidad"
              value={specialtySlug}
              onChange={(event) => setSpecialtySlug(event.target.value)}
              className="mt-2 w-full rounded-md border border-[var(--color-axis)] bg-[var(--color-surface)] px-3 py-2.5 text-[14px]"
            >
              <option value="">Selecciona una opción</option>
              {SPECIALTIES.map((specialty) => (
                <option key={specialty.slug} value={specialty.slug}>
                  {specialty.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-[14px] font-medium text-[var(--color-ink)]">
              ¿Cómo está organizado hoy?
            </span>
            <div className="mt-2 space-y-2">
              {SEGMENTS.map((segment) => (
                <label
                  key={segment.slug}
                  className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2.5 text-[13px] ${
                    segmentSlug === segment.slug
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/40'
                      : 'border-[var(--color-hair)] hover:border-[var(--color-axis)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="segmento-visible"
                    className="mt-0.5"
                    checked={segmentSlug === segment.slug}
                    onChange={() => setSegmentSlug(segment.slug)}
                  />
                  <span>
                    <span className="font-medium text-[var(--color-ink)]">{segment.name}</span>
                    <span className="block text-[var(--color-ink-2)]">{segment.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </fieldset>
      ) : null}

      {currentBlock ? (
        <fieldset className="space-y-7">
          <legend className="text-[13px] leading-relaxed text-[var(--color-ink-2)]">
            {currentBlock.claim}{' '}
            <span className="text-[var(--color-muted)]">
              Si no mides algo, márcalo: no saberlo también es un resultado.
            </span>
          </legend>

          {blockKpis.map((kpi) => (
            <div key={kpi.slug}>
              <label
                htmlFor={kpi.slug}
                className="block text-[14px] font-medium text-[var(--color-ink)]"
              >
                {kpiQuestion(kpi, anchor)}
              </label>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-ink-2)]">
                {kpi.help}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  {kpi.unit === 'currency' ? (
                    <span className="text-[14px] text-[var(--color-muted)]">$</span>
                  ) : null}
                  <input
                    id={kpi.slug}
                    type="number"
                    inputMode="decimal"
                    min={kpi.min}
                    max={kpi.max}
                    step="any"
                    disabled={Boolean(noMide[kpi.slug])}
                    value={answers[kpi.slug] ?? ''}
                    onChange={(event) => setAnswer(kpi.slug, event.target.value)}
                    className="tabular w-36 rounded-md border border-[var(--color-axis)] bg-[var(--color-surface)] px-3 py-2 text-[14px] disabled:bg-[var(--color-surface-2)] disabled:text-[var(--color-muted)]"
                  />
                  {kpi.unit !== 'currency' ? (
                    <span className="text-[12px] text-[var(--color-muted)]">
                      {UNIT_SUFFIX[kpi.unit]}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => toggleNoMide(kpi.slug)}
                  aria-pressed={Boolean(noMide[kpi.slug])}
                  className={`rounded-md border px-3 py-1.5 text-[12px] ${
                    noMide[kpi.slug]
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/50 text-[var(--color-accent)]'
                      : 'border-[var(--color-hair)] text-[var(--color-ink-2)] hover:border-[var(--color-axis)]'
                  }`}
                >
                  No lo mido
                </button>
              </div>
            </div>
          ))}

          {blockPractices.map((practice: Practice) => (
            <div key={practice.slug}>
              <span className="block text-[14px] font-medium text-[var(--color-ink)]">
                {practice.question}
              </span>
              <p className="mt-1 text-[12px] text-[var(--color-ink-2)]">{practice.help}</p>
              <div className="mt-2 space-y-1.5">
                {practice.options.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-[13px] ${
                      answers[practice.slug] === option.value
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/40'
                        : 'border-[var(--color-hair)] hover:border-[var(--color-axis)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`practica-${practice.slug}`}
                      className="mt-0.5"
                      checked={answers[practice.slug] === option.value}
                      onChange={() => setAnswer(practice.slug, option.value)}
                    />
                    <span className="text-[var(--color-ink)]">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      ) : null}

      {steps[step].id === 'contacto' ? (
        <fieldset className="space-y-4">
          <legend className="text-[13px] leading-relaxed text-[var(--color-ink-2)]">
            {prefill.autenticado
              ? 'Confirma los datos con los que quedará registrada esta auditoría.'
              : 'Guardamos tu auditoría con estos datos para que puedas volver a ella y para avisarte cuando se publique el siguiente periodo del benchmark.'}
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nombre"
              name="leadName"
              defaultValue={prefill.leadName}
              required
              autoComplete="name"
            />
            <Field
              label="Correo"
              name="leadEmail"
              type="email"
              defaultValue={prefill.leadEmail}
              required
              autoComplete="email"
            />
            <Field
              label="Consultorio o clínica"
              name="clinicName"
              defaultValue={prefill.clinicName}
              autoComplete="organization"
            />
            <Field label="Teléfono (opcional)" name="leadPhone" autoComplete="tel" />
          </div>

          <p className="text-[12px] leading-relaxed text-[var(--color-muted)]">
            No compartimos tus cifras con nadie. Entran al agregado del sector de forma anónima,
            que es lo que permite que el benchmark siga existiendo.
          </p>
        </fieldset>
      ) : null}

      {state?.error ? (
        <p
          role="alert"
          className="rounded-md border border-[var(--color-critical)] bg-[#fdf3f3] px-3 py-2 text-[13px] text-[var(--color-critical)]"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-hair)] pt-5">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-md border border-[var(--color-hair)] px-4 py-2 text-[13px] text-[var(--color-ink-2)] disabled:opacity-40"
        >
          Atrás
        </button>

        {step < total - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
            disabled={step === 0 && !perfilListo}
            className="rounded-md bg-[var(--color-brand)] px-5 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-accent)] disabled:opacity-40"
          >
            {step === 0 ? 'Empezar' : 'Siguiente'}
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending || !perfilListo}
            className="rounded-md bg-[var(--color-brand)] px-5 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-accent)] disabled:opacity-60"
          >
            {pending ? 'Calculando…' : 'Ver mi comparativa'}
          </button>
        )}
      </div>
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
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  required?: boolean
  autoComplete?: string
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
    </label>
  )
}
