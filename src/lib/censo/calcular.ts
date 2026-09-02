import { and, eq } from 'drizzle-orm'

import type { Db } from '../db/connect'
import {
  contactoCampo,
  edicionEstudio,
  formulaPuntaje,
  puntaje as tablaPuntaje,
} from '../db/schema-censo'
import { extraerValores } from './extraer'
import { VERSION_FORMULA_PROPUESTA, type BloqueId } from './indicadores'
import { puntuarUniverso, type ReglaFormula } from './puntuar'

/**
 * Reconstruye la sábana `puntaje` de una edición.
 *
 * El documento es explícito: `puntaje` es salida, no origen. Se borra y se
 * reconstruye entera cada vez que cambia un dato o una fórmula, y ninguna
 * corrección se hace ahí — se hace en la tabla de origen y se vuelve a calcular.
 * Por eso esta función empieza borrando.
 */
export async function recalcularPuntajes(
  db: Db,
  edicionId: string,
): Promise<{
  universo: number
  puntuados: number
  respondio: number
  version: string
  cobertura: Record<string, number>
  bloquesNoMedidos: Record<string, number>
}> {
  const [edicion] = await db
    .select()
    .from(edicionEstudio)
    .where(eq(edicionEstudio.edicionId, edicionId))
    .limit(1)
  if (!edicion) throw new Error(`Edición desconocida: ${edicionId}`)

  const version = edicion.versionFormula ?? VERSION_FORMULA_PROPUESTA
  const filasFormula = await db
    .select()
    .from(formulaPuntaje)
    .where(eq(formulaPuntaje.version, version))
  if (filasFormula.length === 0) {
    throw new Error(
      `La edición declara la fórmula «${version}» y no hay filas de esa versión en formula_puntaje.`,
    )
  }

  const reglas: ReglaFormula[] = filasFormula.map((f) => ({
    version: f.version,
    bloque: f.bloque as BloqueId,
    indicador: f.indicador,
    peso: Number(f.peso),
    transformacion: f.transformacion,
    direccion: f.direccion,
  }))

  const { entradas, cobertura } = await extraerValores(db, edicionId)
  const resultado = puntuarUniverso(entradas, reglas)

  // Salida derivada: se reconstruye entera.
  await db.delete(tablaPuntaje).where(eq(tablaPuntaje.edicionId, edicionId))

  const filas = resultado.consultorios.map((c) => ({
    consultorioId: c.consultorioId,
    edicionId,
    puntajeVisibilidad: aTexto(c.porBloque.visibilidad),
    puntajeReputacion: aTexto(c.porBloque.reputacion),
    puntajeContenido: aTexto(c.porBloque.contenido),
    puntajeRespuesta: aTexto(c.porBloque.respuesta),
    puntajeReservabilidad: aTexto(c.porBloque.reservabilidad),
    puntajeGeneral: aTexto(c.general),
    percentilGeneral: c.percentilGeneral,
    percentilVisibilidad: aTexto(c.percentilPorBloque.visibilidad),
    percentilReputacion: aTexto(c.percentilPorBloque.reputacion),
    percentilContenido: aTexto(c.percentilPorBloque.contenido),
    percentilRespuesta: aTexto(c.percentilPorBloque.respuesta),
    percentilReservabilidad: aTexto(c.percentilPorBloque.reservabilidad),
    percentilGrupoCiudad: c.percentilGrupoCiudad,
    bloquesNoMedidos: c.bloquesNoMedidos.join(';') || null,
    versionFormula: version,
  }))

  for (let i = 0; i < filas.length; i += 60) {
    await db.insert(tablaPuntaje).values(filas.slice(i, i + 60))
  }

  // La ficha técnica del informe sale de esta tabla, no se escribe a mano.
  const respondieron = await db
    .select({ id: contactoCampo.contactoCampoId })
    .from(contactoCampo)
    .where(
      and(
        eq(contactoCampo.edicionId, edicionId),
        eq(contactoCampo.excluidoDelAnalisis, false),
        eq(contactoCampo.huboRespuesta, true),
      ),
    )

  await db
    .update(edicionEstudio)
    .set({ nUniverso: entradas.length, nRespondio: respondieron.length, versionFormula: version })
    .where(eq(edicionEstudio.edicionId, edicionId))

  const bloquesNoMedidos: Record<string, number> = {}
  for (const c of resultado.consultorios) {
    for (const bloque of c.bloquesNoMedidos) {
      bloquesNoMedidos[bloque] = (bloquesNoMedidos[bloque] ?? 0) + 1
    }
  }

  return {
    universo: entradas.length,
    puntuados: filas.filter((f) => f.puntajeGeneral !== null).length,
    respondio: respondieron.length,
    version,
    cobertura,
    bloquesNoMedidos,
  }
}

const aTexto = (v: number | null) => (v === null ? null : String(Math.round(v * 100) / 100))
