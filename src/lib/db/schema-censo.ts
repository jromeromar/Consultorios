/**
 * Esquema del censo de ortodoncia · 22 tablas · v1.4 del documento de tablas y
 * campos.
 *
 * Dos criterios del documento que explican por qué el esquema tiene esta forma,
 * y que hay que respetar al añadir cualquier cosa:
 *
 *  1. Una medición se gana su propia tabla si se va a volver a medir y puede dar
 *     distinto. Población, volumen de búsqueda, calificación, seguidores y
 *     posición en el mapa cumplen las dos, y por eso ninguna es una columna de
 *     su entidad.
 *  2. `consultorio` guarda identificadores y decisiones del equipo. Nada de lo
 *     que Google publica vive ahí: nombre, categoría, dirección, teléfono,
 *     dominio y redes están en `consultorio_snapshot` con su fecha. La
 *     deduplicación por teléfono o dominio corre contra la captura más reciente.
 *
 * Convenciones: minúscula con guion bajo y sin tildes; municipio por código DANE
 * de 5 dígitos; teléfonos en E.164; dominios sin protocolo ni www; dinero en
 * pesos enteros; tiempos en minutos enteros; fechas ISO con zona de Bogotá;
 * `cid` siempre como texto. Los campos que dependen de que hubo respuesta van
 * nulos —no falsos— cuando no la hubo.
 */

