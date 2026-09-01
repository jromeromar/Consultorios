import 'server-only'

import { and, eq } from 'drizzle-orm'

import { getDb } from '@/lib/db'
import { benchmarkStats } from '@/lib/db/schema'
import type { Distribution } from './scoring'
import { PAIS_DEFAULT, PERIOD_ACTUAL } from './taxonomy'

function toDistribution(row: typeof benchmarkStats.$inferSelect): Distribution {
  return {
    kpiSlug: row.kpiSlug,
    p10: Number(row.p10),
    p25: Number(row.p25),
    p50: Number(row.p50),
    p75: Number(row.p75),
    p90: Number(row.p90),
    sampleSize: row.sampleSize,
    sourceNote: row.sourceNote,
  }
}

export type DistributionQuery = {
  specialtySlug: string
  segmentSlug?: string
  period?: string
  country?: string
}

/**
 * Distribuciones de una especialidad. Si el segmento pedido no tiene celda
 * (muestra insuficiente), cae al agregado 'all' de la especialidad.
 */
export async function getDistributions(query: DistributionQuery): Promise<Distribution[]> {
  const db = await getDb()
  const period = query.period ?? PERIOD_ACTUAL
  const country = query.country ?? PAIS_DEFAULT

  const load = (segmentSlug: string) =>
    db
      .select()
      .from(benchmarkStats)
      .where(
        and(
          eq(benchmarkStats.specialtySlug, query.specialtySlug),
          eq(benchmarkStats.segmentSlug, segmentSlug),
          eq(benchmarkStats.period, period),
          eq(benchmarkStats.country, country),
        ),
      )

  if (query.segmentSlug && query.segmentSlug !== 'all') {
    const rows = await load(query.segmentSlug)
    if (rows.length > 0) return rows.map(toDistribution)
  }

  const rows = await load('all')
  return rows.map(toDistribution)
}

/** Un KPI a través de todas las especialidades, para la vista comparativa. */
export async function getKpiAcrossSpecialties(
  kpiSlug: string,
  options: { period?: string; country?: string } = {},
): Promise<{ specialtySlug: string; distribution: Distribution }[]> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(benchmarkStats)
    .where(
      and(
        eq(benchmarkStats.kpiSlug, kpiSlug),
        eq(benchmarkStats.segmentSlug, 'all'),
        eq(benchmarkStats.period, options.period ?? PERIOD_ACTUAL),
        eq(benchmarkStats.country, options.country ?? PAIS_DEFAULT),
      ),
    )

  return rows.map((row) => ({
    specialtySlug: row.specialtySlug,
    distribution: toDistribution(row),
  }))
}

export async function benchmarkIsSeeded(): Promise<boolean> {
  const db = await getDb()
  const rows = await db.select({ id: benchmarkStats.id }).from(benchmarkStats).limit(1)
  return rows.length > 0
}
