import { pgEnum } from 'drizzle-orm/pg-core'

/**
 * Dominios cerrados del censo, tal como los declara el documento de tablas y
 * campos (v1.4). Van como enum de Postgres y no como texto libre porque el
 * modelo es deliberado con ellos: un valor fuera de la lista es un error de
 * captura, no un caso nuevo, y conviene que la base lo rechace.
 */

// ── Territorio ──────────────────────────────────────────────────────────────
export const categoriaCiudadEnum = pgEnum('categoria_ciudad', [
  'capital_principal',
  'capital_departamental',
  'intermedia',
  'otra',
])

export const ambitoTipoEnum = pgEnum('ambito_tipo', [
  'pais',
  'departamento',
  'municipio',
  'localidad',
  'territorio',
])

export const indicadorGeoEnum = pgEnum('indicador_geo', [
  'poblacion',
  'prestadores_odontologia',
  'prestadores_ortodoncia',
  'otro',
])

export const fuenteGeoEnum = pgEnum('fuente_geo', [
  'dane_proyeccion',
  'dane_censo',
  'reps',
  'rues',
  'distrital',
  'otra',
])

export const tipoTerritorioEnum = pgEnum('tipo_territorio', [
  'municipio',
  'conjunto_de_municipios',
  'localidad',
  'conjunto_de_localidades',
])

export const estadoTerritorioEnum = pgEnum('estado_territorio', [
  'libre',
  'reservado',
  'asignado',
  'descartado',
])

export const tipoUnidadEnum = pgEnum('tipo_unidad', ['municipio', 'localidad'])

// ── Demanda ─────────────────────────────────────────────────────────────────
export const verticalEnum = pgEnum('vertical', [
  'ortodoncia',
  'odontologia_estetica',
  'medicina_estetica',
  'otra',
])

export const tipoIntencionEnum = pgEnum('tipo_intencion', [
  'precio',
  'servicio',
  'marca',
  'informativa',
])

export const conjuntoConsultasEnum = pgEnum('conjunto_consultas', ['nucleo', 'ampliado'])

export const herramientaKeywordsEnum = pgEnum('herramienta_keywords', [
  'ubersuggest',
  'keyword_planner',
  'otra',
])

export const ventanaKeywordsEnum = pgEnum('ventana_keywords', ['12m', '3m', 'ultimo_mes'])

// ── Consultorio ─────────────────────────────────────────────────────────────
export const tipoEstablecimientoEnum = pgEnum('tipo_establecimiento', [
  'consultorio_individual',
  'clinica_multisilla',
  'cadena',
  'franquicia',
])

export const estadoRegistroEnum = pgEnum('estado_registro', [
  'activo',
  'cerrado',
  'duplicado',
  'fuera_de_alcance',
])

export const fuenteListadoEnum = pgEnum('fuente_listado', [
  'google_maps',
  'directorio',
  'asociacion',
  'manual',
])

export const baseLegalEnum = pgEnum('base_legal', ['fuente_publica', 'consentimiento'])

// ── Observación pública ─────────────────────────────────────────────────────
export const fuenteCapturaEnum = pgEnum('fuente_captura', ['maps', 'serp', 'manual'])

export const estadoRastreoEnum = pgEnum('estado_rastreo', [
  'ok',
  'sin_sitio',
  'error_dns',
  'timeout',
  'bloqueado',
])

export const plataformaAgendaEnum = pgEnum('plataforma_agenda', [
  'dentalink',
  'agendapro',
  'doctoralia',
  'calendly',
  'otro',
  'ninguno',
])

export const pasarelaEnum = pgEnum('pasarela', [
  'wompi',
  'mercadopago',
  'payu',
  'otra',
  'ninguna',
])

export const bloqueSerpEnum = pgEnum('bloque_serp', ['paquete_local', 'organico', 'anuncio'])

export const dispositivoEnum = pgEnum('dispositivo', ['movil', 'escritorio'])

export const metodoEmparejamientoEnum = pgEnum('metodo_emparejamiento', [
  'place_id',
  'telefono',
  'dominio',
  'nombre_aproximado',
  'sin_emparejar',
])

export const destinoEnlaceEnum = pgEnum('destino_enlace', [
  'reserva',
  'whatsapp',
  'sitio',
  'agregador',
  'ninguno',
])

// ── Trabajo de campo ────────────────────────────────────────────────────────
export const canalCampoEnum = pgEnum('canal_campo', [
  'whatsapp',
  'instagram_dm',
  'formulario_web',
])

export const estadoEnvioEnum = pgEnum('estado_envio', [
  'entregado',
  'no_entregado',
  'bloqueado',
  'numero_invalido',
])

export const tipoRespondedorEnum = pgEnum('tipo_respondedor', [
  'persona',
  'automatico',
  'indeterminado',
])

/**
 * Tri-estado de la codificación de campo. `no_observado` no es «no»: significa
 * que la conversación no permite afirmarlo, y el análisis lo trata distinto.
 */
export const observadoEnum = pgEnum('observado', ['si', 'no', 'no_observado'])

/** Variante para lo declarado: aquí el tercer valor es que no lo dijo. */
export const declaradoSiNoEnum = pgEnum('declarado_si_no', ['si', 'no', 'no_dice'])

export const dioPrecioEnum = pgEnum('dio_precio', ['no', 'rango', 'exacto', 'no_observado'])

export const franjaHorariaEnum = pgEnum('franja_horaria', [
  'madrugada',
  'manana',
  'mediodia',
  'tarde',
  'noche',
])

// ── Declarado y estudio ─────────────────────────────────────────────────────
export const eventoDeclaradoEnum = pgEnum('evento_declarado', [
  'chat_campo',
  'entrevista',
  'stand_congreso',
  'formulario_web',
])

export const campoDeclaradoEnum = pgEnum('campo_declarado', [
  'precio_lista',
  'cobra_primera_cita',
  'valor_primera_cita',
  'consultas_mes',
  'anos_ejercicio',
  'sillas',
  'persona_dedicada_mensajes',
  'software_gestion',
])

export const rolDeclaranteEnum = pgEnum('rol_declarante', [
  'profesional',
  'recepcion',
  'desconocido',
])

export const confianzaEnum = pgEnum('confianza', ['alta', 'media', 'baja'])

export const eventoConversacionEnum = pgEnum('evento_conversacion', [
  'congreso',
  'entrevista',
  'referido',
])

export const casoMostradoEnum = pgEnum('caso_mostrado', ['no', 'territorio_1', 'territorio_2'])

export const peldanoEnum = pgEnum('peldano', ['nada', 'carta', 'anticipo'])

/** Los cinco bloques del puntaje. Es la columna vertebral del informe. */
export const bloquePuntajeEnum = pgEnum('bloque_puntaje', [
  'visibilidad',
  'reputacion',
  'contenido',
  'respuesta',
  'reservabilidad',
])

export const direccionIndicadorEnum = pgEnum('direccion_indicador', [
  'mas_es_mejor',
  'menos_es_mejor',
])
