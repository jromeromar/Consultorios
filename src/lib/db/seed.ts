/**
 * Carga el benchmark de referencia y un par de cuentas de prueba.
 * Idempotente: se puede correr tantas veces como haga falta.
 *   npm run db:seed
 */
import { loadEnvFiles } from '../load-env'

loadEnvFiles()

import { PERIOD_ACTUAL } from '../benchmark/taxonomy'
import { VERSION_FORMULA_PROPUESTA } from '../censo/indicadores'
import { seedFormulaPuntaje } from '../censo/seed-formula'
import { connect } from './connect'
import { CONTRASENA_DEMO, CUENTAS_DEMO, seedBenchmark, seedDemoUsers } from './seed-core'

async function main() {
  const { db, close } = await connect()

  const celdas = await seedBenchmark(db)
  console.log(`Benchmark ${PERIOD_ACTUAL}: ${celdas} celdas cargadas.`)

  const indicadores = await seedFormulaPuntaje(db)
  console.log(
    `Fórmula del censo ${VERSION_FORMULA_PROPUESTA}: ${indicadores} indicadores en 5 bloques.`,
  )

  await seedDemoUsers(db)
  const correos = CUENTAS_DEMO.map((u) => u.email).join(' / ')
  console.log(`Cuentas de prueba: ${correos} (${CONTRASENA_DEMO})`)

  await close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
