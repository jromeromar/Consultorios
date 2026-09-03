/**
 * El copy de la landing, en un solo lugar.
 *
 * Fuente: copy-landing-reputacion.md v1.0 · 3 sep 2026.
 *
 * Cada decisión que el copy dejó abierta es un interruptor en `CONFIG`, no una
 * frase escondida en un componente. La página se renderiza honesta en los dos
 * estados de cada interruptor, así que publicar cuando una decisión se cierre es
 * cambiar un booleano.
 */

export const MARCA = {
  nombre: 'Kleia',
  /**
   * `kleos` es la palabra griega para el renombre: lo que se dice de alguien
   * cuando no está presente. La marca es la definición del servicio.
   */
  raiz: 'Del griego kleos: lo que se dice de alguien cuando no está delante.',
} as const

/**
 * Los pendientes de la sección 5 del copy, cada uno con su dueño.
 *
 * Ninguno lo puede cerrar el copy ni yo. Mientras estén en falso, la página dice
 * la verdad del estado actual en vez de afirmar lo que todavía no existe.
 */
export const CONFIG = {
  /**
   * Publicar precio es decisión de oferta (Mariana, revisión de Jaime). En falso
   * la sección no se renderiza; en verdadero sale completa con moneda,
   * periodicidad y condiciones en la misma pieza, como exige la Ley 1480.
   */
  mostrarPrecio: false,

  /**
   * El índice tiene una prueba de calibración obligatoria antes de publicarse
   * (Tania). En falso, los pesos salen marcados «versión 1, en calibración» y
   * NO se anuncia un margen de error que no existe.
   */
  indiceCalibrado: false,

  /**
   * «Está en el contrato» es verdad solo cuando el contrato exista con número
   * (Mariana). En falso, la cláusula dice que el umbral se acuerda por escrito.
   */
  umbralPausaDefinido: false,

  /**
   * La herramienta del índice todavía no existe. En falso, el formulario recibe
   * el nombre y dice con qué se va a responder, en vez de prometer un número en
   * un minuto que nadie puede entregar.
   */
  indiceDisponible: false,
} as const

// ── Arriba del pliegue ──────────────────────────────────────────────────────
//
// Dos médicos leyeron la versión anterior. Un anestesiólogo escribió «no
// entiendo», y no era la redacción: la página daba por hecho un recorrido de
// compra que él no tiene. Una pediatra preguntó en qué se diferencia de
// Doctoralia, porque nada arriba del pliegue lo decía.
//
// Por eso esta pantalla dice, en este orden: para quién es, qué hacemos, y en
// qué sitios. El número viene después.

export const PORTADA = {
  /**
   * Para quién es, como regla y no como lista, para que quien no encaje se
   * excluya en cuatro segundos en vez de concluir que la página no se entiende.
   */
  segmento: 'Para consultorios donde el paciente te elige buscando y paga de su bolsillo',

  h1: 'Lo que un paciente encuentra cuando te busca, medido en un número.',

  /** Alternativas para probar. */
  h1Alternativas: [
    'Nos encargamos de lo que un paciente encuentra cuando te busca.',
    'Lo que se dice de ti cuando no estás delante, medido.',
  ],

  subtitulo:
    'Tu ficha de Google, tus perfiles en Doctoralia y Top Doctors, tus reseñas y tu WhatsApp. ' +
    'Medimos qué encuentra ahí un paciente, te damos el número comparado con tu especialidad en ' +
    'tu ciudad, y después lo operamos cada mes.',

  /**
   * La frase de más confianza de la página, y la respuesta al anestesiólogo:
   * decir a quién NO le sirve cuesta un lector y gana la referencia.
   */
  noAplica:
    'Si tus pacientes te llegan por remisión o por EPS, esto todavía no te sirve, y preferimos ' +
    'decírtelo ahora.',

  cta: 'Ver mi Índice de Reputación',
  microcopy: 'Gratis. Solo con datos públicos. No pedimos acceso a nada tuyo.',
  campo: 'Nombre de tu consultorio como aparece en Google',
} as const

/**
 * Dónde miramos. Va arriba del pliegue porque es lo que responde de una vez las
 * dos preguntas del campo: qué hacen ustedes, y en qué se diferencian de
 * Doctoralia.
 *
 * Publicar la lista no es adorno: una cifra cuyo origen no puedes rastrear no
 * la puedes verificar, y verificable es lo único que este índice promete.
 */