import {
  bigint,
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// Los enums viven en su propio archivo por legibilidad, pero se reexportan aquí
// para que drizzle-kit los vea y emita los CREATE TYPE de la migración.
export * from './censo-enums'

import {
  ambitoTipoEnum,
  baseLegalEnum,
  baseObservacionEnum,
  bloquePuntajeEnum,
  bloqueSerpEnum,
  campoDeclaradoEnum,
  canalCampoEnum,
  casoMostradoEnum,
  categoriaCiudadEnum,
  confianzaEnum,
  conjuntoConsultasEnum,
  declaradoSiNoEnum,
  destinoEnlaceEnum,
  dioPrecioEnum,
  direccionIndicadorEnum,
  dispositivoEnum,
  estadoEnvioEnum,
  estadoPerfilDirectorioEnum,
  estadoRastreoEnum,
  estadoRegistroEnum,
  estadoTerritorioEnum,
  eventoConversacionEnum,
  eventoDeclaradoEnum,
  franjaHorariaEnum,
  fuenteCapturaEnum,
  fuenteGeoEnum,
  fuenteListadoEnum,
  herramientaKeywordsEnum,
  indicadorGeoEnum,
  metodoEmparejamientoEnum,
  observadoEnum,
  pasarelaEnum,
  peldanoEnum,
  plataformaAgendaEnum,
  rolDeclaranteEnum,
  tipoEstablecimientoEnum,
  tipoIntencionEnum,
  tipoRespondedorEnum,
  tipoTerritorioEnum,
  tipoUnidadEnum,
  ventanaKeywordsEnum,
  verticalEnum,
} from './censo-enums'

/** Dinero en pesos colombianos enteros. Un bigint aguanta cualquier cifra COP. */
const cop = (name: string) => bigint(name, { mode: 'number' })

// ═══════════════════════════════════════════════════════════════════════════
// Familia 1 · Identidad y territorio — cambian poco, se corrigen en sitio
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dimensión territorial pura: solo lo que no se vuelve a medir. La población
 * está en `indicadorGeografico` y el volumen de búsqueda en `volumenBusqueda`,
 * porque las dos son mediciones con fecha y fuente.
 */
export const municipio = pgTable('municipio', {
  municipioId: varchar('municipio_id', { length: 5 }).primaryKey(),
  nombreMunicipio: text('nombre_municipio').notNull(),
  departamento: text('departamento').notNull(),
  departamentoId: varchar('departamento_id', { length: 2 }).notNull(),
  /** Define el corte del informe. */
  categoriaCiudad: categoriaCiudadEnum('categoria_ciudad').notNull(),
  /** Impide vender por separado dos municipios conurbados. */
  areaMetropolitana: text('area_metropolitana'),
  esCabeceraDeArea: boolean('es_cabecera_de_area').notNull().default(false),
})

/**
 * Cualquier cifra medida sobre un territorio que no sea de búsqueda. Formato
 * largo, para no abrir una columna nueva cada vez.
 *
 * La población vive aquí y no en `municipio` porque el DANE la revisa cada año y
 * porque el umbral poblacional decide qué territorios son vendibles: hay que
 * poder responder con qué cifra se tomó esa decisión.
 */
export const indicadorGeografico = pgTable(
  'indicador_geografico',
  {
    indicadorGeoId: uuid('indicador_geo_id').primaryKey().defaultRandom(),
    ambitoTipo: ambitoTipoEnum('ambito_tipo').notNull(),
    /** Código DANE, código de localidad o territorio_id. */
    ambitoId: text('ambito_id').notNull(),
    indicador: indicadorGeoEnum('indicador').notNull(),
    /** Año o periodo al que se refiere la cifra, no la fecha en que se consultó. */
    periodo: text('periodo').notNull(),
    valor: numeric('valor').notNull(),
    /** habitantes · establecimientos · profesionales */
    unidad: text('unidad').notNull(),
    fuente: fuenteGeoEnum('fuente').notNull(),
    /** El DANE revisa las series hacia atrás; sin esto dos cifras del mismo año se contradicen. */
    versionSerie: text('version_serie'),
    fechaCaptura: date('fecha_captura').notNull(),
    nota: text('nota'),
  },
  (t) => [
    uniqueIndex('indicador_geografico_clave_unica').on(
      t.ambitoTipo,
      t.ambitoId,
      t.indicador,
      t.periodo,
      t.fuente,
      t.versionSerie,
    ),
    index('indicador_geografico_ambito_idx').on(t.ambitoTipo, t.ambitoId, t.indicador),
  ],
)

/**
 * El conjunto de consultas sobre el que se mide la demanda. Es tabla porque el
 * conjunto cambia y porque sin él una cifra de volumen no se puede interpretar:
 * no se sabe qué se sumó.
 */
export const consulta = pgTable(
  'consulta',
  {
    consultaId: uuid('consulta_id').primaryKey().defaultRandom(),
    /** Tal como se le pasa a la herramienta, con tildes y en el orden real. */
    consultaTexto: text('consulta_texto').notNull(),
    /** Sin tildes y en orden canónico. Dos filas con la misma normalizada son la misma consulta y no se suman. */
    consultaNormalizada: text('consulta_normalizada').notNull(),
    vertical: verticalEnum('vertical').notNull(),
    /** Las de precio se cuentan como comerciales aunque la herramienta las clasifique como informativas. */
    tipoIntencion: tipoIntencionEnum('tipo_intencion').notNull(),
    /** El calificador puede ser la demanda: la misma consulta sin él puede dar cero. */
    llevaCalificadorGeografico: boolean('lleva_calificador_geografico').notNull(),
    /** Un volumen solo es comparable con otro del mismo conjunto. */
    conjunto: conjuntoConsultasEnum('conjunto').notNull(),
    vigenteDesde: date('vigente_desde').notNull(),
    /** Se desactiva en vez de borrarse, para que las mediciones viejas se sigan pudiendo interpretar. */
    activa: boolean('activa').notNull().default(true),
  },
  (t) => [uniqueIndex('consulta_normalizada_unica').on(t.consultaNormalizada)],
)

/**
 * La demanda medida. Es una observación con fecha, no un atributo del municipio:
 * cambia con la estación, cambia si se amplía el conjunto de consultas y cambia
 * según la herramienta.
 */
export const volumenBusqueda = pgTable(
  'volumen_busqueda',
  {
    volumenId: uuid('volumen_id').primaryKey().defaultRandom(),
    consultaId: uuid('consulta_id')
      .notNull()
      .references(() => consulta.consultaId, { onDelete: 'restrict' }),
    ambitoTipo: ambitoTipoEnum('ambito_tipo').notNull(),
    /** Nulo cuando el ámbito es el país. */
    ambitoId: text('ambito_id'),
    fechaCaptura: date('fecha_captura').notNull(),
    /** La misma consulta da cifras distintas según la herramienta. */
    herramienta: herramientaKeywordsEnum('herramienta').notNull(),
    /** El identificador de ubicación que se le pasó a la herramienta. Ya hubo un error por usar el de otro país. */
    locId: text('loc_id'),
    /** Sobre qué periodo promedia la herramienta. */
    ventana: ventanaKeywordsEnum('ventana'),
    volumenMes: integer('volumen_mes'),
    /** Alimenta el costo de pauta por reserva pagada. */
    cpcEstimado: cop('cpc_estimado'),
    /** 0 a 1. Un valor bajo puede ser subasta cerrada, no vacía. */
    competenciaPagada: numeric('competencia_pagada'),
    /** 0 a 100, para esa consulta y ese ámbito. Es el arbitraje geográfico. */
    dificultadSeo: integer('dificultad_seo'),
    nota: text('nota'),
  },
  (t) => [
    uniqueIndex('volumen_busqueda_clave_unica').on(
      t.consultaId,
      t.ambitoTipo,
      t.ambitoId,
      t.fechaCaptura,
      t.herramienta,
    ),
    index('volumen_busqueda_ambito_idx').on(t.ambitoTipo, t.ambitoId),
  ],
)

/**
 * Subdivisión de un municipio con frontera verificable. Hoy solo aplica a
 * Bogotá, que no se puede vender entera a un consultorio. No vive en la
 * jerarquía DANE: hay que traerla de la fuente distrital.
 */
export const localidad = pgTable('localidad', {
  localidadId: text('localidad_id').primaryKey(),
  municipioId: varchar('municipio_id', { length: 5 })
    .notNull()
    .references(() => municipio.municipioId),
  nombreLocalidad: text('nombre_localidad').notNull(),
})

/**
 * Lo que se vende en exclusiva. No es lo mismo que un municipio: hacia abajo se
 * parte en localidades cuando el municipio es demasiado grande, y hacia arriba
 * agrupa municipios conurbados, porque vender un municipio de un área
 * metropolitana por separado no protege a nadie.
 */
export const territorio = pgTable('territorio', {
  territorioId: uuid('territorio_id').primaryKey().defaultRandom(),
  /** El nombre que aparece en el contrato. */
  nombreTerritorio: text('nombre_territorio').notNull(),
  tipo: tipoTerritorioEnum('tipo').notNull(),
  /** Suma sobre indicador_geografico. Se cruza contra el umbral poblacional. */
  poblacionTotal: integer('poblacion_total'),
  poblacionPeriodo: text('poblacion_periodo'),
  /** Con qué fuente y versión de serie se calculó. */
  poblacionFuente: text('poblacion_fuente'),
  /** Suma sobre volumen_busqueda. Decide si el territorio puede producir reservas. */
  volumenBusquedaMes: integer('volumen_busqueda_mes'),
  /** Qué conjunto de consultas se sumó. Sin esto la cifra no es comparable. */
  volumenConjunto: conjuntoConsultasEnum('volumen_conjunto'),
  volumenFechaCaptura: date('volumen_fecha_captura'),
  /** Contra la banda del documento de umbral, no contra una impresión. */
  pasaUmbralPoblacional: boolean('pasa_umbral_poblacional'),
  estado: estadoTerritorioEnum('estado').notNull().default('libre'),
  /** Nulo si está libre. Uno solo por territorio. */
  consultorioIdAsignado: uuid('consultorio_id_asignado'),
  fechaReserva: date('fecha_reserva'),
  /** Una reserva sin vencimiento bloquea el territorio para siempre. */
  fechaVencimientoReserva: date('fecha_vencimiento_reserva'),
})

/**
 * Hace verificable la exclusividad: sin esta tabla, dos contratos pueden
 * solaparse sin que nadie lo note hasta que los dos clientes ven el mismo
 * anuncio. El índice único sobre (tipo_unidad, unidad_id) es el que impide que
 * una unidad pertenezca a dos territorios a la vez.
 */
export const territorioUnidad = pgTable(
  'territorio_unidad',
  {
    territorioId: uuid('territorio_id')
      .notNull()
      .references(() => territorio.territorioId, { onDelete: 'cascade' }),
    tipoUnidad: tipoUnidadEnum('tipo_unidad').notNull(),
    /** Código DANE de cinco dígitos o código de localidad. */
    unidadId: text('unidad_id').notNull(),
    /** Por qué esta unidad quedó en este territorio. */
    nota: text('nota'),
  },
  (t) => [
    primaryKey({ columns: [t.territorioId, t.tipoUnidad, t.unidadId] }),
    uniqueIndex('territorio_unidad_exclusividad').on(t.tipoUnidad, t.unidadId),
  ],
)

/**
 * La columna vertebral, y solo eso: identificadores y decisiones del equipo.
 * Nada de lo que Google publica, porque todo eso se vuelve a capturar y puede
 * cambiar — vive en `consultorioSnapshot`.
 */
export const consultorio = pgTable(
  'consultorio',
  {
    /** Clave interna propia. Ningún identificador de Google es la clave primaria. */
    consultorioId: uuid('consultorio_id').primaryKey().defaultRandom(),
    /**
     * Ancla de identidad. No expira. Va como TEXTO: tiene hasta 20 dígitos y
     * cualquier hoja de cálculo lo corrompe si lo trata como número.
     */
    cid: text('cid'),
    /** Llave de trabajo contra herramientas de Google. Formato ChIJ… Puede cambiar. */
    placeId: text('place_id'),
    /** Google recomienda refrescar a los 12 meses. */
    placeIdVerificadoFecha: date('place_id_verificado_fecha'),
    /** Feature ID hexadecimal 0x…:0x… Misma entidad que el cid en otra notación. */
    googleId: text('google_id'),
    /** NO es llave: viene vacío en muchos negocios y una cadena puede compartirlo. Señal de cadena. */
    kgmid: text('kgmid'),
    /** Decisión de alcance del equipo, no un dato de Google. Define quién entra al universo. */
    esOrtodoncia: boolean('es_ortodoncia'),
    tipoEstablecimiento: tipoEstablecimientoEnum('tipo_establecimiento'),
    estadoRegistro: estadoRegistroEnum('estado_registro').notNull().default('activo'),
    /** Apunta al registro principal cuando este es duplicado. */
    consultorioIdMaestro: uuid('consultorio_id_maestro'),
    /** Qué llave lo delató: mismo cid, teléfono, dominio o kgmid. */
    motivoDuplicado: text('motivo_duplicado'),
    fuenteListado: fuenteListadoEnum('fuente_listado'),
    enMuestraEstudio: boolean('en_muestra_estudio').notNull().default(false),
    /** Para poder decir cómo se escogió la muestra. */
    estratoMuestra: text('estrato_muestra'),
    /** Primera vez que apareció en una captura. */
    fechaAlta: date('fecha_alta'),
    /** Se recalcula desde consultorio_snapshot. */
    fechaUltimaCaptura: date('fecha_ultima_captura'),
  },
  (t) => [
    uniqueIndex('consultorio_cid_unico').on(t.cid),
    index('consultorio_place_id_idx').on(t.placeId),
    index('consultorio_universo_idx').on(t.esOrtodoncia, t.estadoRegistro),
  ],
)

/**
 * Datos de persona identificable · ACCESO RESTRINGIDO.
 *
 * Existe solo si sirve al carril de contacto comercial y si la revisión legal lo
 * autoriza; el estudio no la necesita para nada. No se une con ninguna vista de
 * análisis ni de publicación.
 */
export const consultorioContacto = pgTable('consultorio_contacto', {
  contactoId: uuid('contacto_id').primaryKey().defaultRandom(),
  consultorioId: uuid('consultorio_id')
    .notNull()
    .references(() => consultorio.consultorioId, { onDelete: 'cascade' }),
  nombreCompleto: text('nombre_completo'),
  cargo: text('cargo'),
  email: text('email'),
  emailEstadoValidacion: text('email_estado_validacion'),
  telefonoContactoE164: text('telefono_contacto_e164'),
  perfilLinkedin: text('perfil_linkedin'),
  perfilInstagram: text('perfil_instagram'),
  /** Lo define la revisión legal. */
  baseLegal: baseLegalEnum('base_legal'),
  fechaCaptura: date('fecha_captura'),
  /** Si alguien pide que se le borre, queda registrado. */
  fechaSolicitudSupresion: date('fecha_solicitud_supresion'),
})

// ═══════════════════════════════════════════════════════════════════════════
// Familia 2 · Observación pública — una fila por captura, solo crecen
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Todo lo que Google publica del establecimiento, con la fecha en que se leyó.
 * Nombre, dirección, teléfono, dominio y categoría están aquí porque los cinco
 * cambian y los cinco se vuelven a capturar. La deduplicación por teléfono o por
 * dominio corre contra la captura más reciente, no contra la ficha de identidad.
 */
export const consultorioSnapshot = pgTable(
  'consultorio_snapshot',
  {
    snapshotId: uuid('snapshot_id').primaryKey().defaultRandom(),
    consultorioId: uuid('consultorio_id')
      .notNull()
      .references(() => consultorio.consultorioId, { onDelete: 'cascade' }),
    fechaCaptura: date('fecha_captura').notNull(),
    fuenteCaptura: fuenteCapturaEnum('fuente_captura').notNull(),

    /** Cambia: un consultorio se renombra y la ficha lo refleja. */
    nombreComercial: text('nombre_comercial'),
    /** Minúsculas, sin tildes, sin sufijos societarios. Llave de deduplicación. */
    nombreNormalizado: text('nombre_normalizado'),
    /**
     * Un consultorio de ortodoncia listado como «Dentista» no aparece en su
     * propia especialidad. Es indicador del bloque de visibilidad.
     */
    categoriaPrincipal: text('categoria_principal'),
    /** Lista separada por punto y coma. */
    subtipos: text('subtipos'),
    /** Google lo marca. Alimenta estado_registro, no lo reemplaza. */
    estaCerradoPermanente: boolean('esta_cerrado_permanente'),

    /** No entra a la sábana de publicación. */
    direccion: text('direccion'),
    codigoPostal: text('codigo_postal'),
    latitud: numeric('latitud'),
    longitud: numeric('longitud'),
    /** Agrupa por zona sin exponer la dirección. */
    h3: text('h3'),
    /** No es identificador: dos negocios del mismo edificio comparten uno. */
    plusCode: text('plus_code'),
    /** Resuelto desde la dirección de esta captura. El municipio del consultorio sale de aquí. */
    municipioId: varchar('municipio_id', { length: 5 }),
    /** Opcional. Se guarda y no se analiza en esta edición. */
    centroPobladoId: varchar('centro_poblado_id', { length: 8 }),
    /** Solo Bogotá. Se resuelve por geocodificación. */
    localidadId: text('localidad_id'),

    /** Normalizado. Llave de deduplicación y canal al que escribe el bot. */
    telefonoE164: text('telefono_e164'),
    telefonoOriginal: text('telefono_original'),
    /** Sin protocolo ni www. Llave de deduplicación y unión con sitio_snapshot. */
    dominio: text('dominio'),
    sitioWebUrl: text('sitio_web_url'),
    /** Sin arroba. Une con instagram_snapshot. */
    instagramHandle: text('instagram_handle'),
    facebookUrl: text('facebook_url'),
    /** Negocio sin dirección visible. Cambia cómo se interpreta la visibilidad local. */
    esAreaDeServicio: boolean('es_area_de_servicio'),

    /** Bloque de reputación. */
    calificacion: numeric('calificacion'),
    resenasTotal: integer('resenas_total'),
    /** Recencia. Si no se puede extraer, se declara no medida (nulo). */
    fechaResenaMasReciente: date('fecha_resena_mas_reciente'),
    /** Se calcula desde la tabla resena. */
    resenasRespondidasPct: numeric('resenas_respondidas_pct'),
    tieneHorarioPublicado: boolean('tiene_horario_publicado'),
    fotosN: integer('fotos_n'),
  },
  (t) => [
    uniqueIndex('consultorio_snapshot_clave_unica').on(t.consultorioId, t.fechaCaptura),
    index('consultorio_snapshot_municipio_idx').on(t.municipioId, t.fechaCaptura),
    index('consultorio_snapshot_telefono_idx').on(t.telefonoE164),
    index('consultorio_snapshot_dominio_idx').on(t.dominio),
  ],
)

/**
 * Lo que se rastrea del sitio propio del consultorio. Va aparte de la ficha de
 * Google porque es otro proceso, con otra fecha y otro modo de fallar: el sitio
 * puede estar caído el día que la ficha se leyó sin problema, y una sola fecha
 * para las dos cosas sería falsa para la mitad de las columnas.
 */
export const sitioSnapshot = pgTable(
  'sitio_snapshot',
  {
    sitioSnapshotId: uuid('sitio_snapshot_id').primaryKey().defaultRandom(),
    consultorioId: uuid('consultorio_id')
      .notNull()
      .references(() => consultorio.consultorioId, { onDelete: 'cascade' }),
    /** El que tenía la ficha en la captura correspondiente. */
    dominio: text('dominio'),
    fechaRastreo: date('fecha_rastreo').notNull(),
    /** Un error no es un cero. */
    estadoRastreo: estadoRastreoEnum('estado_rastreo').notNull(),

    websiteTitle: text('website_title'),
    websiteDescription: text('website_description'),
    websiteGenerator: text('website_generator'),
    /** Señal de que alguien mide. */
    tieneGtm: boolean('tiene_gtm'),
    /** Señal de que alguien pauta. */
    tienePixelMeta: boolean('tiene_pixel_meta'),
    /** Alimenta la decisión de integrar. Es el hallazgo lateral más valioso del censo. */
    plataformaAgendaDetectada: plataformaAgendaEnum('plataforma_agenda_detectada'),
    /** Bloque de reservabilidad. */
    tieneReservaOnline: boolean('tiene_reserva_online'),
    tienePagoEnLinea: boolean('tiene_pago_en_linea'),
    pasarelaDetectada: pasarelaEnum('pasarela_detectada'),
    esMovilResponsive: boolean('es_movil_responsive'),
    /** Opcional. Cuesta una llamada extra por sitio. */
    puntajeVelocidadMovil: integer('puntaje_velocidad_movil'),
  },
  (t) => [uniqueIndex('sitio_snapshot_clave_unica').on(t.consultorioId, t.fechaRastreo)],
)

/**
 * Opcional en la primera edición y decisiva a partir de la segunda: es la única
 * forma de calcular recencia y tasa de respuesta en cualquier ventana sin haber
 * capturado antes. No guarda el texto ni el autor: no hacen falta y suben el
 * riesgo.
 */
export const resena = pgTable(
  'resena',
  {
    resenaId: uuid('resena_id').primaryKey().defaultRandom(),
    consultorioId: uuid('consultorio_id')
      .notNull()
      .references(() => consultorio.consultorioId, { onDelete: 'cascade' }),
    fechaPublicacion: date('fecha_publicacion'),
    /** 1 a 5. */
    calificacion: integer('calificacion'),
    tieneRespuestaDelNegocio: boolean('tiene_respuesta_del_negocio'),
    /** Nulo si no hubo respuesta, no cero. */
    diasHastaRespuesta: integer('dias_hasta_respuesta'),
    fechaCaptura: date('fecha_captura').notNull(),
  },
  (t) => [index('resena_consultorio_idx').on(t.consultorioId, t.fechaPublicacion)],
)

/**
 * Resultados de búsqueda local. El grano no es el consultorio sino la posición:
 * una consulta devuelve varios resultados y un consultorio aparece en varias
 * consultas. Guarda cómo se emparejó cada resultado, porque esa unión es la más
 * frágil del modelo.
 */
export const serpLocal = pgTable(
  'serp_local',
  {
    serpId: uuid('serp_id').primaryKey().defaultRandom(),
    /** Tal como se envió. */
    consultaTexto: text('consulta_texto').notNull(),
    /** Sin tildes y en orden canónico. Evita contar dos veces la misma consulta. */
    consultaNormalizada: text('consulta_normalizada').notNull(),
    municipioId: varchar('municipio_id', { length: 5 }).notNull(),
    fechaConsulta: date('fecha_consulta').notNull(),
    /** No dan el mismo resultado. */
    dispositivo: dispositivoEnum('dispositivo').notNull(),
    bloque: bloqueSerpEnum('bloque').notNull(),
    posicion: integer('posicion').notNull(),
    /** Se guarda para poder auditar el emparejamiento. */
    nombreResultadoCrudo: text('nombre_resultado_crudo'),
    /** Nulo si no se logró emparejar. */
    consultorioId: uuid('consultorio_id').references(() => consultorio.consultorioId, {
      onDelete: 'set null',
    }),
    metodoEmparejamiento: metodoEmparejamientoEnum('metodo_emparejamiento').notNull(),
    /** 0 a 1. Por debajo del umbral, la fila no entra al análisis. */
    confianzaEmparejamiento: numeric('confianza_emparejamiento'),
  },
  (t) => [
    uniqueIndex('serp_local_clave_unica').on(
      t.consultaNormalizada,
      t.municipioId,
      t.fechaConsulta,
      t.dispositivo,
      t.bloque,
      t.posicion,
    ),
    index('serp_local_consultorio_idx').on(t.consultorioId, t.fechaConsulta),
  ],
)

/**
 * Bloque de contenido y redes. Se une por el handle que ya trae la ficha de
 * Google, así que el emparejamiento es directo cuando existe y no existe para el
 * que no publica su cuenta — lo cual también es un dato.
 */
export const instagramSnapshot = pgTable(
  'instagram_snapshot',
  {
    igSnapshotId: uuid('ig_snapshot_id').primaryKey().defaultRandom(),
    /** Nulo si la cuenta no se pudo emparejar. */
    consultorioId: uuid('consultorio_id').references(() => consultorio.consultorioId, {
      onDelete: 'set null',
    }),
    handle: text('handle').notNull(),
    fechaCaptura: date('fecha_captura').notNull(),
    seguidores: integer('seguidores'),
    publicacionesTotal: integer('publicaciones_total'),
    publicaciones30d: integer('publicaciones_30d'),
    /** Reacciones y comentarios sobre seguidores, por publicación. */
    interaccionPromedioPct: numeric('interaccion_promedio_pct'),
    ultimaPublicacionFecha: date('ultima_publicacion_fecha'),
    tieneEnlaceEnBio: boolean('tiene_enlace_en_bio'),
    destinoEnlace: destinoEnlaceEnum('destino_enlace'),
    esCuentaProfesional: boolean('es_cuenta_profesional'),
    /** Señal de madurez y de riesgo de política publicitaria. */
    publicaAntesDespues: boolean('publica_antes_despues'),
  },
  (t) => [uniqueIndex('instagram_snapshot_clave_unica').on(t.handle, t.fechaCaptura)],
)

// ═══════════════════════════════════════════════════════════════════════════
// Familia 3 · Trabajo de campo — el bot que escribe como paciente
// ═══════════════════════════════════════════════════════════════════════════

/**
 * La compuerta E4 exige declarar cómo se hizo la consulta. Si el texto cambia a
 * mitad del campo y no queda registrado, los datos de antes y después dejan de
 * ser comparables y nadie se entera.
 */
export const guion = pgTable('guion', {
  guionId: uuid('guion_id').primaryKey().defaultRandom(),
  version: text('version').notNull(),
  canal: canalCampoEnum('canal').notNull(),
  /** Literal. No usa lenguaje técnico ni la palabra valoración. */
  texto: text('texto').notNull(),
  vigenteDesde: date('vigente_desde').notNull(),
  vigenteHasta: date('vigente_hasta'),
})

/**
 * El corazón del estudio. Una fila por consultorio y por edición, con la
 * codificación de lo que pasó.
 *
 * Todos los campos que dependen de que haya habido respuesta son NULOS —no
 * falsos— cuando no la hubo. `huboRespuesta` es la compuerta del denominador de
 * todo lo que sigue.
 */
export const contactoCampo = pgTable(
  'contacto_campo',
  {
    contactoCampoId: uuid('contacto_campo_id').primaryKey().defaultRandom(),
    consultorioId: uuid('consultorio_id')
      .notNull()
      .references(() => consultorio.consultorioId, { onDelete: 'cascade' }),
    edicionId: uuid('edicion_id').notNull(),
    guionId: uuid('guion_id').references(() => guion.guionId),
    canal: canalCampoEnum('canal').notNull(),
    /** El teléfono o handle exacto al que se escribió, copiado de la captura vigente ese día. */
    destinoUsado: text('destino_usado'),
    /** Qué número o cuenta se usó. Detecta bloqueos y sesgo por emisor. */
    emisorId: text('emisor_id'),
    enviadoEn: timestamp('enviado_en', { withTimezone: true }),
    diaSemana: integer('dia_semana'),
    /** Bloque del hallazgo del mediodía. */
    franjaHoraria: franjaHorariaEnum('franja_horaria'),
    estadoEnvio: estadoEnvioEnum('estado_envio'),

    /** Nulo si no respondió. */
    primeraRespuestaEn: timestamp('primera_respuesta_en', { withTimezone: true }),
    /** Nulo si no respondió. Nunca cero. */
    minutosPrimeraRespuesta: integer('minutos_primera_respuesta'),
    /** La compuerta del denominador de todo lo que sigue. */
    huboRespuesta: boolean('hubo_respuesta'),
    tipoPrimerRespondedor: tipoRespondedorEnum('tipo_primer_respondedor'),

    ofrecioAgendar: observadoEnum('ofrecio_agendar'),
    dioPrecio: dioPrecioEnum('dio_precio'),
    /** Lo dice el consultorio en el chat. */
    precioMinMencionado: cop('precio_min_mencionado'),
    precioMaxMencionado: cop('precio_max_mencionado'),
    mencionoCobroPrimeraCita: observadoEnum('menciono_cobro_primera_cita'),
    valorPrimeraCita: cop('valor_primera_cita'),
    abonaAlTratamiento: declaradoSiNoEnum('abona_al_tratamiento'),
    pidioDatosDelPaciente: observadoEnum('pidio_datos_del_paciente'),
    /** Segundo contacto sin que el paciente escribiera. */
    huboSeguimientoEspontaneo: observadoEnum('hubo_seguimiento_espontaneo'),
    minutosHastaSeguimiento: integer('minutos_hasta_seguimiento'),

    /** Quién interpretó la conversación. */
    codificadoPor: text('codificado_por'),
    codificadoEn: date('codificado_en'),
    /** Permite recodificar y comparar. */
    versionCodificacion: text('version_codificacion'),
    excluidoDelAnalisis: boolean('excluido_del_analisis').notNull().default(false),
    motivoExclusion: text('motivo_exclusion'),
  },
  (t) => [
    uniqueIndex('contacto_campo_clave_unica').on(t.consultorioId, t.edicionId, t.canal),
    index('contacto_campo_edicion_idx').on(t.edicionId),
  ],
)

/**
 * El registro crudo de la conversación. Es lo que permite cambiar la definición
 * de un indicador sin repetir el trabajo de campo, y lo que sostiene el método
 * si alguien pregunta cómo se decidió que un mensaje ofrecía agendar.
 */
export const mensajeCampo = pgTable(
  'mensaje_campo',
  {
    mensajeId: uuid('mensaje_id').primaryKey().defaultRandom(),
    contactoCampoId: uuid('contacto_campo_id')
      .notNull()
      .references(() => contactoCampo.contactoCampoId, { onDelete: 'cascade' }),
    /** 1 es el mensaje que se envió. */
    orden: integer('orden').notNull(),
    direccion: text('direccion').notNull(),
    enviadoEn: timestamp('enviado_en', { withTimezone: true }),
    /** Literal. Retención limitada por la política de datos. */
    texto: text('texto'),
    /** Señal, no conclusión: la conclusión va en contacto_campo. */
    pareceAutomatico: boolean('parece_automatico'),
  },
  (t) => [uniqueIndex('mensaje_campo_orden_unico').on(t.contactoCampoId, t.orden)],
)

// ═══════════════════════════════════════════════════════════════════════════
// Familia 4 · Declarado, estudio y salida
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Formato largo a propósito: los campos declarados van a cambiar y no se sabe
 * cuáles van a aparecer. Guardar el evento permite medir la distancia entre lo
 * que se dice en un chat, lo que se dice en una entrevista y lo que se dice en
 * un stand.
 */
export const datoDeclarado = pgTable(
  'dato_declarado',
  {
    declaradoId: uuid('declarado_id').primaryKey().defaultRandom(),
    consultorioId: uuid('consultorio_id')
      .notNull()
      .references(() => consultorio.consultorioId, { onDelete: 'cascade' }),
    fecha: date('fecha').notNull(),
    evento: eventoDeclaradoEnum('evento').notNull(),
    campo: campoDeclaradoEnum('campo').notNull(),
    valorTexto: text('valor_texto'),
    valorNumero: numeric('valor_numero'),
    valorBooleano: boolean('valor_booleano'),
    rolDeQuienDeclara: rolDeclaranteEnum('rol_de_quien_declara'),
    confianza: confianzaEnum('confianza'),
  },
  (t) => [index('dato_declarado_consultorio_idx').on(t.consultorioId, t.campo, t.fecha)],
)

/**
 * La ficha de conversación del stand o la entrevista. Vive aquí para que lo que
 * pase en un congreso se pueda cruzar con lo que el censo ya midió del mismo
 * consultorio, que es lo que convierte el stand en evidencia y no en anécdota.
 */
export const conversacionCalificada = pgTable('conversacion_calificada', {
  conversacionId: uuid('conversacion_id').primaryKey().defaultRandom(),
  /** Nulo si no se logró emparejar con el censo. */
  consultorioId: uuid('consultorio_id').references(() => consultorio.consultorioId, {
    onDelete: 'set null',
  }),
  fecha: date('fecha').notNull(),
  evento: eventoConversacionEnum('evento').notNull(),
  municipioId: varchar('municipio_id', { length: 5 }),
  anosEjercicio: integer('anos_ejercicio'),
  /** Se compara contra lo observado. */
  consultasMesDeclaradas: integer('consultas_mes_declaradas'),
  personaDedicadaMensajes: boolean('persona_dedicada_mensajes'),
  /** Se compara contra plataforma_agenda_detectada. */
  softwareGestion: text('software_gestion'),
  /** Filtro de admisión. Es el denominador de todas las métricas del stand. */
  esCalificada: boolean('es_calificada'),
  casoMostrado: casoMostradoEnum('caso_mostrado'),
  peldanoAlcanzado: peldanoEnum('peldano_alcanzado'),
  /** Literal, no resumida. */
  objecionFee: text('objecion_fee'),
  /** Literal. Es el precio medido de la marca desconocida. */
  objecionCredibilidad: text('objecion_credibilidad'),
  reconstruccionDelNombre: text('reconstruccion_del_nombre'),
})

/**
 * La ficha técnica del informe se genera desde esta tabla en vez de escribirse a
 * mano. Así la muestra que declara la portada y la que se usó para calcular no
 * pueden separarse.
 */
export const edicionEstudio = pgTable('edicion_estudio', {
  edicionId: uuid('edicion_id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  campoInicio: date('campo_inicio'),
  campoFin: date('campo_fin'),
  /** 48 en la primera edición. */
  corteRelojHoras: integer('corte_reloj_horas'),
  nUniverso: integer('n_universo'),
  nMuestra: integer('n_muestra'),
  /** El otro denominador. Los dos se publican. */
  nRespondio: integer('n_respondio'),
  /** Lista de códigos DANE. */
  municipiosIncluidos: text('municipios_incluidos'),
  versionFormula: text('version_formula'),
  publicadaEn: date('publicada_en'),
  notasMetodo: text('notas_metodo'),
})

/**
 * El percentil que un profesional vio en septiembre tiene que poder reproducirse
 * en diciembre. Sin versionar los pesos y las transformaciones, el mismo
 * consultorio con los mismos datos da dos resultados distintos y no hay forma de
 * explicar cuál es el bueno.
 */
export const formulaPuntaje = pgTable(
  'formula_puntaje',
  {
    version: text('version').notNull(),
    bloque: bloquePuntajeEnum('bloque').notNull(),
    indicador: text('indicador').notNull(),
    /** Los pesos de cada bloque suman 1. */
    peso: numeric('peso').notNull(),
    /** Cómo se lleva el indicador a una escala de 0 a 100. */
    transformacion: text('transformacion').notNull(),
    direccion: direccionIndicadorEnum('direccion').notNull(),
    vigenteDesde: date('vigente_desde').notNull(),
  },
  (t) => [primaryKey({ columns: [t.version, t.indicador] })],
)

/**
 * La sábana. Es SALIDA, no origen: se borra y se reconstruye entera cada vez que
 * cambia un dato o una fórmula. Ninguna corrección se hace aquí; se hace en la
 * tabla de origen y se vuelve a calcular.
 */
export const puntaje = pgTable(
  'puntaje',
  {
    consultorioId: uuid('consultorio_id')
      .notNull()
      .references(() => consultorio.consultorioId, { onDelete: 'cascade' }),
    edicionId: uuid('edicion_id')
      .notNull()
      .references(() => edicionEstudio.edicionId, { onDelete: 'cascade' }),

    puntajeVisibilidad: numeric('puntaje_visibilidad'),
    puntajeReputacion: numeric('puntaje_reputacion'),
    puntajeContenido: numeric('puntaje_contenido'),
    puntajeRespuesta: numeric('puntaje_respuesta'),
    puntajeReservabilidad: numeric('puntaje_reservabilidad'),
    /** Ponderado según formula_puntaje. */
    puntajeGeneral: numeric('puntaje_general'),

    /** Contra el total nacional. */
    percentilGeneral: integer('percentil_general'),
    percentilVisibilidad: numeric('percentil_visibilidad'),
    percentilReputacion: numeric('percentil_reputacion'),
    percentilContenido: numeric('percentil_contenido'),
    percentilRespuesta: numeric('percentil_respuesta'),
    percentilReservabilidad: numeric('percentil_reservabilidad'),
    /** Solo si el grupo llega al mínimo de observaciones. */
    percentilGrupoCiudad: integer('percentil_grupo_ciudad'),

    /** Cuáles quedaron sin datos. El reporte los muestra como no medidos. */
    bloquesNoMedidos: text('bloques_no_medidos'),
    versionFormula: text('version_formula'),
    calculadoEn: timestamp('calculado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.consultorioId, t.edicionId] }),
    index('puntaje_edicion_idx').on(t.edicionId),
  ],
)

// ── Directorios médicos ─────────────────────────────────────────────────────
//
// Tres tablas, por el criterio 1 del encabezado: la calificación y la posición
// de un consultorio dentro de un directorio se van a volver a medir y pueden
// dar distinto, así que ninguna es una columna de `consultorio`.
//
// Y por el mismo criterio va aparte de `consultorio_snapshot`: es otro proceso,
// con otra fecha y otro modo de fallar. Un directorio puede rechazar la lectura
// el día que la ficha de Google se leyó sin problema, y una sola fecha para las
// dos cosas sería falsa para la mitad de las columnas.

/**
 * El catálogo de directorios. Es tabla y no enum porque «los principales
 * directorios médicos» no es un vocabulario cerrado, y porque cada directorio
 * necesita decir de sí mismo tres cosas que un enum no puede guardar.
 */
export const directorio = pgTable('directorio', {
  /** Estable y legible: `doctoralia`, `topdoctors`. */
  directorioId: text('directorio_id').primaryKey(),
  nombre: text('nombre').notNull(),
  /** Sin protocolo ni www, igual que en el resto del esquema. */
  dominio: text('dominio').notNull(),

  /**
   * Si el directorio publica una calificación agregada. Cuando es falso, la
   * columna de calificación del snapshot queda nula por diseño y no por falta
   * de dato: son casos distintos y el informe los tiene que distinguir.
   */
  publicaCalificacion: boolean('publica_calificacion').notNull(),
  /**
   * Si tiene buscador propio con un orden. Es lo que hace medible «tu posición
   * dentro del directorio»; sin esto, `directorio_ranking` no aplica.
   */
  publicaOrden: boolean('publica_orden').notNull(),

  /**
   * Con qué derecho se lee. Obligatorio, así que ninguna captura puede correr
   * contra un directorio cuyos términos nadie revisó.
   */
  baseObservacion: baseObservacionEnum('base_observacion').notNull(),
  fechaRevisionTerminos: date('fecha_revision_terminos').notNull(),
  /** Qué se leyó y quién lo revisó. */
  notaTerminos: text('nota_terminos'),
})

/**
 * El perfil de un consultorio en un directorio, en una fecha.
 *
 * Todas las medidas van nulas salvo cuando `estado_perfil` es `ok` o
 * `sin_perfil`. Un `bloqueado` no deja ceros: deja nulos, y el consultorio sale
 * del denominador.
 */
export const directorioPerfilSnapshot = pgTable(
  'directorio_perfil_snapshot',
  {
    perfilSnapshotId: uuid('perfil_snapshot_id').primaryKey().defaultRandom(),
    consultorioId: uuid('consultorio_id')
      .notNull()
      .references(() => consultorio.consultorioId, { onDelete: 'cascade' }),
    directorioId: text('directorio_id')
      .notNull()
      .references(() => directorio.directorioId, { onDelete: 'restrict' }),
    fechaCaptura: date('fecha_captura').notNull(),
    estadoPerfil: estadoPerfilDirectorioEnum('estado_perfil').notNull(),

    /** Existe el perfil. Falso solo con `estado_perfil = sin_perfil`. */
    existe: boolean('existe'),
    urlPerfil: text('url_perfil'),
    /** El profesional lo reclamó. Un perfil que el directorio creó solo no cuenta igual. */
    estaReclamado: boolean('esta_reclamado'),
    estaVerificado: boolean('esta_verificado'),

    /** Nulo cuando el directorio no publica calificación. */
    calificacion: numeric('calificacion'),
    resenasTotal: integer('resenas_total'),
    fechaResenaMasReciente: date('fecha_resena_mas_reciente'),

    /** Completitud del perfil, que es lo que un paciente ve al abrirlo. */
    tieneFoto: boolean('tiene_foto'),
    tieneHorario: boolean('tiene_horario'),
    tienePrecio: boolean('tiene_precio'),
    serviciosN: integer('servicios_n'),

    /** Emparejamiento, con la misma disciplina que `serp_local`. */
    nombrePerfilCrudo: text('nombre_perfil_crudo'),
    metodoEmparejamiento: metodoEmparejamientoEnum('metodo_emparejamiento').notNull(),
    /** 0 a 1. Por debajo del umbral, la fila no entra al análisis. */
    confianzaEmparejamiento: numeric('confianza_emparejamiento'),
  },
  (t) => [
    uniqueIndex('directorio_perfil_clave_unica').on(
      t.consultorioId,
      t.directorioId,
      t.fechaCaptura,
    ),
    index('directorio_perfil_directorio_idx').on(t.directorioId, t.fechaCaptura),
  ],
)

/**
 * La posición de un consultorio dentro del buscador del propio directorio.
 *
 * Espeja `serp_local`, con una columna que aquella no tiene y que aquí es
 * obligatoria: `resultados_total`. La posición 8 de 9 y la posición 8 de 200 no
 * son el mismo hecho, y en este censo ninguna cifra se publica sin su
 * denominador.
 */
export const directorioRanking = pgTable(
  'directorio_ranking',
  {
    rankingId: uuid('ranking_id').primaryKey().defaultRandom(),
    directorioId: text('directorio_id')
      .notNull()
      .references(() => directorio.directorioId, { onDelete: 'restrict' }),

    /** Tal como se envió. */
    consultaTexto: text('consulta_texto').notNull(),
    /** Sin tildes y en orden canónico. Evita contar dos veces la misma consulta. */
    consultaNormalizada: text('consulta_normalizada').notNull(),
    municipioId: varchar('municipio_id', { length: 5 }).notNull(),
    fechaConsulta: date('fecha_consulta').notNull(),
    dispositivo: dispositivoEnum('dispositivo').notNull(),

    posicion: integer('posicion').notNull(),
    /** Cuántos resultados devolvió la consulta. Sin esto la posición no dice nada. */
    resultadosTotal: integer('resultados_total').notNull(),

    /** Se guarda para poder auditar el emparejamiento. */
    nombreResultadoCrudo: text('nombre_resultado_crudo'),
    /** Nulo si no se logró emparejar. */
    consultorioId: uuid('consultorio_id').references(() => consultorio.consultorioId, {
      onDelete: 'set null',
    }),
    metodoEmparejamiento: metodoEmparejamientoEnum('metodo_emparejamiento').notNull(),
    confianzaEmparejamiento: numeric('confianza_emparejamiento'),
  },
  (t) => [
    uniqueIndex('directorio_ranking_clave_unica').on(
      t.directorioId,
      t.consultaNormalizada,
      t.municipioId,
      t.fechaConsulta,
      t.dispositivo,
      t.posicion,
    ),
    index('directorio_ranking_consultorio_idx').on(t.consultorioId, t.fechaConsulta),
  ],
)
