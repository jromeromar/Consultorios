import 'server-only'

import { and, asc, desc, eq } from 'drizzle-orm'

import { getDb } from '../db'
import { edicionEstudio, formulaPuntaje, municipio, puntaje } from '../db/schema-censo'
import { extraerValores } from './extraer'
import {
  BLOQUES,
  INDICADORES_POR_SLUG,
  type BloqueId,
  type Indicador,
} from './indicadores'
import { puntuarUniverso, rangoPercentil, type ReglaFormula } from './puntuar'

export type Edicion = typeof edicionEstudio.$inferSelect

export async function getEdiciones(): Promise<Edicion[]> {
  const db = await getDb()
  return db.select().from(edicionEstudio).orderBy(desc(edicionEstudio.publicadaEn))
}

export async function getEdicion(edicionId: string): Promise<Edicion | null> {
  const db = await getDb()
  const [fila] = await db
    .select()
    .from(edicionEstudio)
    .where(eq(edicionEstudio.edicionId, edicionId))
    .limit(1)
  return fila ?? null
}

/** La edición publicada más reciente. */
export async function getEdicionVigente(): Promise<Edicion | null> {
  const ediciones = await getEdiciones()
  return ediciones[0] ?? null
}

export type CategoriaCiudad = {
  slug: string
  nombre: string
  municipios: number
}

const NOMBRE_CATEGORIA: Record<string, string> = {
  capital_principal: 'Capitales principales',
  capital_departamental: 'Capitales departamentales',
  intermedia: 'Ciudades intermedias',
  otra: 'Otros municipios',
}

export async function getCategoriasCiudad(): Promise<CategoriaCiudad[]> {
  const db = await getDb()
  const filas = await db.select().from(municipio).orderBy(asc(municipio.nombreMunicipio))
  const conteo = new Map<string, number>()
  for (const f of filas) conteo.set(f.categoriaCiudad, (conteo.get(f.categoriaCiudad) ?? 0) + 1)
  return [...conteo.entries()].map(([slug, municipios]) => ({
    slug,
    nombre: NOMBRE_CATEGORIA[slug] ?? slug,
    municipios,
  }))
}

