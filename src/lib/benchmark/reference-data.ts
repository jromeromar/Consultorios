/**
 * Distribuciones de referencia del benchmark.
 *
 * ⚠️  DATOS SINTÉTICOS DE DEMOSTRACIÓN.
 * Son cifras plausibles construidas para que la plataforma funcione de punta a
 * punta antes de tener muestra de campo. NO son un estudio y la interfaz lo
 * declara en todas las vistas. Al llegar la primera muestra real, se sustituye
 * este archivo (o se carga `benchmark_stats` desde el proceso de captura) y nada
 * más cambia: el resto del sistema solo lee percentiles.
 */

import { KPIS } from './kpis'
import { SEGMENTS, SPECIALTIES } from './taxonomy'

export const NOTA_FUENTE_DEMO =
  'Datos sintéticos de demostración: cifras plausibles, no una muestra de campo.'

type Percentiles = [p10: number, p25: number, p50: number, p75: number, p90: number]

/**
 * Base del sector: ortodoncia, clínica pequeña, Colombia, pesos colombianos.
 * Todas las series están ordenadas de menor a mayor valor (no de peor a mejor):
 * la dirección la resuelve el KPI.
 */
const BASE: Record<string, Percentiles> = {
  'tasa-cierre': [25, 35, 45, 58, 70],
  'ticket-promedio': [1_500_000, 2_600_000, 4_200_000, 7_000_000, 11_000_000],
  'lead-a-cita': [18, 28, 38, 50, 62],
  'no-show': [4, 8, 14, 22, 32],
  'leads-mes': [15, 32, 60, 110, 190],
  'costo-por-lead': [8_000, 16_000, 28_000, 48_000, 80_000],
  cac: [150_000, 280_000, 480_000, 850_000, 1_500_000],
  'tiempo-respuesta': [3, 9, 35, 180, 1_440],
  'precio-ancla': [2_200_000, 3_200_000, 4_500_000, 6_500_000, 9_500_000],
  'margen-bruto': [38, 48, 57, 66, 74],
  'descuento-promedio': [2, 5, 10, 17, 26],
  'ocupacion-agenda': [42, 55, 68, 79, 88],
  'ingreso-por-unidad': [7_000_000, 14_000_000, 24_000_000, 40_000_000, 65_000_000],
  'tasa-retorno': [8, 16, 26, 38, 52],
}

/** `money` escala importes; `volume` escala contactos por mes. */
const SPECIALTY_FACTOR: Record<string, { money: number; volume: number }> = {
  ortodoncia: { money: 1, volume: 1 },
  'odontologia-estetica': { money: 1.55, volume: 0.8 },
  'odontologia-general': { money: 0.75, volume: 1.25 },
  'medicina-estetica': { money: 0.85, volume: 1.4 },
  'medicina-especialidad': { money: 0.55, volume: 1.1 },
  'nutricion-bienestar': { money: 0.35, volume: 1.5 },
}

/** `shift` = puntos porcentuales que gana el segmento por sistematización. */
const SEGMENT_FACTOR: Record<string, { money: number; volume: number; shift: number; n: number }> = {
  all: { money: 1, volume: 1.1, shift: 0, n: 1 },
  solo: { money: 0.85, volume: 0.55, shift: -3, n: 0.52 },
  'clinica-pequena': { money: 1, volume: 1, shift: 0, n: 0.33 },
  'clinica-multiple': { money: 1.2, volume: 2.4, shift: 4, n: 0.15 },
}

const MONEY_KPIS = new Set([
  'ticket-promedio',
  'costo-por-lead',
  'cac',
  'precio-ancla',
  'ingreso-por-unidad',
])
const VOLUME_KPIS = new Set(['leads-mes'])
/** Porcentajes que suben con la madurez del consultorio. */
const SHIFT_UP_KPIS = new Set([
  'tasa-cierre',
  'lead-a-cita',
  'margen-bruto',
  'ocupacion-agenda',
  'tasa-retorno',
])
/** Porcentajes que bajan con la madurez. */
const SHIFT_DOWN_KPIS = new Set(['no-show', 'descuento-promedio'])

const MUESTRA_BASE_POR_ESPECIALIDAD = 240

function round(kpiSlug: string, value: number): number {
  if (MONEY_KPIS.has(kpiSlug)) {
    // Tres cifras significativas: funciona igual en pesos colombianos que en
    // cualquier otra moneda a la que se lleve el benchmark.
    if (value === 0) return 0
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(value))) - 2)
    return Math.round(value / magnitude) * magnitude
  }
  if (kpiSlug === 'tiempo-respuesta') return Math.max(1, Math.round(value))
  if (VOLUME_KPIS.has(kpiSlug)) return Math.max(1, Math.round(value))
  return Math.round(Math.min(99, Math.max(1, value)) * 10) / 10
}

export type BenchmarkRow = {
  kpiSlug: string
  specialtySlug: string
  segmentSlug: string
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  sampleSize: number
  sourceNote: string
}

/** Deriva una celda del benchmark a partir de la base y los factores. */
export function derivePercentiles(
  kpiSlug: string,
  specialtySlug: string,
  segmentSlug: string,
): Percentiles {
  const base = BASE[kpiSlug]
  if (!base) throw new Error(`Sin base de referencia para el KPI ${kpiSlug}`)
  const specialty = SPECIALTY_FACTOR[specialtySlug]
  if (!specialty) throw new Error(`Sin factor para la especialidad ${specialtySlug}`)
  const segment = SEGMENT_FACTOR[segmentSlug]
  if (!segment) throw new Error(`Sin factor para el segmento ${segmentSlug}`)

  return base.map((value) => {
    let out = value
    if (MONEY_KPIS.has(kpiSlug)) out *= specialty.money * segment.money
    if (VOLUME_KPIS.has(kpiSlug)) out *= specialty.volume * segment.volume
    if (kpiSlug === 'ingreso-por-unidad') out *= Math.pow(specialty.volume, 0.3)
    if (SHIFT_UP_KPIS.has(kpiSlug)) out += segment.shift
    if (SHIFT_DOWN_KPIS.has(kpiSlug)) out -= segment.shift
    if (kpiSlug === 'tiempo-respuesta') out *= 1 - segment.shift * 0.04
    return round(kpiSlug, out)
  }) as Percentiles
}

/** Todas las celdas del benchmark: especialidad × segmento (+ 'all') × KPI. */
export function buildBenchmarkRows(): BenchmarkRow[] {
  const rows: BenchmarkRow[] = []
  const segments = ['all', ...SEGMENTS.map((s) => s.slug)]

  for (const specialty of SPECIALTIES) {
    for (const segmentSlug of segments) {
      const segment = SEGMENT_FACTOR[segmentSlug]
      for (const kpi of KPIS) {
        const [p10, p25, p50, p75, p90] = derivePercentiles(
          kpi.slug,
          specialty.slug,
          segmentSlug,
        )
        rows.push({
          kpiSlug: kpi.slug,
          specialtySlug: specialty.slug,
          segmentSlug,
          p10,
          p25,
          p50,
          p75,
          p90,
          sampleSize: Math.round(MUESTRA_BASE_POR_ESPECIALIDAD * segment.n),
          sourceNote: NOTA_FUENTE_DEMO,
        })
      }
    }
  }

  return rows
}