export const FUENTES = {
  titulo: 'Dónde miramos',
  items: [
    {
      nombre: 'Google',
      detalle: 'Tu ficha, tus reseñas y tu posición en las búsquedas de tu ciudad.',
    },
    { nombre: 'Doctoralia', detalle: 'Si tienes perfil, tu calificación y en qué lugar sales.' },
    {
      nombre: 'Top Doctors',
      detalle: 'Igual: si tienes perfil, tu calificación y en qué lugar sales.',
    },
    { nombre: 'Tu sitio', detalle: 'Si abre en el celular y si dice precios.' },
    { nombre: 'Tu WhatsApp', detalle: 'Cuánto tarda en llegar la primera respuesta.' },
    { nombre: 'Tu agenda', detalle: 'Si un paciente puede tomar la cita solo.' },
  ],
  nota: 'Todo público. Nada de esto necesita que nos des una clave.',
} as const

// ══════════════════════════════════════════════════════════════════════════
// Las secciones, en tres niveles de profundidad
// ══════════════════════════════════════════════════════════════════════════
//
// Cada sección tiene los mismos tres niveles, y cada nivel se sostiene solo:
//
//   tag  · la pregunta que la sección responde, en la voz del lector
//   h2   · la respuesta en una frase. Leídos en orden, los h2 cuentan la
//          historia completa sin nada más. Es la prueba de la página.
//   h3   · la misma respuesta con un grado más de detalle
//   texto· la explicación
//
// Quien hace skimming lee los h2 y entiende. Quien se detiene lee los h3 y
// entiende mejor. Quien quiere el detalle lo tiene debajo.

// ── Hallazgos · sustituye a la barra de logos ───────────────────────────────

export const HECHOS = {
  tag: '¿Qué encontramos?',
  h2: 'Cinco de cinco no gestionan sus reseñas.',
  h3:
    'Entrevistamos profesionales de odontología y medicina estética en Colombia. Ninguno ' +
    'revisa lo que un paciente encuentra al buscarlo.',
  items: [
    {
      cifra: '5 de 5',
      texto: 'profesionales entrevistados no gestionan sus reseñas de Google.',
    },
    {
      cifra: '4 de 5',
      texto: 'no reciben un solo paciente por una búsqueda genérica de su especialidad.',
    },
    {
      cifra: 'Ninguno',
      texto: 'sabe cuántas personas le escriben y no agendan.',
    },
  ],
  fuente:
    'Entrevistas con profesionales de odontología y medicina estética en Colombia, 2026. ' +
    'Datos agregados y anónimos.',
} as const

// ── El problema ─────────────────────────────────────────────────────────────

export const PROBLEMA = {
  tag: '¿Qué está pasando?',
  h2: 'El paciente ya decidió antes de escribirte.',
  h3:
    'Compara cuatro fichas de Google en dos minutos y le escribe a una. Las otras tres no se ' +
    'enteran de que existió esa comparación.',
  parrafos: [
    'Busca su procedimiento en Google con la palabra «cuánto vale». Le aparecen cuatro ' +
      'consultorios. Abre las fichas. En una, la última reseña es de hace catorce meses y ' +
      'nadie la respondió. En otra hay veinte reseñas de este trimestre y todas tienen ' +
      'respuesta. Escribe a la segunda a las nueve de la noche. Le contestan en seis minutos, ' +
      'con precio y con cupo. A la primera ni le escribe.',
    'Nada de eso pasó dentro de tu consultorio. Pasó en la parte de tu reputación que existe ' +
      'pero no circula: la ficha, las reseñas, el tiempo de respuesta. Es la parte que ningún ' +
      'paciente te cuenta y que casi nadie mide.',
  ],
} as const

// ── Qué se puede medir ──────────────────────────────────────────────────────

