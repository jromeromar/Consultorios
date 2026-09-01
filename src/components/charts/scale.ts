/** Utilidades de escala compartidas por las gráficas. */

export function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n))
}

export type ScaleKind = 'linear' | 'log'

/** log(1+x): admite el cero, que en varios KPIs es un valor legítimo. */
function project(value: number, kind: ScaleKind): number {
  return kind === 'log' ? Math.log1p(Math.max(0, value)) : value
}

/** Posición 0–100 de `value` dentro de [min, max]. */
export function positionPct(
  value: number,
  min: number,
  max: number,
  kind: ScaleKind = 'linear',
): number {
  const lo = project(min, kind)
  const hi = project(max, kind)
  const span = hi - lo
  if (span <= 0) return 50
  return clampPct(((project(value, kind) - lo) / span) * 100)
}

/**
 * Dominio del eje: cubre p10..p90 con aire, y se estira si el valor del
 * profesional cae fuera, para que su marca nunca quede pegada al borde.
 */
export function domainFor(
  p10: number,
  p90: number,
  value: number | null,
  kind: ScaleKind = 'linear',
): [number, number] {
  const lows = [p10]
  const highs = [p90]
  if (value !== null) {
    lows.push(value)
    highs.push(value)
  }
  const low = Math.min(...lows)
  const high = Math.max(...highs)
  if (kind === 'log') {
    // En escala logarítmica el aire se da como factor, no como suma.
    return [Math.max(0, low / 1.6), high * 1.6]
  }
  const pad = Math.max((high - low) * 0.12, high * 0.02, 0.5)
  return [Math.max(0, low - pad), high + pad]
}
