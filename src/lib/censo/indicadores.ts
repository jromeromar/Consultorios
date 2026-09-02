/**
 * Catálogo de indicadores del puntaje del censo.
 *
 * Los cinco bloques —visibilidad, reputación, contenido, respuesta,
 * reservabilidad— los fija el documento de tablas y campos. El reparto de
 * indicadores por bloque también sale de ahí: cada nota de campo dice a qué
 * bloque alimenta («Es indicador del bloque de visibilidad», «Bloque de
 * reputación», «Bloque de contenido y redes», «Bloque de reservabilidad»), y el
 * bloque de respuesta es contacto_campo entero.
 *
 * IMPORTANTE — los pesos y las transformaciones de aquí son una PROPUESTA, no la
 * fórmula. La fórmula vigente vive en la tabla `formula_puntaje`, versionada, y
 * es una decisión del equipo. Este archivo solo siembra una versión inicial
 * (`v0-propuesta`) para que la maquinaria corra; ajustar un peso es un UPDATE en
 * esa tabla y una versión nueva, no un cambio de código.
 *
 * Todo lo que se puntúa aquí es OBSERVADO desde fuera. Nada depende de que el
 * profesional conteste: el censo puede calcular el puntaje de un consultorio que
 * no sabe que existe el estudio. Lo declarado vive en `dato_declarado` y sirve
 * para medir la distancia contra lo observado, no para puntuar.
 */

export type BloqueId =
  | 'visibilidad'
  | 'reputacion'
  | 'contenido'
  | 'respuesta'
  | 'reservabilidad'

export type Bloque = {
  id: BloqueId
  nombre: string
  /** Qué mide el bloque, en una frase que un ortodoncista entienda. */
  claim: string
  /** De dónde salen sus indicadores. */
  origen: string
}

export const BLOQUES: Bloque[] = [
  {
    id: 'visibilidad',
    nombre: 'Visibilidad',
    claim: 'Si apareces cuando alguien busca lo que tú haces, en tu ciudad.',
    origen: 'consultorio_snapshot · serp_local',
  },
  {
    id: 'reputacion',
    nombre: 'Reputación',
    claim: 'Qué encuentra un paciente cuando te compara con el de la siguiente cuadra.',
    origen: 'consultorio_snapshot · resena',
  },
  {
    id: 'contenido',
    nombre: 'Contenido',
    claim: 'Si publicas, con qué constancia y si eso lleva a alguna parte.',
    origen: 'instagram_snapshot · consultorio_snapshot',
  },
  {
    id: 'respuesta',
    nombre: 'Respuesta',
    claim: 'Qué pasa cuando un paciente potencial te escribe hoy.',
    origen: 'contacto_campo',
  },
  {
    id: 'reservabilidad',
    nombre: 'Reservabilidad',
    claim: 'Qué tan fácil es cerrar una cita sin hablar con nadie.',
    origen: 'sitio_snapshot · consultorio_snapshot · instagram_snapshot',
  },
]

export function getBloque(id: BloqueId): Bloque {
  const bloque = BLOQUES.find((b) => b.id === id)
  if (!bloque) throw new Error(`Bloque desconocido: ${id}`)
  return bloque
}

export type Direccion = 'mas_es_mejor' | 'menos_es_mejor'

/**
 * Transformaciones admitidas para llevar un indicador a 0–100. El nombre se
 * guarda como texto en `formula_puntaje.transformacion`, así que esta lista es
 * el contrato entre la fórmula y el calculador.
 */
export type Transformacion =
  /** Booleano: verdadero = 100, falso = 0. */
  | 'booleano'
  /** Percentil del propio valor dentro del universo de la edición. */
  | 'percentil_universo'
  /** Escala lineal entre dos cotas declaradas, recortando fuera de rango. */
  | 'lineal_acotada'
  /** Ya viene en 0–100 (porcentajes). */
  | 'identidad_pct'
  /** Escala logarítmica acotada: para colas largas como seguidores o minutos. */
  | 'log_acotada'
  /** Mapa explícito de valor de enum a puntaje. */
  | 'mapa_enum'

