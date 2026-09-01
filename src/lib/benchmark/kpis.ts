/**
 * Catálogo de KPIs del benchmark.
 *
 * Cada KPI es a la vez (a) una pregunta del assessment, (b) una fila de la
 * distribución del sector y (c) una barra de la vista de auditoría. Un solo
 * catálogo evita que las tres se desincronicen.
 */

export type Unit = 'currency' | 'percent' | 'count' | 'minutes'
export type Direction = 'higher_better' | 'lower_better'
export type BlockId = 'comercial' | 'precios' | 'marketing' | 'operacion'

export type Block = { id: BlockId; name: string; weight: number; claim: string }

/** Los pesos suman 1. El bloque comercial pesa más porque es el que mueve caja. */
export const BLOCKS: Block[] = [
  {
    id: 'comercial',
    name: 'Conversión comercial',
    weight: 0.35,
    claim: 'Qué tanto de la demanda que ya tienes termina en tratamiento aceptado.',
  },
  {
    id: 'marketing',
    name: 'Captación',
    weight: 0.25,
    claim: 'Cuánto te cuesta traer un paciente nuevo y qué tan rápido lo atiendes.',
  },
  {
    id: 'precios',
    name: 'Precio y margen',
    weight: 0.2,
    claim: 'Si tu precio y tus descuentos dejan el margen que el sector deja.',
  },
  {
    id: 'operacion',
    name: 'Operación y retención',
    weight: 0.2,
    claim: 'Qué tanto rinde tu capacidad instalada y si el paciente regresa.',
  },
]

export function getBlock(id: BlockId): Block {
  const block = BLOCKS.find((b) => b.id === id)
  if (!block) throw new Error(`Bloque desconocido: ${id}`)
  return block
}

export type Kpi = {
  slug: string
  name: string
  block: BlockId
  unit: Unit
  direction: Direction
  /** Peso relativo dentro de su bloque. */
  weight: number
  /** Si es false, se compara y se muestra, pero no entra al puntaje. */
  scored: boolean
  /** Redacción de la pregunta en el assessment. `{ancla}` = tratamiento ancla. */
  question: string
  /** Definición operativa: cómo se calcula, para que todos respondan lo mismo. */
  help: string
  /** Rango aceptado en el formulario. */
  min: number
  max: number
  /**
   * Escala del eje al graficarlo. 'log' para distribuciones muy asimétricas,
   * donde una escala lineal aplasta toda la mitad central contra el borde.
   */
  scale?: 'linear' | 'log'
  /** Interpretación de un valor por debajo de la mediana del sector. */
  gapMeaning: string
}