export type DistribucionBloque = {
  bloque: BloqueId
  nombre: string
  n: number
  /** Consultorios del corte para los que el bloque quedó sin medir. */
  noMedidos: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

export type ResumenIndicador = {
  indicador: Indicador
  /** Cuántos consultorios del corte tienen el dato. */
  n: number
  noMedidos: number
  /** Para indicadores booleanos: porcentaje en el valor bueno. */
  pctBueno: number | null
  /** Para numéricos: cuartiles del valor crudo, en sus propias unidades. */
  cuartiles: { p25: number; p50: number; p75: number } | null
  /** Distribución del puntaje 0–100 del indicador, siempre disponible. */
  puntajeP50: number
}

export type PanoramaEdicion = {
  edicion: Edicion
  categoriaCiudad: string | null
  /** Consultorios del corte. */
  n: number
  bloques: DistribucionBloque[]
  indicadores: ResumenIndicador[]
  /** Percentil del puntaje general, para situar a un consultorio. */
  generales: number[]
}

function percentil(ordenados: number[], p: number): number {
  if (ordenados.length === 0) return 0
  if (ordenados.length === 1) return ordenados[0]
  const idx = (p / 100) * (ordenados.length - 1)
  const bajo = Math.floor(idx)
  const alto = Math.ceil(idx)
  if (bajo === alto) return ordenados[bajo]
  return ordenados[bajo] + (idx - bajo) * (ordenados[alto] - ordenados[bajo])
}

/**
 * Panorama de una edición, opcionalmente recortado por categoría de ciudad.
 *
 * Recalcula sobre el universo en vez de leer solo `puntaje` porque el resumen por
 * indicador necesita los valores crudos —cuánto cobra la mediana, cuántos tienen
 * reserva en línea— y esos no están en la sábana. La sábana guarda el resultado;
 * esto explica de dónde salió.
 */
export async function getPanorama(
  edicionId: string,
  categoriaCiudad?: string,
): Promise<PanoramaEdicion | null> {
  const db = await getDb()
  const edicion = await getEdicion(edicionId)
  if (!edicion) return null

  const version = edicion.versionFormula ?? ''
  const filasFormula = await db
    .select()
    .from(formulaPuntaje)
    .where(eq(formulaPuntaje.version, version))
  if (filasFormula.length === 0) return null

  const reglas: ReglaFormula[] = filasFormula.map((f) => ({
    version: f.version,
    bloque: f.bloque as BloqueId,
    indicador: f.indicador,
    peso: Number(f.peso),
    transformacion: f.transformacion,
    direccion: f.direccion,
  }))

  const { entradas } = await extraerValores(db, edicionId)
  // El puntaje y los percentiles se calculan siempre sobre el universo nacional
  // completo; el corte por ciudad solo filtra qué consultorios se resumen.
  const resultado = puntuarUniverso(entradas, reglas)
  const porId = new Map(resultado.consultorios.map((c) => [c.consultorioId, c]))

  const delCorte = categoriaCiudad
    ? entradas.filter((e) => e.categoriaCiudad === categoriaCiudad)
    : entradas

  const bloques: DistribucionBloque[] = BLOQUES.map((bloque) => {
    const valores = delCorte
      .map((e) => porId.get(e.consultorioId)?.porBloque[bloque.id] ?? null)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)

    return {
      bloque: bloque.id,
      nombre: bloque.nombre,
      n: valores.length,
      noMedidos: delCorte.length - valores.length,
      p10: percentil(valores, 10),
      p25: percentil(valores, 25),
      p50: percentil(valores, 50),
      p75: percentil(valores, 75),
      p90: percentil(valores, 90),
    }
  })

  const indicadores: ResumenIndicador[] = reglas
    .map((regla) => {
      const indicador = INDICADORES_POR_SLUG[regla.indicador]
      if (!indicador) return null

      const puntajes: number[] = []
      const crudosNumericos: number[] = []
      let buenos = 0
      let conDato = 0

      for (const entrada of delCorte) {
        const ficha = porId.get(entrada.consultorioId)
        const item = ficha?.indicadores.find((i) => i.indicador === regla.indicador)
        if (!item || item.puntaje === null) continue
        conDato += 1
        puntajes.push(item.puntaje)

        const crudo = item.crudo
        if (typeof crudo === 'boolean') {
          if (crudo) buenos += 1
        } else if (typeof crudo === 'number') {
          crudosNumericos.push(crudo)
        } else if (typeof crudo === 'string') {
          // Un enum cuenta como «bueno» si su puntaje es el máximo del mapa.
          if (item.puntaje >= 100) buenos += 1
        }
      }

      const esBooleano = indicador.transformacion === 'booleano' || indicador.transformacion === 'mapa_enum'
      crudosNumericos.sort((a, b) => a - b)
      puntajes.sort((a, b) => a - b)

      return {
        indicador,
        n: conDato,
        noMedidos: delCorte.length - conDato,
        pctBueno: esBooleano && conDato > 0 ? (buenos / conDato) * 100 : null,
        cuartiles:
          crudosNumericos.length > 0
            ? {
                p25: percentil(crudosNumericos, 25),
                p50: percentil(crudosNumericos, 50),
                p75: percentil(crudosNumericos, 75),
              }
            : null,
        puntajeP50: percentil(puntajes, 50),
      }
    })
    .filter((r): r is ResumenIndicador => r !== null)

  return {
    edicion,
    categoriaCiudad: categoriaCiudad ?? null,
    n: delCorte.length,
    bloques,
    indicadores,
    generales: resultado.consultorios
      .map((c) => c.general)
      .filter((v): v is number => v !== null),
  }
}

export type FichaPuntaje = typeof puntaje.$inferSelect

/** El puntaje guardado de un consultorio en una edición. */
export async function getPuntaje(
  consultorioId: string,
  edicionId: string,
): Promise<FichaPuntaje | null> {
  const db = await getDb()
  const [fila] = await db
    .select()
    .from(puntaje)
    .where(and(eq(puntaje.consultorioId, consultorioId), eq(puntaje.edicionId, edicionId)))
    .limit(1)
  return fila ?? null
}

export { rangoPercentil }
