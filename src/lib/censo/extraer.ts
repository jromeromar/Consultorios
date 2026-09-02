import { and, eq, inArray } from 'drizzle-orm'

import type { Db } from '../db/connect'
import {
  consultorio,
  consultorioSnapshot,
  edicionEstudio,
  instagramSnapshot,
  municipio,
  serpLocal,
  sitioSnapshot,
  contactoCampo,
} from '../db/schema-censo'
import type { EntradaConsultorio, ValorCrudo } from './puntuar'

/**
 * Traduce las tablas del censo a los valores crudos que espera el motor de
 * puntaje, uno por indicador de `formula_puntaje`.
 *
 * Es el único lugar donde se decide qué columna alimenta qué indicador, y por
 * tanto donde hay que respetar la regla más delicada del modelo: **un fallo de
 * captura no es un cero**. Si el sitio no se pudo rastrear, sus indicadores van
 * nulos, no falsos; si la ficha no se pudo leer, lo mismo. Poner `false` ahí
 * significaría afirmar que el consultorio no tiene reserva en línea cuando lo
 * único que se sabe es que el rastreador falló.
 */

/** El más reciente por consultorio, según la fecha que corresponda. */
function ultimoPorConsultorio<T extends { consultorioId: string | null }>(
  filas: T[],
  fecha: (fila: T) => string | null,
): Map<string, T> {
  const mapa = new Map<string, T>()
  for (const fila of filas) {
    if (!fila.consultorioId) continue
    const actual = mapa.get(fila.consultorioId)
    if (!actual || (fecha(fila) ?? '') > (fecha(actual) ?? '')) {
      mapa.set(fila.consultorioId, fila)
    }
  }
  return mapa
}

const num = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v)

/** Días entre una fecha y el cierre de campo de la edición. */
function diasHasta(desde: string | null, hasta: string | null): number | null {
  if (!desde) return null
  const fin = hasta ? new Date(hasta) : new Date()
  const ms = fin.getTime() - new Date(desde).getTime()
  return ms < 0 ? 0 : Math.round(ms / 86_400_000)
}

export type ExtraccionResultado = {
  entradas: EntradaConsultorio[]
  /** Cuántos consultorios del universo tienen dato de cada fuente. */
  cobertura: Record<string, number>
}

