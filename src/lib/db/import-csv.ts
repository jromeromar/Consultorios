/**
 * Importa el benchmark desde archivos CSV.
 *
 *   npm run db:import -- data/*.csv
 *   npm run db:import -- data/observaciones-2026-s1.csv --nota "Muestra de campo, 214 consultorios"
 *   npm run db:import -- data/*.csv --reemplazar     # borra las celdas previas de esos periodos
 *   npm run db:import -- data/*.csv --dry-run        # solo informa, no escribe
 *
 * Acepta dos formas, detectadas por las columnas del archivo:
 *
 *  1. OBSERVACIONES — una fila por consultorio, una columna por KPI. El
 *     importador calcula los percentiles y respeta la muestra mínima.
 *  2. PERCENTILES — una fila por celda ya agregada (p10…p90 + n). Para cuando
 *     las cifras vienen calculadas de fuera.
 *
 * Ver data/README.md para las columnas exactas.
 */
import { loadEnvFiles } from '../load-env'

loadEnvFiles()

import { readFileSync } from 'node:fs'
import { and, eq, inArray } from 'drizzle-orm'

import {
  MUESTRA_MINIMA,
  agregarObservaciones,
  type Observacion,
} from '../benchmark/aggregate'
import { KPIS, KPIS_BY_SLUG } from '../benchmark/kpis'
import type { BenchmarkRow } from '../benchmark/reference-data'
import { PAIS_DEFAULT, PERIOD_ACTUAL, SEGMENT_SLUGS, SPECIALTY_SLUGS } from '../benchmark/taxonomy'
import { parseCsv, parseNumber, type CsvRow } from '../csv'
import { connect } from './connect'
import { benchmarkStats } from './schema'
import { upsertBenchmarkRows } from './seed-core'

type Opciones = {
  archivos: string[]
  nota?: string
  dryRun: boolean
  reemplazar: boolean
}

const problemas: string[] = []
const avisos: string[] = []

function main() {
  const opciones = leerArgumentos(process.argv.slice(2))
  if (opciones.archivos.length === 0) {
    console.error('Uso: npm run db:import -- <archivo.csv> [...] [--nota "..."] [--reemplazar] [--dry-run]')
    process.exit(1)
  }

  const observaciones: Observacion[] = []
  const percentiles: BenchmarkRow[] = []

  for (const archivo of opciones.archivos) {
    const filas = parseCsv(readFileSync(archivo, 'utf8'))
    if (filas.length === 0) {
      avisos.push(`${archivo}: sin filas de datos.`)
      continue
    }

    const columnas = Object.keys(filas[0])
    if (columnas.includes('p50')) {
      console.log(`${archivo}: ${filas.length} celdas ya agregadas (forma PERCENTILES).`)
      percentiles.push(...leerPercentiles(filas, archivo, opciones.nota))
    } else {
      console.log(`${archivo}: ${filas.length} observaciones (forma OBSERVACIONES).`)
      observaciones.push(...leerObservaciones(filas, archivo))
    }
  }

  return { opciones, observaciones, percentiles }
}

function leerArgumentos(argv: string[]): Opciones {
  const opciones: Opciones = { archivos: [], dryRun: false, reemplazar: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') opciones.dryRun = true
    else if (arg === '--reemplazar') opciones.reemplazar = true
    else if (arg === '--nota') opciones.nota = argv[++i]
    else if (arg.startsWith('--')) problemas.push(`Opción desconocida: ${arg}`)
    else opciones.archivos.push(arg)
  }
  return opciones
}

function validarClaves(row: CsvRow, archivo: string, linea: number) {
  const specialtySlug = row.especialidad ?? ''
  const segmentSlug = row.segmento || 'all'
  const period = row.periodo || PERIOD_ACTUAL
  const country = row.pais || PAIS_DEFAULT

  if (!SPECIALTY_SLUGS.includes(specialtySlug)) {
    problemas.push(
      `${archivo}:${linea} especialidad desconocida «${specialtySlug}». Válidas: ${SPECIALTY_SLUGS.join(', ')}`,
    )
    return null
  }
  if (segmentSlug !== 'all' && !SEGMENT_SLUGS.includes(segmentSlug)) {
    problemas.push(
      `${archivo}:${linea} segmento desconocido «${segmentSlug}». Válidos: all, ${SEGMENT_SLUGS.join(', ')}`,
    )
    return null
  }

  return { specialtySlug, segmentSlug, period, country }
}