export const DIMENSIONES = {
  tag: '¿Qué se puede medir?',
  h2: 'Esa decisión la toman cinco cosas, y todas se pueden ver.',
  h3:
    'Dónde apareces, qué dicen de ti, si te encuentran, qué tan rápido contestas y si pueden ' +
    'agendar solos. Cada una con su peso publicado.',
  intro:
    'Cinco cosas que un paciente puede ver hoy, y tú también. Los pesos están al lado de cada ' +
    'una y suman 100.',
  items: [
    {
      id: 'presencia',
      // Se llamaba «Presencia». Un médico no describe su consultorio así.
      nombre: 'Dónde apareces',
      peso: 20,
      texto:
        'Tu ficha de Google y tus perfiles en Doctoralia y Top Doctors: si existen, si están ' +
        'reclamados y si están completos. Y si tu sitio abre en el celular.',
    },
    {
      id: 'prueba-social',
      nombre: 'Qué dicen de ti',
      peso: 30,
      texto:
        'Tus reseñas y tu calificación en Google y en los directorios, frente a la mediana de ' +
        'tu especialidad en tu ciudad: cuántas tienes, hace cuánto fue la última, cuántas en ' +
        'los últimos 90 días y cuántas respondiste.',
    },
    {
      id: 'encontrabilidad',
      nombre: 'Si te encuentran',
      peso: 20,
      texto:
        'Si sales cuando alguien en tu ciudad busca tu especialidad o pregunta cuánto vale un ' +
        'procedimiento. En Google, y en qué lugar quedas dentro de cada directorio.',
    },
    {
      id: 'respuesta',
      nombre: 'Qué tan rápido contestas',
      peso: 20,
      texto:
        'Cuánto tardas en contestar el primer mensaje, si contestas fuera de horario, si das un ' +
        'precio o un rango, y si ofreces agendar.',
    },
    {
      id: 'reservabilidad',
      nombre: 'Si pueden agendar solos',
      peso: 10,
      texto:
        'Si un paciente puede ver tu disponibilidad y tomar la cita sin esperar a que alguien ' +
        'le confirme.',
    },
  ],
} as const

// ── En qué se diferencia de un directorio ───────────────────────────────────
//
// Esta sección existe porque una pediatra preguntó «¿y cuál sería la diferencia
// con Top Doctors, o Doctoralia?». Antes la respuesta estaba en la posición
// siete, en abstracto, y sin nombrar a nadie. Cuando no nombras aquello con lo
// que el lector te compara, el lector hace la comparación solo y la hace mal.

export const DIRECTORIOS = {
  tag: '¿Y en qué se diferencia de Doctoralia?',
  h2: 'Doctoralia y Top Doctors son dos de los sitios que medimos.',
  h3:
    'Ellos te venden un perfil dentro de su sitio, al lado de otros. Nosotros medimos ese ' +
    'perfil junto con todo lo demás, y operamos lo que es tuyo.',
  items: [
    {
      titulo: 'Un directorio te lista.',
      texto:
        'Te cobra por aparecer dentro de su sitio, al lado de otros consultorios, y el paciente ' +
        've la marca del directorio. Ese perfil es de ellos, no tuyo.',
    },
    {
      titulo: 'Nosotros lo medimos.',
      texto:
        'Tu posición y tu calificación en cada directorio entran en el número, junto con tu ' +
        'ficha de Google, tu sitio, tu WhatsApp y tu agenda. Un paciente no distingue entre ' +
        'sitios: mira lo que encuentra.',
    },
    {
      titulo: 'Y operamos lo que es tuyo.',
      texto:
        'El paciente nunca ve nuestra marca. Ve tu ficha, tu página y tu número. Si un día nos ' +
        'dejas, todo lo que montamos se queda contigo.',
    },
  ],
} as const

// ── Cómo se mide ────────────────────────────────────────────────────────────

export const INDICE = {
  tag: '¿Cómo lo medimos?',
  h2: 'Las cinco caben en un número que cualquiera puede recalcular.',
  h3:
    'Solo datos públicos y fórmula abierta. Y separamos lo que movimos de lo que no depende ' +
    'de nadie.',
  introCalibrado:
    'El Índice de Reputación se calcula con la fórmula y los pesos que están publicados, y ' +
    'cada cifra sale con su margen de error al lado.',
  introEnCalibracion:
    'El Índice de Reputación se calcula con la fórmula y los pesos que están publicados. Esta ' +
    'es la versión 1 y está en calibración: cuando la prueba cierre, cada cifra sale con su ' +
    'margen de error al lado.',
  insignia: 'Versión 1 · en calibración',
  reglas: [
    {
      titulo: 'Fórmula publicada.',
      textoCalibrado: 'Pesos y margen de error, al lado del número. Sin cifra sin su error.',
      textoEnCalibracion:
        'Los pesos están publicados aquí mismo. El margen de error se publica cuando la ' +
        'calibración cierre; hasta entonces no hay ninguno inventado en esta página.',
    },
    {
      titulo: 'Recomputable.',
      textoCalibrado:
        'Solo usa datos públicos. Si solo nosotros pudiéramos calcularlo, sería un truco de ' +
        'venta. Un índice que puedes verificar es un estándar.',
    },
    {
      titulo: 'Separa lo que movimos de lo que no depende de nadie.',
      textoCalibrado:
        'La distancia entre el paciente y tu consultorio también ordena los resultados. No la ' +
        'movemos, y el informe lo dice.',
    },
  ],
} as const