export async function extraerValores(db: Db, edicionId: string): Promise<ExtraccionResultado> {
  const [edicion] = await db
    .select()
    .from(edicionEstudio)
    .where(eq(edicionEstudio.edicionId, edicionId))
    .limit(1)
  if (!edicion) throw new Error(`Edición desconocida: ${edicionId}`)

  // El universo: decisión del equipo, no de Google.
  const universo = await db
    .select({ consultorioId: consultorio.consultorioId })
    .from(consultorio)
    .where(and(eq(consultorio.esOrtodoncia, true), eq(consultorio.estadoRegistro, 'activo')))

  const ids = universo.map((u) => u.consultorioId)
  if (ids.length === 0) return { entradas: [], cobertura: {} }

  const [fichas, sitios, cuentas, contactos, serps, municipios] = await Promise.all([
    db.select().from(consultorioSnapshot).where(inArray(consultorioSnapshot.consultorioId, ids)),
    db.select().from(sitioSnapshot).where(inArray(sitioSnapshot.consultorioId, ids)),
    db.select().from(instagramSnapshot).where(inArray(instagramSnapshot.consultorioId, ids)),
    db
      .select()
      .from(contactoCampo)
      .where(
        and(eq(contactoCampo.edicionId, edicionId), eq(contactoCampo.excluidoDelAnalisis, false)),
      ),
    db.select().from(serpLocal).where(inArray(serpLocal.consultorioId, ids)),
    db.select().from(municipio),
  ])

  const fichaDe = ultimoPorConsultorio(fichas, (f) => f.fechaCaptura)
  const sitioDe = ultimoPorConsultorio(sitios, (s) => s.fechaRastreo)
  const cuentaDe = ultimoPorConsultorio(cuentas, (c) => c.fechaCaptura)
  const contactoDe = ultimoPorConsultorio(contactos, (c) => c.codificadoEn)
  const categoriaCiudadDe = new Map(municipios.map((m) => [m.municipioId, m.categoriaCiudad]))

  // Presencia y posición en el paquete local, por consultorio.
  const paqueteLocal = new Map<string, { apariciones: Set<string>; posiciones: number[] }>()
  /**
   * Municipios donde sí se midió búsqueda local. Sin esto, un consultorio de un
   * municipio que nadie midió parecería tener cero apariciones, cuando lo
   * correcto es no medido.
   */
  const municipiosMedidos = new Set<string>()
  for (const fila of serps) {
    if (fila.bloque === 'paquete_local') municipiosMedidos.add(fila.municipioId)
  }
  for (const fila of serps) {
    if (!fila.consultorioId || fila.bloque !== 'paquete_local') continue
    // Un emparejamiento flojo no entra al análisis: la unión más frágil del modelo.
    const confianza = num(fila.confianzaEmparejamiento)
    if (confianza !== null && confianza < 0.7) continue
    const acc = paqueteLocal.get(fila.consultorioId) ?? { apariciones: new Set(), posiciones: [] }
    acc.apariciones.add(`${fila.consultaNormalizada}|${fila.municipioId}`)
    acc.posiciones.push(fila.posicion)
    paqueteLocal.set(fila.consultorioId, acc)
  }

  const cobertura = {
    ficha: fichaDe.size,
    sitio: [...sitioDe.values()].filter((s) => s.estadoRastreo === 'ok').length,
    instagram: cuentaDe.size,
    campo: contactoDe.size,
    serp: paqueteLocal.size,
  }

  const entradas: EntradaConsultorio[] = ids.map((consultorioId) => {
    const ficha = fichaDe.get(consultorioId)
    const sitio = sitioDe.get(consultorioId)
    const cuenta = cuentaDe.get(consultorioId)
    const contacto = contactoDe.get(consultorioId)
    const serp = paqueteLocal.get(consultorioId)

    /** Un rastreo que no terminó en `ok` no dice nada del consultorio. */
    const sitioUtil = sitio?.estadoRastreo === 'ok' ? sitio : undefined

    const valores: Record<string, ValorCrudo> = {
      // ── Visibilidad ────────────────────────────────────────────────────
      categoria_es_ortodoncia: ficha?.categoriaPrincipal
        ? /ortodonc/i.test(ficha.categoriaPrincipal)
        : null,
      presencia_paquete_local: serp
        ? serp.apariciones.size
        : // No aparecer es un cero legítimo, pero solo si su municipio se midió.
          ficha?.municipioId && municipiosMedidos.has(ficha.municipioId)
          ? 0
          : null,
      posicion_media_paquete_local:
        serp && serp.posiciones.length > 0
          ? serp.posiciones.reduce((a, b) => a + b, 0) / serp.posiciones.length
          : null,
      tiene_direccion_visible:
        ficha?.esAreaDeServicio === null || ficha?.esAreaDeServicio === undefined
          ? null
          : !ficha.esAreaDeServicio,

      // ── Reputación ─────────────────────────────────────────────────────
      calificacion: num(ficha?.calificacion),
      resenas_total: ficha?.resenasTotal ?? null,
      recencia_resena: diasHasta(ficha?.fechaResenaMasReciente ?? null, edicion.campoFin),
      resenas_respondidas_pct: num(ficha?.resenasRespondidasPct),

      // ── Contenido ──────────────────────────────────────────────────────
      publicaciones_30d: cuenta?.publicaciones30d ?? null,
      interaccion_promedio_pct: num(cuenta?.interaccionPromedioPct),
      seguidores: cuenta?.seguidores ?? null,
      cuenta_profesional: cuenta?.esCuentaProfesional ?? null,
      fotos_ficha: ficha?.fotosN ?? null,

      // ── Respuesta ──────────────────────────────────────────────────────
      hubo_respuesta: contacto?.huboRespuesta ?? null,
      // Nulo cuando no respondió: no entra al promedio como un tiempo malísimo.
      minutos_primera_respuesta: contacto?.minutosPrimeraRespuesta ?? null,
      ofrecio_agendar: contacto?.ofrecioAgendar ?? null,
      dio_precio: contacto?.dioPrecio ?? null,
      seguimiento_espontaneo: contacto?.huboSeguimientoEspontaneo ?? null,

      // ── Reservabilidad ─────────────────────────────────────────────────
      tiene_reserva_online: sitioUtil?.tieneReservaOnline ?? null,
      tiene_horario_publicado: ficha?.tieneHorarioPublicado ?? null,
      enlace_bio_a_reserva: cuenta?.destinoEnlace ?? null,
      tiene_pago_en_linea: sitioUtil?.tienePagoEnLinea ?? null,
      es_movil_responsive: sitioUtil?.esMovilResponsive ?? null,
    }

    return {
      consultorioId,
      categoriaCiudad: ficha?.municipioId
        ? categoriaCiudadDe.get(ficha.municipioId) ?? null
        : null,
      valores,
    }
  })

  return { entradas, cobertura }
}
