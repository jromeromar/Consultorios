import { formatValue } from '@/lib/benchmark/format'
import type { FunnelStep } from '@/lib/benchmark/scoring'

/** Rampa ordinal de un solo tono (azul 250→550), validada para etapas ordenadas. */
const RAMPA = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab']

export function FunnelBars({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1)

  return (
    <figure className="m-0">
      <ul className="space-y-3">
        {steps.map((step, index) => {
          const previous = index === 0 ? null : steps[index - 1].value
          const retention = previous && previous > 0 ? (step.value / previous) * 100 : null
          return (
            <li key={step.label}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-[13px] text-[var(--color-ink)]">{step.label}</span>
                <span className="tabular text-[13px] font-semibold text-[var(--color-ink)]">
                  {formatValue(Math.round(step.value), 'count')}
                  {retention !== null ? (
                    <span className="ml-2 text-[12px] font-normal text-[var(--color-muted)]">
                      {Math.round(retention)} % del paso anterior
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="h-2.5 rounded bg-[var(--color-surface-2)]">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${Math.max(1.5, (step.value / max) * 100)}%`,
                    background: RAMPA[Math.min(index, RAMPA.length - 1)],
                  }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      <figcaption className="mt-3 text-[12px] leading-relaxed text-[var(--color-muted)]">
        Embudo mensual reconstruido con tus propias respuestas: contactos × conversión a cita ×
        asistencia × cierre.
      </figcaption>
    </figure>
  )
}