// ── Qué hacemos ─────────────────────────────────────────────────────────────

export const PALANCAS = {
  tag: '¿Qué hacemos?',
  h2: 'Movemos esas cinco. Nada más.',
  h3:
    'Una palanca por dimensión. Si algo no mueve el índice, no lo hacemos, aunque te lo hayan ' +
    'vendido en otra parte.',
  intro:
    'No es un menú y no hay planes. Son cinco palancas, una por cada cosa que se mide, y cada ' +
    'mes te mostramos cuál se movió.',
  items: [
    {
      dimension: 'Dónde apareces',
      texto:
        'Reclamamos y completamos tu ficha de Google y tus perfiles en Doctoralia y Top Doctors, ' +
        'y publicamos tu aviso de privacidad y tu política de datos en una URL propia. Después ' +
        'los mantenemos al día.',
    },
    {
      dimension: 'Qué dicen de ti',
      texto:
        'Después de cada cita, le pedimos reseña a quien asistió. Respondemos todas, las buenas ' +
        'y las malas, y recuperamos las históricas que quedaron sin respuesta.',
    },
    {
      dimension: 'Si te encuentran',
      texto:
        'Publicaciones en tu perfil y páginas por servicio apuntadas a lo que la gente de tu ' +
        'ciudad pregunta de verdad: cuánto vale. Cada pieza pasa por tu aprobación antes de ' +
        'publicarse, porque lo publicado te obliga a ti.',
    },
    {
      dimension: 'Qué tan rápido contestas',
      texto:
        'Tu número de WhatsApp atendido las veinticuatro horas para lo administrativo: precio, ' +
        'horario, agenda, recordatorio. Todo lo clínico se deriva a una persona de tu equipo. ' +
        'Siempre.',
    },
    {
      dimension: 'Si pueden agendar solos',
      texto:
        'Conectamos tu agenda para que el paciente vea disponibilidad real y la cita quede ' +
        'escrita sin que nadie la transcriba. Ninguna persona nuestra entra a tu software.',
    },
  ],
  /** La única promesa de la página, y es de conducta, no de resultado. */
  resenas: {
    titulo: 'No borramos reseñas. Las respondemos.',
    texto:
      'Sin incentivos de ningún tipo. Solo le pedimos reseña a quien asistió. No filtramos por ' +
      'sentimiento antes de pedir. Es lo único que mueve el perfil, y lo único que es legítimo.',
  },
} as const

// ── Cómo trabajar con nosotros ──────────────────────────────────────────────

export const PASOS = {
  tag: '¿Cómo trabajar con nosotros?',
  h2: 'Empiezas midiendo, y medir es gratis.',
  h3: 'Tres pasos: mides, entiendes, operamos. El primero toma un minuto y no compromete nada.',
  items: [
    {
      numero: 1,
      titulo: 'Mide.',
      texto:
        'Escribe el nombre de tu consultorio. Ves tu índice y tu percentil frente a tu ' +
        'especialidad en tu ciudad. Gratis, sin registro, sin acceso.',
    },
    {
      numero: 2,
      titulo: 'Entiende.',
      texto:
        'El informe completo desagrega las cinco dimensiones, te compara contra el benchmark de ' +
        'tu ciudad y trae el plan para cada una. Cuesta COP 490.000 y se abona íntegro al setup ' +
        'si contratas.',
    },
    {
      numero: 3,
      titulo: 'Opera.',
      texto:
        'Montamos las cinco palancas y las operamos cada mes. Cada mes recibes el índice, cómo ' +
        'se movió, y qué parte del movimiento fue nuestra.',
    },
  ],
  ctaSecundario: 'Pedir el informe completo',
} as const

// ── Lo que esto no es ───────────────────────────────────────────────────────

export const NO_SOMOS = {
  tag: '¿Qué más no somos?',
  h2: 'No somos una agencia de menú, ni un bot que habla por ti.',
  h3: 'No vendemos piezas por mes, y cualquier cosa clínica va a una persona de tu equipo.',
  items: [
    {
      titulo: 'No somos una agencia de menú.',
      texto:
        'No vendemos piezas por mes. Vendemos que cinco indicadores se muevan, y te mostramos ' +
        'si se movieron.',
    },
    {
      titulo: 'No somos un bot que habla por ti.',
      texto:
        'Lo que contesta en tu número solo hace lo administrativo. Un síntoma, una duda de ' +
        'idoneidad o cualquier cosa clínica va a una persona de tu equipo, por norma y por diseño.',
    },
  ],
} as const