export const KPIS: Kpi[] = [
  // ── Conversión comercial ────────────────────────────────────────────────
  {
    slug: 'tasa-cierre',
    name: 'Tasa de cierre de planes',
    block: 'comercial',
    unit: 'percent',
    direction: 'higher_better',
    weight: 3,
    scored: true,
    question: 'De cada 100 planes de tratamiento que presentas, ¿cuántos se aceptan?',
    help: 'Planes aceptados ÷ planes presentados, de los últimos 3 meses. Cuenta como aceptado el que pagó el primer abono.',
    min: 0,
    max: 100,
    gapMeaning:
      'Estás presentando tratamiento y perdiéndolo en la conversación de cierre o en el seguimiento posterior.',
  },
  {
    slug: 'ticket-promedio',
    name: 'Ticket promedio por caso',
    block: 'comercial',
    unit: 'currency',
    direction: 'higher_better',
    weight: 2,
    scored: true,
    question: '¿Cuánto factura en promedio un caso aceptado, de principio a fin?',
    help: 'Ingreso total del tratamiento (no el abono inicial) ÷ número de casos aceptados.',
    min: 0,
    max: 500_000_000,
    gapMeaning:
      'Estás resolviendo el motivo de consulta pero no el caso completo: falta plan integral o venta cruzada.',
  },
  {
    slug: 'lead-a-cita',
    name: 'Conversión de contacto a cita',
    block: 'comercial',
    unit: 'percent',
    direction: 'higher_better',
    weight: 2,
    scored: true,
    question: 'De cada 100 personas que te contactan, ¿cuántas agendan cita?',
    help: 'Citas agendadas ÷ contactos recibidos por todos los canales (WhatsApp, teléfono, formularios, redes).',
    min: 0,
    max: 100,
    gapMeaning:
      'La demanda existe y se cae antes de entrar a tu agenda: casi siempre es tiempo de respuesta o falta de un responsable.',
  },
  {
    slug: 'no-show',
    name: 'Citas perdidas (no-show)',
    block: 'comercial',
    unit: 'percent',
    direction: 'lower_better',
    weight: 2,
    scored: true,
    question: 'De cada 100 citas agendadas, ¿cuántas no se presentan ni reprograman?',
    help: 'Citas no asistidas ÷ citas agendadas del mismo periodo. Incluye las canceladas con menos de 24 h.',
    min: 0,
    max: 100,
    gapMeaning:
      'Estás pagando la captación dos veces: el hueco de agenda ya se compró y no produjo.',
  },

  // ── Captación ───────────────────────────────────────────────────────────
  {
    slug: 'leads-mes',
    name: 'Contactos nuevos por mes',
    block: 'marketing',
    unit: 'count',
    direction: 'higher_better',
    weight: 1,
    scored: true,
    question: '¿Cuántas personas nuevas te contactan al mes?',
    help: 'Promedio de los últimos 3 meses, sin contar pacientes que ya estaban en tratamiento.',
    min: 0,
    max: 100_000,
    gapMeaning: 'El problema no es tu conversión: es que hay poca demanda entrando al embudo.',
  },
  {
    slug: 'costo-por-lead',
    name: 'Costo por contacto',
    block: 'marketing',
    unit: 'currency',
    direction: 'lower_better',
    weight: 2,
    scored: true,
    question: '¿Cuánto te cuesta, en publicidad, cada persona que te contacta?',
    help: 'Inversión publicitaria del mes ÷ contactos nuevos generados por publicidad.',
    min: 0,
    max: 10_000_000,
    gapMeaning:
      'Pagas la atención más caro que el sector: suele ser segmentación amplia o creativos sin oferta clara.',
  },
  {
    slug: 'cac',
    name: 'Costo de adquisición por paciente',
    block: 'marketing',
    unit: 'currency',
    direction: 'lower_better',
    weight: 3,
    scored: true,
    question: '¿Cuánto te cuesta conseguir un paciente que sí inicia tratamiento?',
    help: 'Inversión publicitaria del mes ÷ pacientes nuevos que iniciaron tratamiento ese mes.',
    min: 0,
    max: 100_000_000,
    gapMeaning:
      'Cada paciente nuevo se come una parte del margen mayor a la del sector; el techo de crecimiento llega antes.',
  },
  {
    slug: 'tiempo-respuesta',
    name: 'Tiempo de primera respuesta',
    block: 'marketing',
    unit: 'minutes',
    direction: 'lower_better',
    weight: 2,
    scored: true,
    question: 'En minutos, ¿cuánto tarda en promedio tu primera respuesta a un contacto nuevo?',
    help: 'Desde que entra el mensaje o la llamada hasta que una persona (no un autorespondedor) contesta, en horario laboral.',
    min: 0,
    max: 10_080,
    scale: 'log',
    gapMeaning:
      'Quien contesta primero se queda el paciente. Este es el hueco más barato de cerrar de toda la lista.',
  },

  // ── Precio y margen ─────────────────────────────────────────────────────
  {
    slug: 'precio-ancla',
    name: 'Precio del tratamiento de referencia',
    block: 'precios',
    unit: 'currency',
    direction: 'higher_better',
    weight: 0,
    scored: false,
    question: '¿Cuánto cobras por {ancla}?',
    help: 'Precio de lista publicado, sin promociones. Se compara con el rango del sector; no sube ni baja tu puntaje.',
    min: 0,
    max: 1_000_000_000,
    gapMeaning:
      'Estás por debajo del rango del sector para el mismo trabajo. Compararlo es el primer paso; subirlo requiere respaldo de propuesta.',
  },
  {
    slug: 'margen-bruto',
    name: 'Margen bruto por tratamiento',
    block: 'precios',
    unit: 'percent',
    direction: 'higher_better',
    weight: 3,
    scored: true,
    question: 'De cada 100 pesos que cobras por un tratamiento, ¿cuántos quedan después de insumos, laboratorio y honorarios?',
    help: 'Margen bruto: (ingreso − costo directo del tratamiento) ÷ ingreso. No descuentes renta, sueldos fijos ni publicidad.',
    min: 0,
    max: 100,
    gapMeaning:
      'El precio no está cubriendo el costo real del caso, o el costo de laboratorio e insumos se salió de control.',
  },
  {
    slug: 'descuento-promedio',
    name: 'Descuento promedio concedido',
    block: 'precios',
    unit: 'percent',
    direction: 'lower_better',
    weight: 2,
    scored: true,
    question: 'En promedio, ¿qué porcentaje de descuento terminas dando sobre tu precio de lista?',
    help: 'Suma de descuentos concedidos ÷ suma facturada a precio de lista, últimos 3 meses.',
    min: 0,
    max: 100,
    gapMeaning:
      'El descuento está haciendo el trabajo que debería hacer tu propuesta de valor. Es margen regalado, no captación.',
  },

  // ── Operación y retención ───────────────────────────────────────────────
  {
    slug: 'ocupacion-agenda',
    name: 'Ocupación de agenda',
    block: 'operacion',
    unit: 'percent',
    direction: 'higher_better',
    weight: 3,
    scored: true,
    question: '¿Qué porcentaje de tus horas clínicas disponibles se ocupa realmente?',
    help: 'Horas ocupadas ÷ horas clínicas abiertas al público, promedio de las últimas 4 semanas.',
    min: 0,
    max: 100,
    gapMeaning: 'Tienes capacidad pagada que no produce: renta, equipo y sueldo corriendo en vacío.',
  },
  {
    slug: 'ingreso-por-unidad',
    name: 'Ingreso mensual por unidad de atención',
    block: 'operacion',
    unit: 'currency',
    direction: 'higher_better',
    weight: 2,
    scored: true,
    question: '¿Cuánto factura al mes cada sillón o consultorio que tienes en operación?',
    help: 'Ingreso mensual total ÷ número de sillones o consultorios activos.',
    min: 0,
    max: 5_000_000_000,
    gapMeaning:
      'Cada metro cuadrado rinde menos que en el sector: mezcla de ocupación baja, ticket bajo o agenda mal armada.',
  },
  {
    slug: 'tasa-retorno',
    name: 'Pacientes que regresan',
    block: 'operacion',
    unit: 'percent',
    direction: 'higher_better',
    weight: 2,
    scored: true,
    question: 'De cada 100 pacientes que terminaron tratamiento el año pasado, ¿cuántos volvieron por algo más?',
    help: 'Pacientes con una segunda compra ÷ pacientes que terminaron tratamiento, ventana de 12 meses.',
    min: 0,
    max: 100,
    gapMeaning:
      'Estás comprando pacientes nuevos para reemplazar a los que ya te conocían. Es la fuga más cara del modelo.',
  },
]

export const KPIS_BY_SLUG: Record<string, Kpi> = Object.fromEntries(
  KPIS.map((k) => [k.slug, k]),
)

export function getKpi(slug: string): Kpi {
  const kpi = KPIS_BY_SLUG[slug]
  if (!kpi) throw new Error(`KPI desconocido: ${slug}`)
  return kpi
}

export function kpisOfBlock(block: BlockId): Kpi[] {
  return KPIS.filter((k) => k.block === block)
}

/** Texto de la pregunta con el tratamiento ancla de la especialidad resuelto. */
export function kpiQuestion(kpi: Kpi, anchor: string): string {
  return kpi.question.replace('{ancla}', anchor)
}
