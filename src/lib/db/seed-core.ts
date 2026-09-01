import { sql } from 'drizzle-orm'

import { buildBenchmarkRows } from '../benchmark/reference-data'
import { PAIS_DEFAULT, PERIOD_ACTUAL } from '../benchmark/taxonomy'
import { hashPassword } from '../auth/password'
import { benchmarkStats, users } from './schema'
import type { Db } from './connect'

/**
 * Carga (o actualiza) las celdas del benchmark. Idempotente.
 * Lo usan tanto `npm run db:seed` como el arranque del modo demostración.
 */
export async function seedBenchmark(db: Db): Promise<number> {
  const rows = buildBenchmarkRows().map((row) => ({
    kpiSlug: row.kpiSlug,
    specialtySlug: row.specialtySlug,
    segmentSlug: row.segmentSlug,
    period: PERIOD_ACTUAL,
    country: PAIS_DEFAULT,
    sampleSize: row.sampleSize,
    p10: String(row.p10),
    p25: String(row.p25),
    p50: String(row.p50),
    p75: String(row.p75),
    p90: String(row.p90),
    sourceNote: row.sourceNote,
  }))

  // Lotes pequeños: PGlite no agradece un INSERT de 300+ filas de una vez.
  for (let i = 0; i < rows.length; i += 60) {
    await db
      .insert(benchmarkStats)
      .values(rows.slice(i, i + 60))
      .onConflictDoUpdate({
        target: [
          benchmarkStats.kpiSlug,
          benchmarkStats.specialtySlug,
          benchmarkStats.segmentSlug,
          benchmarkStats.period,
          benchmarkStats.country,
        ],
        set: {
          sampleSize: sql`excluded.sample_size`,
          p10: sql`excluded.p10`,
          p25: sql`excluded.p25`,
          p50: sql`excluded.p50`,
          p75: sql`excluded.p75`,
          p90: sql`excluded.p90`,
          sourceNote: sql`excluded.source_note`,
          updatedAt: sql`now()`,
        },
      })
  }

  return rows.length
}

export const CUENTAS_DEMO = [
  {
    email: 'demo@consultorios.co',
    name: 'Dra. Ana Rivera',
    clinicName: 'Ortodoncia Rivera',
    specialtySlug: 'ortodoncia',
    segmentSlug: 'clinica-pequena',
    city: 'Medellín',
    role: 'pro',
  },
  {
    email: 'agencia@consultorios.co',
    name: 'Equipo de la agencia',
    clinicName: null,
    specialtySlug: 'ortodoncia',
    segmentSlug: 'clinica-multiple',
    city: 'Bogotá',
    role: 'admin',
  },
] as const

export const CONTRASENA_DEMO = 'consultorios123'

export async function seedDemoUsers(db: Db): Promise<void> {
  for (const user of CUENTAS_DEMO) {
    await db
      .insert(users)
      .values({ ...user, passwordHash: await hashPassword(CONTRASENA_DEMO) })
      .onConflictDoNothing({ target: users.email })
  }
}
