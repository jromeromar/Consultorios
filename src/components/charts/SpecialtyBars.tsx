import { formatValue } from '@/lib/benchmark/format'
import type { Unit } from '@/lib/benchmark/kpis'

export type SpecialtyBar = {
  slug: string
  label: string
  median: number
  p25: number
  p75: number
}

/**
 * Un KPI a través de las especialidades. Una serie, un color; la especialidad
 * destacada se marca por peso de texto y una banda de fondo, nunca cambiando
 * el color de las demás.
 */
export function SpecialtyBars({
  bars,
  unit,
  highlight,
}: {
  bars: SpecialtyBar[]
  unit: Unit
  highlight?: string
}) {
  const max = Math.max(...bars.map((b) => b.p75), 1)

  return (
    <figure className="m-0">
      <ul className="space-y-2.5">
        {bars.map((bar) => {
          const active = bar.slug === highlight
          return (
            <li
              key={bar.slug}
              className={`rounded-md px-2 py-1.5 ${active ? 'bg-[var(--color-accent-soft)]/45' : ''}`}
            >
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
                <span
                  className={`text-[13px] ${active ? 'font-semibold text-[var(--color-ink)]' : 'text-[var(--color-ink-2)]'}`}
                >
                  {bar.label}
                  {active ? (
                    <span className="ml-2 text-[11px] font-normal uppercase tracking-[0.08em] text-[var(--color-accent)]">
                      tu especialidad
                    </span>
                  ) : null}
                </span>
                <span className="tabular text-[13px] text-[var(--color-ink)]">
                  {formatValue(bar.median, unit)}
                </span>
              </div>
              <div className="relative h-2.5 rounded bg-[var(--color-surface-2)]">
                <div
                  className="absolute inset-y-0 rounded bg-[#d8d7d0]"
                  style={{
                    left: `${(bar.p25 / max) * 100}%`,
                    width: `${Math.max(0.8, ((bar.p75 - bar.p25) / max) * 100)}%`,
                  }}
                />
                <div
                  className="absolute inset-y-[-2px] w-0.5 -translate-x-1/2 rounded-sm bg-[var(--color-series-1)]"
                  style={{ left: `${(bar.median / max) * 100}%` }}
                  title={`Mediana: ${formatValue(bar.median, unit)}`}
                />
              </div>
            </li>
          )
        })}
      </ul>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[var(--color-ink-2)]">
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-0.5 rounded-sm bg-[var(--color-series-1)]" aria-hidden />
          Mediana
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-6 rounded bg-[#d8d7d0]" aria-hidden />
          Mitad central (p25–p75)
        </span>
      </figcaption>
    </figure>
  )
}
