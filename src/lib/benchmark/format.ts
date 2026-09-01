import type { Unit } from './kpis'

export const LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? 'es-CO'
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? 'COP'

export function formatValue(value: number | null, unit: Unit): string {
  if (value === null || !Number.isFinite(value)) return '—'

  switch (unit) {
    case 'currency':
      return new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency: CURRENCY,
        maximumFractionDigits: 0,
      }).format(value)
    case 'percent':
      return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(value)} %`
    case 'count':
      return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(value)
    case 'minutes':
      return formatMinutes(value)
  }
}

export function formatMinutes(value: number): string {
  if (value < 60) return `${Math.round(value)} min`
  if (value < 1440) {
    const hours = value / 60
    return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(hours)} h`
  }
  const days = value / 1440
  const texto = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(days)
  return `${texto} ${texto === '1' ? 'día' : 'días'}`
}

export function formatCurrency(value: number): string {
  return formatValue(value, 'currency')
}

export function formatDelta(value: number, unit: Unit): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${formatValue(Math.abs(value), unit)}`
}

/** "percentil 62" -> texto corto para etiquetas. */
export function formatPercentile(percentile: number | null): string {
  return percentile === null ? '—' : `p${Math.round(percentile)}`
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long' }).format(date)
}
