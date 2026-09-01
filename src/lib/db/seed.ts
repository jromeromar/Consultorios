/**
 * Carga el benchmark de referencia y un par de cuentas de prueba.
 * Idempotente: se puede correr tantas veces como haga falta.
 *   npm run db:seed
 */
import { loadEnvFiles } from '../load-env'

loadEnvFiles()

import { sql } from 'drizzle-orm'

import { buildBenchmarkRows } from '../benchmark/reference-data'
import { PAIS_DEFAULT, PERIOD_ACTUAL } from '../benchmark/taxonomy'
import { connect } from './connect'
import { benchmarkStats, users } from './schema'
import { hashPassword } from '../auth/password'

async function main() {
  const { db, close } = await connect()

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

  // Lotes pequeños: PGlite no agradece un INSERT de 300+ filas de una sola vez.
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
  console.log(`Benchmark ${PERIOD_ACTUAL}: ${rows.length} celdas cargadas.`)

  const demoUsers = [
    {
      email: 'demo@consultorios.mx',
      name: 'Dra. Ana Rivera',
      clinicName: 'Ortodoncia Rivera',
      specialtySlug: 'ortodoncia',
      segmentSlug: 'clinica-pequena',
      city: 'Guadalajara',
      role: 'pro',
    },
    {
      email: 'agencia@consultorios.mx',
      name: 'Equipo de la agencia',
      clinicName: null,
      specialtySlug: 'ortodoncia',
      segmentSlug: 'clinica-multiple',
      city: 'Ciudad de México',
      role: 'admin',
    },
  ]

  for (const user of demoUsers) {
    await db
      .insert(users)
      .values({ ...user, passwordHash: await hashPassword('consultorios123') })
      .onConflictDoNothing({ target: users.email })
  }
  console.log('Cuentas de prueba: demo@consultorios.mx / agencia@consultorios.mx (consultorios123)')

  await close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
