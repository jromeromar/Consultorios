import { sql } from 'drizzle-orm'

import type { Db } from '../db/connect'
import { formulaPuntaje } from '../db/schema-censo'
import { INDICADORES, VERSION_FORMULA_PROPUESTA } from './indicadores'

/**
 * Siembra la versión inicial de la fórmula en `formula_puntaje`.
 *
 * A partir de aquí la fórmula vive en la base, no en el código: cambiar un peso
 * es insertar una versión nueva, y el puntaje que un profesional vio en
 * septiembre se sigue pudiendo reproducir en diciembre porque su fila de
 * `puntaje` guarda con qué versión se calculó.
 *
 * La transformación se guarda como texto —el nombre de la transformación y sus
 * cotas— porque es lo que el documento pide: «cómo se lleva el indicador a una
 * escala de 0 a 100», legible por una persona y no un puntero a código.
 */
export async function seedFormulaPuntaje(
  db: Db,
  version = VERSION_FORMULA_PROPUESTA,
  vigenteDesde = '2026-01-01',
): Promise<number> {
  const filas = INDICADORES.map((indicador) => ({
    version,
    bloque: indicador.bloque,
    indicador: indicador.slug,
    peso: String(indicador.pesoPropuesto),
    transformacion: describirTransformacion(indicador),
    direccion: indicador.direccion,
    vigenteDesde,
  }))

  await db
    .insert(formulaPuntaje)
    .values(filas)
    .onConflictDoUpdate({
      target: [formulaPuntaje.version, formulaPuntaje.indicador],
      set: {
        bloque: sql`excluded.bloque`,
        peso: sql`excluded.peso`,
        transformacion: sql`excluded.transformacion`,
        direccion: sql`excluded.direccion`,
        vigenteDesde: sql`excluded.vigente_desde`,
      },
    })

  return filas.length
}

function describirTransformacion(indicador: (typeof INDICADORES)[number]): string {
  const { transformacion, cotas, mapa } = indicador
  if (cotas) return `${transformacion}(${cotas[0]},${cotas[1]})`
  if (mapa) {
    const pares = Object.entries(mapa)
      .map(([k, v]) => `${k}=${v}`)
      .join(',')
    return `${transformacion}(${pares})`
  }
  return transformacion
}