// ── Precio ──────────────────────────────────────────────────────────────────

export const PRECIO = {
  tag: '¿Cuánto cuesta?',
  h2: 'Un servicio, tres precios. El alcance es el mismo.',
  h3: 'El tramo lo fija el tamaño de tu base de pacientes, no el alcance. Nadie recibe menos.',
  intro:
    'El tramo lo fija el tamaño de tu base de pacientes, porque es lo que determina el trabajo. ' +
    'No hay planes: nadie recibe menos.',
  tramos: ['Hasta 1.500 pacientes', 'Hasta 4.000', 'Más de 4.000'],
  filas: [
    {
      concepto: 'Setup, una vez',
      valores: ['COP 2.500.000', '3.500.000', '4.800.000'],
    },
    {
      concepto: 'Operación mensual',
      valores: ['1.000.000', '1.500.000', '2.200.000'],
    },
    {
      concepto: 'Contenido mensual, opcional',
      valores: ['800.000', '1.200.000', '1.800.000'],
    },
  ],
  pausaDefinida:
    'Si la operación no alcanza el umbral de entrega acordado durante dos meses seguidos, la ' +
    'operación mensual se pausa. Está en el contrato.',
  pausaSinDefinir:
    'Si la operación no alcanza el umbral de entrega acordado durante dos meses seguidos, la ' +
    'operación mensual se pausa. El umbral se acuerda por escrito antes de empezar.',
  contenido:
    'Va aparte porque su límite es tu tiempo de aprobación, no nuestra producción. Si ya pagas ' +
    'a alguien por redes y video, este módulo no se suma a ese gasto: lo reemplaza y lo mide.',
} as const

// ── Preguntas ───────────────────────────────────────────────────────────────

export const PREGUNTAS = {
  tag: '¿Qué nos preguntan?',
  h2: 'No prometemos resultados. Medimos, y el número lo ves tú primero.',
  h3:
    'Estas son las nueve preguntas que nos hacen antes de decir sí, en el orden en que ' +
    'aparecen de verdad: primero la categoría, al final el precio.',
  items: [
    {
      // Textual, de una pediatra.
      pregunta: '«¿Y cuál sería la diferencia con Top Doctors, o Doctoralia?»',
      respuesta:
        'Que ellos son dos de los sitios que medimos. Tu perfil ahí es de ellos y ahí estás al ' +
        'lado de otros consultorios. Nosotros medimos tu posición y tu calificación en esos ' +
        'sitios junto con tu ficha de Google, tu sitio y tu WhatsApp, y operamos lo que es ' +
        'tuyo. El paciente nunca ve nuestra marca.',
    },
    {
      // Textual, de un anestesiólogo que leyó la versión anterior.
      pregunta: '«Yo no recibo pacientes por Google.»',
      respuesta:
        'Entonces esto todavía no te sirve, y preferimos decírtelo. Kleia funciona donde el ' +
        'paciente te elige buscando y paga de su bolsillo. Si te llegan por remisión o por EPS, ' +
        'el número te va a salir bajo y no va a significar nada.',
    },
    {
      pregunta: '«Suena a que prometen y no cumplen.»',
      respuesta:
        'No prometemos. Medimos. Aquí está tu índice hoy y aquí va a estar cada mes, con lo que ' +
        'se movió y con lo que no. Si un mes no se mueve, lo vas a ver tú antes de que te lo ' +
        'digamos.',
    },
    {
      pregunta: '«Llevo veinticinco años en esto. No me hace falta.»',
      respuesta:
        'Puede ser. Mídete y compara contra tu ciudad. Si sales bien, te lo decimos y ahí ' +
        'termina. El índice es gratis precisamente para eso.',
    },
    {
      pregunta: '«Ya tengo quien me lleva las redes.»',
      respuesta:
        '¿Y cuántos pacientes produjo el mes pasado? Si no lo sabes, ese es el problema, no las ' +
        'redes. El módulo de contenido no se suma a ese gasto: lo reemplaza y le pone medición.',
    },
    {
      pregunta: '«Me da temor un sistema hablándole a mis pacientes.»',
      respuesta:
        'Solo hace lo administrativo: precio, horario, agenda, recordatorio. Cualquier cosa ' +
        'clínica se deriva a una persona de tu equipo. Es norma, y es como está diseñado.',
    },
    {
      pregunta: '«¿Ustedes borran las reseñas malas?»',
      respuesta: 'No. Las respondemos. Es lo que mueve el perfil y lo único que es legítimo.',
    },
    {
      pregunta: '«Es caro comparado con el directorio.»',
      respuesta:
        'El directorio cobra por listarte. Aquí se paga por que alguien opere tu ficha, tus ' +
        'reseñas y tu número, y por saber cada mes qué produjo.',
    },
    {
      pregunta: '«¿Y si no funciona?»',
      respuestaDefinida:
        'Si la operación no alcanza el umbral acordado dos meses seguidos, la mensualidad se ' +
        'pausa. Está en el contrato.',
      respuestaSinDefinir:
        'Si la operación no alcanza el umbral acordado dos meses seguidos, la mensualidad se ' +
        'pausa. El umbral se acuerda por escrito antes de empezar.',
    },
  ],
} as const

