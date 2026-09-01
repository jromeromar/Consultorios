/**
 * Cálculo de las celdas del benchmark a partir de observaciones individuales.
 *
 * Una «celda» es la distribución de un KPI para una (especialidad, segmento,
 * periodo, país). El resto del sistema solo lee percentiles: este módulo es el
 * único lugar donde existen los datos fila por fila, y no se guardan.
 */

import { KPIS_BY_SLUG } from './kpis'
import type { BenchmarkRow } from './reference-data'

/**
 * Muestra mínima para publicar una celda.
 *
 * Por dos razones a la vez: con menos observaciones los percentiles no
 * significan nada, y con muy pocas un profesional podría deducir la cifra de un
 * competidor concreto. Las celdas por debajo del mínimo no se publican; la
 * consulta cae al agregado de la especialidad completa.
 */
export const MUESTRA_MINIMA = 12

export type Observacion = {
  /** Identificador de la fila de origen, solo para reportar errores. */
  origen: string
  specialtySlug: string
  segmentSlug: string
  period: string
  country: string
  /** Valores por KPI. Un KPI ausente o sin medir no aparece. */
  valores: Record<string, number>
}

export type CeldaOmitida = {
  specialtySlug: string
  segmentSlug: string
  period: string
  country: string
  kpiSlug: string
  n: number
}

export type ResultadoAgregacion = {
  filas: BenchmarkRow[]
  /** Celdas que no alcanzan MUESTRA_MINIMA y por eso no se publican. */
  omitidas: CeldaOmitida[]
  /** Observaciones por celda (especialidad × segmento), para el informe. */
  conteos: { clave: string; n: number }[]
}

/** Percentil por interpolación lineal (equivalente a PERCENTILE.INC de Excel). */
export function percentile(ordenados: number[], p: number): number {
  if (ordenados.length === 0) throw new Error('percentile() sobre una lista vacía')
  if (ordenados.length === 1) return ordenados[0]

  const idx = (p / 100) * (ordenados.length - 1)
  const bajo = Math.floor(idx)
  const alto = Math.ceil(idx)
  if (bajo === alto) return ordenados[bajo]
  return ordenados[bajo] + (idx - bajo) * (ordenados[alto] - ordenados[bajo])
}

/**
 * Agrega observaciones en celdas del benchmark.
 *
 * Además de cada segmento, produce el segmento `all` juntando todos los
 * segmentos de la especialidad: es el que se usa cuando el corte específico no
 * tiene muestra suficiente.
 */
export function agregarObservaciones(
  observaciones: Observacion[],
  sourceNote: string,
): ResultadoAgregacion {
  // clave -> kpiSlug -> valores
  const grupos = new Map<string, Map<string, number[]>>()
  const conteosPorClave = new Map<string, number>()

  const acumular = (
    specialtySlug: string,
    segmentSlug: string,
    period: string,
    country: string,
    valores: Record<string, number>,
  ) => {
    const clave = [specialtySlug, segmentSlug, period, country].join('|')
    const porKpi = grupos.get(clave) ?? new Map<string, number[]>()
    for (const [kpiSlug, valor] of Object.entries(valores)) {
      const lista = porKpi.get(kpiSlug) ?? []
      lista.push(valor)
      porKpi.set(kpiSlug, lista)
    }
    grupos.set(clave, porKpi)
    conteosPorClave.set(clave, (conteosPorClave.get(clave) ?? 0) + 1)
  }

  for (const obs of observaciones) {
    acumular(obs.specialtySlug, obs.segmentSlug, obs.period, obs.country, obs.valores)
    // El agregado 'all' de la especialidad junta todos los segmentos.
    acumular(obs.specialtySlug, 'all', obs.period, obs.country, obs.valores)
  }

  const filas: BenchmarkRow[] = []
  const omitidas: CeldaOmitida[] = []

  for (const [clave, porKpi] of grupos) {
    const [specialtySlug, segmentSlug, period, country] = clave.split('|')

    for (const [kpiSlug, valores] of porKpi) {
      const ordenados = [...valores].sort((a, b) => a - b)

      if (ordenados.length < MUESTRA_MINIMA) {
        omitidas.push({
          specialtySlug,
          segmentSlug,
          period,
          country,
          kpiSlug,
          n: ordenados.length,
        })
        continue
      }

      filas.push({
        kpiSlug,
        specialtySlug,
        segmentSlug,
        period,
        country,
        p10: redondear(kpiSlug, percentile(ordenados, 10)),
        p25: redondear(kpiSlug, percentile(ordenados, 25)),
        p50: redondear(kpiSlug, percentile(ordenados, 50)),
        p75: redondear(kpiSlug, percentile(ordenados, 75)),
        p90: redondear(kpiSlug, percentile(ordenados, 90)),
        sampleSize: ordenados.length,
        sourceNote,
      })
    }
  }

  return {
    filas,
    omitidas,
    conteos: [...conteosPorClave.entries()]
      .map(([clave, n]) => ({ clave, n }))
      .sort((a, b) => a.clave.localeCompare(b.clave)),
  }
}

/** Los importes no se publican al peso; los porcentajes con un decimal. */
function redondear(kpiSlug: string, valor: number): number {
  const kpi = KPIS_BY_SLUG[kpiSlug]
  if (kpi?.unit === 'currency') {
    if (valor === 0) return 0
    const magnitud = Math.pow(10, Math.floor(Math.log10(Math.abs(valor))) - 2)
    return Math.round(valor / magnitud) * magnitud
  }
  if (kpi?.unit === 'count' || kpi?.unit === 'minutes') return Math.round(valor)
  return Math.round(valor * 10) / 10
}