export type Indicador = {
  slug: string
  bloque: BloqueId
  nombre: string
  /** Tabla y columna de origen. Ningún indicador se calcula de la nada. */
  origen: string
  direccion: Direccion
  transformacion: Transformacion
  /** Cotas para `lineal_acotada` y `log_acotada`. */
  cotas?: [number, number]
  /** Puntajes por valor para `mapa_enum`. */
  mapa?: Record<string, number>
  /** Peso propuesto dentro del bloque. Los del bloque suman 1. */
  pesoPropuesto: number
  /** Qué significa que no haya dato. Nunca es un cero. */
  sinDato: string
  /** Lectura para el profesional cuando está por debajo de la mediana. */
  lectura: string
}

export const INDICADORES: Indicador[] = [
  // ── Visibilidad ─────────────────────────────────────────────────────────
  {
    slug: 'categoria_es_ortodoncia',
    bloque: 'visibilidad',
    nombre: 'Categoría de Google correcta',
    origen: 'consultorio_snapshot.categoria_principal',
    direccion: 'mas_es_mejor',
    transformacion: 'booleano',
    pesoPropuesto: 0.35,
    sinDato: 'La ficha no se pudo leer en esta edición.',
    lectura:
      'Estás listado como «Dentista» y no como ortodoncista: no apareces en las búsquedas de tu propia especialidad. Es el arreglo más barato de toda la lista.',
  },
  {
    slug: 'presencia_paquete_local',
    bloque: 'visibilidad',
    nombre: 'Presencia en el paquete local',
    origen: 'serp_local · bloque = paquete_local',
    direccion: 'mas_es_mejor',
    transformacion: 'percentil_universo',
    pesoPropuesto: 0.3,
    sinDato: 'No se midió búsqueda local en tu municipio en esta edición.',
    lectura:
      'No sales en el bloque de mapas que ve el 80 % de quien busca desde el celular.',
  },
  {
    slug: 'posicion_media_paquete_local',
    bloque: 'visibilidad',
    nombre: 'Posición media en el paquete local',
    origen: 'serp_local.posicion · bloque = paquete_local',
    direccion: 'menos_es_mejor',
    transformacion: 'lineal_acotada',
    cotas: [1, 20],
    pesoPropuesto: 0.2,
    sinDato: 'No apareciste en ninguna consulta medida, o no se midió tu municipio.',
    lectura: 'Apareces, pero por debajo de donde se reparten las llamadas.',
  },
  {
    slug: 'tiene_direccion_visible',
    bloque: 'visibilidad',
    nombre: 'Dirección visible en la ficha',
    origen: 'consultorio_snapshot.es_area_de_servicio',
    direccion: 'mas_es_mejor',
    transformacion: 'booleano',
    pesoPropuesto: 0.15,
    sinDato: 'La ficha no se pudo leer.',
    lectura:
      'Tu ficha es de «área de servicio», sin dirección: Google te muestra menos en búsquedas locales.',
  },

  // ── Reputación ──────────────────────────────────────────────────────────
  {
    slug: 'calificacion',
    bloque: 'reputacion',
    nombre: 'Calificación de Google',
    origen: 'consultorio_snapshot.calificacion',
    direccion: 'mas_es_mejor',
    transformacion: 'lineal_acotada',
    cotas: [3, 5],
    pesoPropuesto: 0.3,
    sinDato: 'Sin reseñas todavía: no hay calificación que mostrar.',
    lectura: 'Tu calificación está por debajo de la de tu ciudad.',
  },
  {
    slug: 'resenas_total',
    bloque: 'reputacion',
    nombre: 'Cantidad de reseñas',
    origen: 'consultorio_snapshot.resenas_total',
    direccion: 'mas_es_mejor',
    transformacion: 'log_acotada',
    cotas: [1, 500],
    pesoPropuesto: 0.25,
    sinDato: 'La ficha no se pudo leer.',
    lectura:
      'Un 4,9 con seis reseñas convence menos que un 4,6 con doscientas. El volumen es parte de la credibilidad.',
  },
  {
    slug: 'recencia_resena',
    bloque: 'reputacion',
    nombre: 'Recencia de la última reseña',
    origen: 'consultorio_snapshot.fecha_resena_mas_reciente',
    direccion: 'menos_es_mejor',
    transformacion: 'log_acotada',
    cotas: [7, 730],
    pesoPropuesto: 0.25,
    sinDato: 'No se pudo extraer la fecha: se declara no medida, no cero.',
    lectura:
      'Tu reseña más reciente es vieja. Un paciente lee eso como «aquí ya no pasa nada».',
  },
  {
    slug: 'resenas_respondidas_pct',
    bloque: 'reputacion',
    nombre: 'Reseñas respondidas',
    origen: 'consultorio_snapshot.resenas_respondidas_pct · resena',
    direccion: 'mas_es_mejor',
    transformacion: 'identidad_pct',
    pesoPropuesto: 0.2,
    sinDato: 'Requiere la tabla de reseñas, opcional en la primera edición.',
    lectura: 'No respondes reseñas. Es la conversación pública que sí controlas.',
  },

  // ── Contenido ───────────────────────────────────────────────────────────
  {
    slug: 'publicaciones_30d',
    bloque: 'contenido',
    nombre: 'Publicaciones en 30 días',
    origen: 'instagram_snapshot.publicaciones_30d',
    direccion: 'mas_es_mejor',
    transformacion: 'lineal_acotada',
    cotas: [0, 20],
    pesoPropuesto: 0.3,
    sinDato: 'No publicas tu cuenta en la ficha de Google, o no se pudo emparejar.',
    lectura: 'Publicas poco o nada: la cuenta existe pero no sostiene demanda.',
  },
  {
    slug: 'interaccion_promedio_pct',
    bloque: 'contenido',
    nombre: 'Interacción promedio',
    origen: 'instagram_snapshot.interaccion_promedio_pct',
    direccion: 'mas_es_mejor',
    transformacion: 'lineal_acotada',
    cotas: [0, 6],
    pesoPropuesto: 0.25,
    sinDato: 'Sin cuenta emparejada.',
    lectura: 'Publicas, pero casi nadie reacciona. Volumen sin alcance.',
  },
  {
    slug: 'seguidores',
    bloque: 'contenido',
    nombre: 'Seguidores',
    origen: 'instagram_snapshot.seguidores',
    direccion: 'mas_es_mejor',
    transformacion: 'log_acotada',
    cotas: [100, 100_000],
    pesoPropuesto: 0.15,
    sinDato: 'Sin cuenta emparejada.',
    lectura: 'Audiencia pequeña para tu ciudad.',
  },
  {
    slug: 'cuenta_profesional',
    bloque: 'contenido',
    nombre: 'Cuenta profesional',
    origen: 'instagram_snapshot.es_cuenta_profesional',
    direccion: 'mas_es_mejor',
    transformacion: 'booleano',
    pesoPropuesto: 0.1,
    sinDato: 'Sin cuenta emparejada.',
    lectura: 'Cuenta personal: sin métricas ni posibilidad de pautar.',
  },
  {
    slug: 'fotos_ficha',
    bloque: 'contenido',
    nombre: 'Fotos en la ficha de Google',
    origen: 'consultorio_snapshot.fotos_n',
    direccion: 'mas_es_mejor',
    transformacion: 'log_acotada',
    cotas: [1, 100],
    pesoPropuesto: 0.2,
    sinDato: 'La ficha no se pudo leer.',
    lectura: 'Pocas fotos: la ficha se ve abandonada al lado de la del vecino.',
  },

  // ── Respuesta ───────────────────────────────────────────────────────────
  {
    slug: 'hubo_respuesta',
    bloque: 'respuesta',
    nombre: 'Contestó',
    origen: 'contacto_campo.hubo_respuesta',
    direccion: 'mas_es_mejor',
    transformacion: 'booleano',
    pesoPropuesto: 0.35,
    sinDato: 'No entró en la muestra de campo de esta edición.',
    lectura:
      'Un paciente potencial escribió y nadie contestó dentro del corte de reloj. Todo lo que sigue no llegó a pasar.',
  },
  {
    slug: 'minutos_primera_respuesta',
    bloque: 'respuesta',
    nombre: 'Minutos hasta la primera respuesta',
    origen: 'contacto_campo.minutos_primera_respuesta',
    direccion: 'menos_es_mejor',
    transformacion: 'log_acotada',
    cotas: [2, 2880],
    pesoPropuesto: 0.25,
    sinDato: 'Nulo cuando no hubo respuesta: no entra al promedio como cero.',
    lectura:
      'Quien contesta primero se queda el paciente. Este es el hueco más barato de cerrar.',
  },
  {
    slug: 'ofrecio_agendar',
    bloque: 'respuesta',
    nombre: 'Ofreció agendar',
    origen: 'contacto_campo.ofrecio_agendar',
    direccion: 'mas_es_mejor',
    transformacion: 'mapa_enum',
    mapa: { si: 100, no: 0 },
    pesoPropuesto: 0.2,
    sinDato: 'La conversación no permite afirmarlo (no_observado).',
    lectura:
      'Contestaste pero no propusiste cita. La conversación murió en información.',
  },
  {
    slug: 'dio_precio',
    bloque: 'respuesta',
    nombre: 'Dio precio',
    origen: 'contacto_campo.dio_precio',
    direccion: 'mas_es_mejor',
    transformacion: 'mapa_enum',
    mapa: { exacto: 100, rango: 70, no: 0 },
    pesoPropuesto: 0.1,
    sinDato: 'No observado en la conversación.',
    lectura:
      'No diste precio ni rango. Es legítimo, pero el paciente lo compara con quien sí lo dio.',
  },
  {
    slug: 'seguimiento_espontaneo',
    bloque: 'respuesta',
    nombre: 'Hizo seguimiento sin que el paciente escribiera',
    origen: 'contacto_campo.hubo_seguimiento_espontaneo',
    direccion: 'mas_es_mejor',
    transformacion: 'mapa_enum',
    mapa: { si: 100, no: 0 },
    pesoPropuesto: 0.1,
    sinDato: 'No observado.',
    lectura: 'Nadie volvió a escribir. El paciente que no contestó se perdió solo.',
  },

  // ── Reservabilidad ──────────────────────────────────────────────────────
  {
    slug: 'tiene_reserva_online',
    bloque: 'reservabilidad',
    nombre: 'Reserva en línea en el sitio',
    origen: 'sitio_snapshot.tiene_reserva_online',
    direccion: 'mas_es_mejor',
    transformacion: 'booleano',
    pesoPropuesto: 0.35,
    sinDato: 'El sitio no se pudo rastrear: un error de rastreo no es un «no tiene».',
    lectura:
      'Para pedir cita hay que escribir y esperar. Cada paso que añades pierde una parte de los que iban a agendar.',
  },
  {
    slug: 'tiene_horario_publicado',
    bloque: 'reservabilidad',
    nombre: 'Horario publicado en Google',
    origen: 'consultorio_snapshot.tiene_horario_publicado',
    direccion: 'mas_es_mejor',
    transformacion: 'booleano',
    pesoPropuesto: 0.2,
    sinDato: 'La ficha no se pudo leer.',
    lectura: 'Sin horario publicado, Google te muestra menos y el paciente no sabe si estás.',
  },
  {
    slug: 'enlace_bio_a_reserva',
    bloque: 'reservabilidad',
    nombre: 'El enlace de la bio lleva a agendar',
    origen: 'instagram_snapshot.destino_enlace',
    direccion: 'mas_es_mejor',
    transformacion: 'mapa_enum',
    mapa: { reserva: 100, whatsapp: 70, sitio: 40, agregador: 20, ninguno: 0 },
    pesoPropuesto: 0.15,
    sinDato: 'Sin cuenta emparejada.',
    lectura: 'El enlace de tu bio no lleva a agendar. Tráfico que se queda mirando.',
  },
  {
    slug: 'tiene_pago_en_linea',
    bloque: 'reservabilidad',
    nombre: 'Pago en línea',
    origen: 'sitio_snapshot.tiene_pago_en_linea',
    direccion: 'mas_es_mejor',
    transformacion: 'booleano',
    pesoPropuesto: 0.15,
    sinDato: 'El sitio no se pudo rastrear.',
    lectura: 'Sin pago en línea no puedes cobrar el abono que sostiene la cita.',
  },
  {
    slug: 'es_movil_responsive',
    bloque: 'reservabilidad',
    nombre: 'Sitio usable en celular',
    origen: 'sitio_snapshot.es_movil_responsive',
    direccion: 'mas_es_mejor',
    transformacion: 'booleano',
    pesoPropuesto: 0.15,
    sinDato: 'El sitio no se pudo rastrear.',
    lectura: 'Tu sitio no sirve en celular, que es desde donde llega casi todo el mundo.',
  },
]

export const INDICADORES_POR_SLUG: Record<string, Indicador> = Object.fromEntries(
  INDICADORES.map((i) => [i.slug, i]),
)

export function indicadoresDeBloque(bloque: BloqueId): Indicador[] {
  return INDICADORES.filter((i) => i.bloque === bloque)
}

/** Versión de la fórmula que siembra este catálogo. */
export const VERSION_FORMULA_PROPUESTA = 'v0-propuesta'
