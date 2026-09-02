/**
 * Siembra el censo de demostración y calcula sus puntajes.
 *   npm run db:censo-demo
 */
import { loadEnvFiles } from '../load-env'

loadEnvFiles()

import { recalcularPuntajes } from '../censo/calcular'
import { seedCensoDemo } from '../censo/seed-demo'
import { seedFormulaPuntaje } from '../censo/seed-formula'
import { connect } from './connect'

async function main() {
  const { db, close } = await connect()

  const indicadores = await seedFormulaPuntaje(db)
  console.log(`Fórmula sembrada: ${indicadores} indicadores.`)

  const { edicionId, consultorios } = await seedCensoDemo(db)
  console.log(`Censo de demostración: ${consultorios} consultorios · edición ${edicionId}`)

  const r = await recalcularPuntajes(db, edicionId)
  console.log(`\nPuntajes recalculados con la fórmula ${r.version}:`)
  console.log(`  universo ${r.universo} · puntuados ${r.puntuados} · respondieron ${r.respondio}`)
  console.log('  cobertura por fuente:')
  for (const [fuente, n] of Object.entries(r.cobertura)) {
    console.log(`    ${fuente.padEnd(10)} ${n}`)
  }
  console.log('  consultorios con el bloque no medido:')
  for (const [bloque, n] of Object.entries(r.bloquesNoMedidos)) {
    console.log(`    ${bloque.padEnd(16)} ${n}`)
  }

  await close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