// ── Cierre ──────────────────────────────────────────────────────────────────

export const CIERRE = {
  tag: '¿Por dónde empezamos?',
  h2: 'Tu reputación ya existe. Solo falta medirla.',
  h3: 'Un minuto y el nombre de tu consultorio. Sin registro y sin darnos acceso a nada.',
  cuerpo:
    'Un minuto, el nombre de tu consultorio, y ves lo que un paciente ve. Gratis, sin registro ' +
    'y sin darnos acceso a nada.',
  cta: PORTADA.cta,
  microcopy: 'Datos públicos. Fórmula publicada. Recalculable por cualquiera.',
} as const

/**
 * El orden de la página. Es también la prueba: leídos en orden, los `h2` de esta
 * lista tienen que contar la historia completa sin ayuda de nada más.
 */
export const SECCIONES = [
  HECHOS,
  PROBLEMA,
  DIMENSIONES,
  DIRECTORIOS,
  INDICE,
  PALANCAS,
  PASOS,
  NO_SOMOS,
  PRECIO,
  PREGUNTAS,
  CIERRE,
] as const

// ── 3. Meta contenido ───────────────────────────────────────────────────────

export const META = {
  title: `${MARCA.nombre} · Índice de Reputación para profesionales de salud`,
  /**
   * La del copy medía 163 caracteres y su propio límite es 155. Se recorta «de
   * Google», que es lo que menos cuesta: la ficha ya se nombra dos veces en la
   * página y «verificable» sostiene el posicionamiento, así que no se toca.
   */
  description:
    'Mide lo que un paciente encuentra cuando te busca: reseñas, respuesta, ficha y reserva. ' +
    'Compárate con tu especialidad en tu ciudad. Gratis y verificable.',
  pais: 'CO',
} as const

/**
 * Canal de contacto directo. Mientras la herramienta del índice no exista, es
 * por donde llega la solicitud, con el nombre del consultorio ya escrito.
 *
 * PENDIENTE: el número es un marcador. Sin número real, ninguna solicitud llega
 * a ninguna parte.
 */
export const CONTACTO = {
  whatsapp: '573000000000',
  numeroDefinido: false,
} as const

/**
 * Verificación 10 del copy: «una persona distinta de quien produjo el copy lo
 * leyó completo y firmó la revisión. Nombre y fecha.»
 *
 * En null la página muestra el cintillo de borrador. Así la verificación deja de
 * ser una buena intención y tiene consecuencia visible: mientras nadie firme, el
 * documento se anuncia como borrador.
 */
export const REVISION: { nombre: string; fecha: string } | null = null

/**
 * El estado del formulario mientras la herramienta del índice no exista.
 *
 * El copy promete un número en un minuto. Eso requiere la herramienta, y todavía
 * no está. Prometerlo igual sería exactamente lo que esta página dice no hacer.
 */
export const FORMULARIO = {
  disponible: {
    titulo: 'Tu índice',
    texto: 'Calculado con datos públicos.',
  },
  enPreparacion: {
    titulo: 'Recibimos el nombre.',
    texto:
      'El índice está en calibración y todavía no se calcula solo. Lo corremos a mano y te lo ' +
      'enviamos con la fórmula y los pesos con que salió, para que puedas recalcularlo.',
    campoContacto: 'Correo o WhatsApp donde te lo enviamos',
  },
} as const