function leerObservaciones(filas: CsvRow[], archivo: string): Observacion[] {
  const conocidos = new Set(KPIS.map((k) => k.slug))
  const columnas = Object.keys(filas[0])
  const meta = new Set(['id', 'consultorio', 'especialidad', 'segmento', 'periodo', 'pais', 'ciudad', 'notas'])

  for (const columna of columnas) {
    if (!meta.has(columna) && !conocidos.has(columna)) {
      avisos.push(`${archivo}: columna «${columna}» ignorada (no es un KPI del catálogo).`)
    }
  }

  const observaciones: Observacion[] = []

  filas.forEach((row, index) => {
    const linea = index + 2 // +1 por el encabezado, +1 porque las hojas cuentan desde 1
    const claves = validarClaves(row, archivo, linea)
    if (!claves) return

    const valores: Record<string, number> = {}
    for (const kpi of KPIS) {
      if (!(kpi.slug in row)) continue
      const valor = parseNumber(row[kpi.slug])
      if (valor === null) continue

      if (valor < kpi.min || valor > kpi.max) {
        problemas.push(
          `${archivo}:${linea} ${kpi.slug} = ${valor} está fuera del rango permitido (${kpi.min}–${kpi.max}).`,
        )
        continue
      }
      valores[kpi.slug] = valor
    }

    if (Object.keys(valores).length === 0) {
      avisos.push(`${archivo}:${linea} fila sin ningún KPI utilizable; se omite.`)
      return
    }

    observaciones.push({ origen: `${archivo}:${linea}`, ...claves, valores })
  })

  return observaciones
}

function leerPercentiles(filas: CsvRow[], archivo: string, nota?: string): BenchmarkRow[] {
  const salida: BenchmarkRow[] = []

  filas.forEach((row, index) => {
    const linea = index + 2
    const claves = validarClaves(row, archivo, linea)
    if (!claves) return

    const kpiSlug = row.kpi ?? ''
    if (!KPIS_BY_SLUG[kpiSlug]) {
      problemas.push(`${archivo}:${linea} KPI desconocido «${kpiSlug}».`)
      return
    }

    const p = ['p10', 'p25', 'p50', 'p75', 'p90'].map((k) => parseNumber(row[k] ?? ''))
    if (p.some((v) => v === null)) {
      problemas.push(`${archivo}:${linea} falta alguno de p10, p25, p50, p75, p90.`)
      return
    }
    const [p10, p25, p50, p75, p90] = p as number[]

    // Los percentiles van de menor a mayor valor, siempre — la dirección
    // (si más es mejor o peor) la resuelve el KPI, no el orden de la fila.
    if (!(p10 <= p25 && p25 <= p50 && p50 <= p75 && p75 <= p90)) {
      problemas.push(
        `${archivo}:${linea} los percentiles no están ordenados de menor a mayor: ${p10}, ${p25}, ${p50}, ${p75}, ${p90}.`,
      )
      return
    }

    const n = parseNumber(row.n ?? row.muestra ?? '')
    if (n === null) {
      problemas.push(`${archivo}:${linea} falta el tamaño de muestra (columna «n»).`)
      return
    }
    if (n < MUESTRA_MINIMA) {
      avisos.push(
        `${archivo}:${linea} n=${n} está por debajo de la muestra mínima (${MUESTRA_MINIMA}); la celda no se publica.`,
      )
      return
    }

    const sourceNote = row.fuente || nota
    if (!sourceNote) {
      problemas.push(
        `${archivo}:${linea} falta la procedencia: añade una columna «fuente» o pasa --nota "...".`,
      )
      return
    }

    salida.push({ ...claves, kpiSlug, p10, p25, p50, p75, p90, sampleSize: n, sourceNote })
  })

  return salida
}

