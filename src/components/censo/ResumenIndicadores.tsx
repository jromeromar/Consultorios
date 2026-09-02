import { TableView } from '@/components/charts/TableView'
import type { ResumenIndicador } from '@/lib/censo/queries'

/**
 * Los indicadores de un bloque. Un booleano se lee como porcentaje del universo;
 * un numérico, como cuartiles en sus propias unidades. Y siempre se dice cuántos
 * quedaron sin medir, porque eso también es un resultado.
 */
export function ResumenIndicadores({ resumenes }: { resumenes: ResumenIndicador[] }) {
  return (
    <div>
      <ul className="space-y-4">
        {resumenes.map((r) => (
          <li key={r.indicador.slug}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[13px] font-medium text-[var(--color-ink)]">
                {r.indicador.nombre}
              </span>
              <span className="tabular text-[12px] text-[var(--color-ink-2)]">
                {r.pctBueno !== null ? (
                  <>
                    <span className="font-semibold">{Math.round(r.pctBueno)} %</span> del censo
                  </>
                ) : r.cuartiles ? (
                  <>
                    mediana <span className="font-semibold">{formatoCrudo(r)}</span>
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>

            {r.pctBueno !== null ? (
              <div className="h-2 rounded bg-[var(--color-surface-2)]">
                <div
                  className="h-full rounded bg-[var(--color-series-1)]"
                  style={{ width: `${Math.max(1, r.pctBueno)}%` }}
                />
              </div>
            ) : null}

            <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">
              {r.indicador.origen} · n = {r.n}
              {r.noMedidos > 0 ? ` · ${r.noMedidos} sin medir` : ''}
            </p>
          </li>
        ))}
      </ul>

      <TableView
        caption="Indicadores del bloque"
        headers={['Indicador', 'n', 'Sin medir', '% del censo', 'Mediana', 'Puntaje mediano']}
        rows={resumenes.map((r) => [
          r.indicador.nombre,
          r.n,
          r.noMedidos,
          r.pctBueno === null ? '—' : `${Math.round(r.pctBueno)} %`,
          r.cuartiles ? formatoCrudo(r) : '—',
          Math.round(r.puntajeP50),
        ])}
      />
    </div>
  )
}

function formatoCrudo(r: ResumenIndicador): string {
  if (!r.cuartiles) return '—'
  const v = r.cuartiles.p50
  const slug = r.indicador.slug
  if (slug === 'minutos_primera_respuesta') {
    return v < 60 ? `${Math.round(v)} min` : `${(v / 60).toFixed(1)} h`
  }
  if (slug === 'recencia_resena') return `${Math.round(v)} días`
  if (slug === 'calificacion') return v.toFixed(1)
  if (slug.endsWith('_pct')) return `${v.toFixed(1)} %`
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(v)
}
