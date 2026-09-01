import { OBJETIVO_PERCENTIL } from '@/lib/benchmark/scoring'

export type ScoreBar = { label: string; score: number | null; note?: string }

/**
 * Puntajes por bloque. Una sola serie, un solo color: la longitud ya codifica
 * la magnitud, así que el color no vuelve a decirlo. La línea vertical es el
 * objetivo de referencia (percentil 75 del sector).
 */
export function ScoreBars({ bars }: { bars: ScoreBar[] }) {
  return (
    <figure className="m-0">
      <ul className="space-y-4">
        {bars.map((bar) => (
          <li key={bar.label}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[13px] font-medium text-[var(--color-ink)]">{bar.label}</span>
              <span className="tabular text-[13px] font-semibold text-[var(--color-ink)]">
                {bar.score === null ? (
                  <span className="text-[12px] font-normal text-[var(--color-muted)]">
                    Sin datos suficientes
                  </span>
                ) : (
                  Math.round(bar.score)
                )}
              </span>
            </div>
            <div className="relative h-2.5 rounded bg-[var(--color-surface-2)]">
              {bar.score !== null ? (
                <div
                  className="absolute inset-y-0 left-0 rounded bg-[var(--color-series-1)]"
                  style={{ width: `${Math.min(100, Math.max(1.5, bar.score))}%` }}
                />
              ) : null}
              <div
                className="absolute inset-y-[-3px] w-0.5 rounded-sm bg-[var(--color-axis)]"
                style={{ left: `${OBJETIVO_PERCENTIL}%` }}
                aria-hidden
              />
            </div>
            {bar.note ? (
              <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-ink-2)]">
                {bar.note}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <figcaption className="mt-4 flex items-center gap-2 text-[12px] text-[var(--color-muted)]">
        <span className="h-3 w-0.5 rounded-sm bg-[var(--color-axis)]" aria-hidden />
        Objetivo: percentil {OBJETIVO_PERCENTIL} del sector
      </figcaption>
    </figure>
  )
}
