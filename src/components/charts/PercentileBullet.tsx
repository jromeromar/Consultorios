import { formatValue } from '@/lib/benchmark/format'
import type { Direction, Unit } from '@/lib/benchmark/kpis'
import type { Distribution } from '@/lib/benchmark/scoring'
import { domainFor, positionPct, type ScaleKind } from './scale'

type Props = {
  label: string
  unit: Unit
  direction: Direction
  distribution: Distribution
  /**
   * Valor del profesional. `null` = respondió que no lo mide;
   * ausente = vista de sector, sin comparación individual.
   */
  value?: number | null
  /** Etiqueta de la marca del profesional. */
  valueLabel?: string
  /** Escala del eje; 'log' para distribuciones muy asimétricas. */
  scale?: ScaleKind
}

/**
 * Barra de percentiles: la banda gris es el rango intercuartil del sector
 * (p25–p75), la marca vertical es la mediana y el punto azul es el profesional.
 * Todos los valores van rotulados: la gráfica no depende del hover para leerse.
 */
export function PercentileBullet({
  label,
  unit,
  direction,
  distribution,
  value,
  valueLabel = 'Tú',
  scale = 'linear',
}: Props) {
  const sectorOnly = value === undefined
  const own = value ?? null
  const [min, max] = domainFor(distribution.p10, distribution.p90, own, scale)
  const at = (v: number) => positionPct(v, min, max, scale)

  const bandLeft = at(distribution.p25)
  const bandRight = at(distribution.p75)
  const medianAt = at(distribution.p50)
  const valueAt = own === null ? null : at(own)

  const mejor = direction === 'higher_better' ? 'derecha' : 'izquierda'

  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[13px] font-medium text-[var(--color-ink)]">{label}</span>
        <span className="tabular text-[12px] text-[var(--color-ink-2)]">
          {sectorOnly ? (
            <>
              <span className="text-[var(--color-muted)]">mitad central </span>
              {formatValue(distribution.p25, unit)} – {formatValue(distribution.p75, unit)}
              <span className="text-[var(--color-muted)]"> · mediana </span>
              <span className="font-semibold">{formatValue(distribution.p50, unit)}</span>
            </>
          ) : own === null ? (
            <span className="text-[var(--color-muted)]">No lo mide</span>
          ) : (
            <>
              <span className="font-semibold text-[var(--color-series-1)]">
                {formatValue(own, unit)}
              </span>
              <span className="text-[var(--color-muted)]"> · mediana del sector </span>
              {formatValue(distribution.p50, unit)}
            </>
          )}
        </span>
      </figcaption>

      <div className="relative h-6">
        {/* riel p10–p90 */}
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded bg-[var(--color-surface-2)]" />
        {/* rango intercuartil */}
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded bg-[#d8d7d0]"
          style={{ left: `${bandLeft}%`, width: `${Math.max(bandRight - bandLeft, 0.6)}%` }}
        />
        {/* mediana */}
        <div
          className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[var(--color-ink-2)]"
          style={{ left: `${medianAt}%` }}
          aria-hidden
        />
        {valueAt !== null ? (
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-series-1)] ring-2 ring-[var(--color-surface)]"
            style={{ left: `${valueAt}%` }}
            title={`${valueLabel}: ${formatValue(own, unit)}`}
          />
        ) : null}
      </div>

      <div className="tabular mt-1 flex items-baseline justify-between text-[11px] text-[var(--color-muted)]">
        <span>{formatValue(distribution.p10, unit)}</span>
        <span className="text-[10px] uppercase tracking-[0.08em]">
          mejor hacia la {mejor} · n={distribution.sampleSize}
          {scale === 'log' ? ' · escala log' : ''}
        </span>
        <span>{formatValue(distribution.p90, unit)}</span>
      </div>
    </figure>
  )
}

/** Leyenda única para un grupo de barras de percentiles. */
export function PercentileLegend({ showValue = true }: { showValue?: boolean }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[var(--color-ink-2)]">
      {showValue ? (
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-[var(--color-series-1)]" aria-hidden />
          Tu consultorio
        </li>
      ) : null}
      <li className="flex items-center gap-2">
        <span className="h-3.5 w-0.5 rounded-sm bg-[var(--color-ink-2)]" aria-hidden />
        Mediana del sector
      </li>
      <li className="flex items-center gap-2">
        <span className="h-1.5 w-6 rounded bg-[#d8d7d0]" aria-hidden />
        Mitad central del sector (p25–p75)
      </li>
      <li className="flex items-center gap-2">
        <span className="h-1.5 w-6 rounded bg-[var(--color-surface-2)]" aria-hidden />
        Rango p10–p90
      </li>
    </ul>
  )
}