async function ejecutar() {
  const { opciones, observaciones, percentiles } = main()

  const filas: BenchmarkRow[] = [...percentiles]

  if (observaciones.length > 0) {
    const nota = opciones.nota
    if (!nota) {
      problemas.push(
        'Las observaciones necesitan procedencia: pasa --nota "Muestra de campo, N consultorios, fecha".',
      )
    } else {
      const { filas: agregadas, omitidas, conteos } = agregarObservaciones(observaciones, nota)
      filas.push(...agregadas)

      console.log('\n── observaciones por celda ──')
      for (const { clave, n } of conteos) {
        const [esp, seg] = clave.split('|')
        const marca = n >= MUESTRA_MINIMA ? 'ok  ' : 'baja'
        console.log(`  ${marca} ${esp} · ${seg}: ${n}`)
      }

      if (omitidas.length > 0) {
        const celdas = new Set(omitidas.map((o) => `${o.specialtySlug} · ${o.segmentSlug}`))
        console.log(
          `\n  ${omitidas.length} celdas por debajo de la muestra mínima (${MUESTRA_MINIMA}), no se publican:`,
        )
        for (const celda of celdas) console.log(`    ${celda}`)

        // El agregado 'all' es la red de seguridad de un segmento corto, pero
        // solo si ese agregado sí alcanzó el mínimo.
        const conAgregado = new Set(
          agregadas.filter((f) => f.segmentSlug === 'all').map((f) => f.specialtySlug),
        )
        const sinAgregado = [
          ...new Set(
            omitidas
              .filter((o) => o.segmentSlug !== 'all' && !conAgregado.has(o.specialtySlug))
              .map((o) => o.specialtySlug),
          ),
        ]

        if (conAgregado.size > 0) {
          console.log(
            `    Los segmentos cortos de ${[...conAgregado].join(', ')} caerán al agregado de la especialidad.`,
          )
        }
        if (sinAgregado.length > 0) {
          console.log(
            `    Sin agregado publicable: ${sinAgregado.join(', ')}. Esas especialidades no tendrán cifras hasta reunir ${MUESTRA_MINIMA} observaciones.`,
          )
        }
      }
    }
  }

  if (problemas.length > 0) {
    console.error(`\n── ${problemas.length} problema(s), no se escribió nada ──`)
    for (const p of problemas.slice(0, 40)) console.error(`  ${p}`)
    if (problemas.length > 40) console.error(`  … y ${problemas.length - 40} más.`)
    process.exit(1)
  }

  if (avisos.length > 0) {
    console.log(`\n── ${avisos.length} aviso(s) ──`)
    for (const a of avisos.slice(0, 20)) console.log(`  ${a}`)
    if (avisos.length > 20) console.log(`  … y ${avisos.length - 20} más.`)
  }

  if (filas.length === 0) {
    console.error('\nNo hay ninguna celda publicable. Revisa los avisos de arriba.')
    process.exit(1)
  }

  const periodos = [...new Set(filas.map((f) => `${f.period} · ${f.country}`))]
  console.log(`\n${filas.length} celdas listas para escribir. Periodos: ${periodos.join(', ')}`)

  if (opciones.dryRun) {
    console.log('\n--dry-run: no se escribió nada.')
    return
  }

  const { db, close } = await connect()

  if (opciones.reemplazar) {
    const claves = [...new Set(filas.map((f) => `${f.period}|${f.country}`))]
    for (const clave of claves) {
      const [period, country] = clave.split('|')
      const borradas = await db
        .delete(benchmarkStats)
        .where(and(eq(benchmarkStats.period, period), eq(benchmarkStats.country, country)))
        .returning({ id: benchmarkStats.id })
      console.log(`--reemplazar: ${borradas.length} celdas previas borradas de ${period} · ${country}.`)
    }
  }

  const escritas = await upsertBenchmarkRows(db, filas)

  const especialidades = [...new Set(filas.map((f) => f.specialtySlug))]
  const restantes = await db
    .select({ sourceNote: benchmarkStats.sourceNote })
    .from(benchmarkStats)
    .where(inArray(benchmarkStats.specialtySlug, especialidades))
  const sinteticas = restantes.filter((r) => r.sourceNote.startsWith('Datos sintéticos')).length

  console.log(`\n${escritas} celdas escritas.`)
  if (sinteticas > 0) {
    console.log(
      `Quedan ${sinteticas} celdas sintéticas en esas especialidades. Usa --reemplazar para dejar solo datos reales.`,
    )
  } else {
    console.log('No quedan celdas sintéticas en las especialidades importadas.')
  }

  await close()
}

ejecutar().catch((error) => {
  console.error(error)
  process.exit(1)
})
