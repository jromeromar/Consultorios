/**
 * Preguntas de práctica (madurez). No tienen distribución del sector: se puntúan
 * por la opción elegida. Explican el *por qué* de los huecos numéricos, así que
 * cada opción lleva su propia lectura.
 */

import type { BlockId } from './kpis'

export type PracticeOption = { value: string; label: string; score: number }

export type Practice = {
  slug: string
  block: BlockId
  /** Peso relativo dentro de su bloque, en la misma escala que los KPIs. */
  weight: number
  question: string
  help: string
  options: PracticeOption[]
  /** Lectura cuando la opción elegida puntúa por debajo de 50. */
  gapMeaning: string
}

export const PRACTICES: Practice[] = [
  {
    slug: 'seguimiento-no-cerrados',
    block: 'comercial',
    weight: 3,
    question: '¿Qué pasa con un plan de tratamiento que el paciente no aceptó ese mismo día?',
    help: 'Nos interesa el proceso real, no el ideal.',
    options: [
      { value: 'nada', label: 'Nada. Si regresa, regresa.', score: 0 },
      { value: 'informal', label: 'Alguien le escribe si se acuerda.', score: 30 },
      { value: 'lista', label: 'Queda en una lista y se contacta cuando hay tiempo.', score: 55 },
      { value: 'proceso', label: 'Hay una secuencia definida de contactos con responsable y fecha.', score: 85 },
      { value: 'proceso-medido', label: 'Secuencia definida y medimos cuántos se recuperan.', score: 100 },
    ],
    gapMeaning:
      'Entre el 20 % y el 40 % de los planes no aceptados se cierran después con seguimiento. Sin proceso, ese ingreso ya está perdido.',
  },
  {
    slug: 'registro-pacientes',
    block: 'comercial',
    weight: 2,
    question: '¿Dónde vive la información de un paciente potencial que aún no agenda?',
    help: 'El lugar donde realmente puedes buscarlo mañana.',
    options: [
      { value: 'memoria', label: 'En el chat de WhatsApp y en la memoria del equipo.', score: 0 },
      { value: 'cuaderno', label: 'En un cuaderno o agenda de papel.', score: 20 },
      { value: 'hoja', label: 'En una hoja de cálculo compartida.', score: 50 },
      { value: 'software', label: 'En un software de gestión o CRM que todos usan.', score: 90 },
      { value: 'software-integrado', label: 'En un CRM conectado con la agenda y la publicidad.', score: 100 },
    ],
    gapMeaning:
      'Sin un registro consultable no hay seguimiento posible ni forma de saber qué se cayó. Es el prerrequisito de todo lo demás.',
  },
  {
    slug: 'atribucion-canales',
    block: 'marketing',
    weight: 3,
    question: '¿Puedes decir de qué canal vino cada paciente que inició tratamiento el mes pasado?',
    help: 'Canal = anuncio, referido, búsqueda, redes, paso peatonal.',
    options: [
      { value: 'no', label: 'No, no lo registramos.', score: 0 },
      { value: 'intuicion', label: 'Por intuición, sin registro.', score: 25 },
      { value: 'parcial', label: 'De algunos sí, cuando el paciente lo menciona.', score: 50 },
      { value: 'preguntamos', label: 'Sí, lo preguntamos y lo registramos siempre.', score: 80 },
      { value: 'medido', label: 'Sí, y comparamos costo y cierre por canal cada mes.', score: 100 },
    ],
    gapMeaning:
      'Sin atribución, la decisión de dónde poner el siguiente peso de publicidad es una apuesta. Es la causa raíz de un CAC alto.',
  },
  {
    slug: 'reputacion',
    block: 'marketing',
    weight: 2,
    question: '¿Cómo manejas las reseñas públicas de tu consultorio?',
    help: 'Google, redes y directorios médicos.',
    options: [
      { value: 'nada', label: 'No las pedimos ni las revisamos.', score: 0 },
      { value: 'pasivo', label: 'Las leemos cuando llegan.', score: 30 },
      { value: 'pedimos', label: 'Las pedimos de vez en cuando.', score: 55 },
      { value: 'sistema', label: 'Pedimos reseña a cada paciente que termina y respondemos todas.', score: 90 },
      { value: 'sistema-medido', label: 'Sistema de solicitud, respuesta y seguimiento de calificación promedio.', score: 100 },
    ],
    gapMeaning:
      'La reseña es lo que el paciente lee antes de decidir entre tú y el de la siguiente cuadra. Es captación gratuita sin usar.',
  },
  {
    slug: 'opciones-pago',
    block: 'precios',
    weight: 2,
    question: '¿Qué opciones de pago puede elegir un paciente para un tratamiento alto?',
    help: 'Cuenta solo lo que está disponible hoy, no lo que se está evaluando.',
    options: [
      { value: 'contado', label: 'Solo contado o transferencia.', score: 10 },
      { value: 'tarjeta', label: 'Contado y tarjeta.', score: 40 },
      { value: 'msi', label: 'Tarjeta con mensualidades sin intereses.', score: 70 },
      { value: 'plan-interno', label: 'Plan de pagos interno con contrato, además de tarjeta.', score: 90 },
      { value: 'financiamiento', label: 'Financiamiento con tercero y plan interno, ofrecidos en la presentación del plan.', score: 100 },
    ],
    gapMeaning:
      'La objeción de precio casi nunca es del precio: es del pago mensual. Sin opciones, el plan alto no se presenta o se descuenta.',
  },
  {
    slug: 'revision-indicadores',
    block: 'operacion',
    weight: 3,
    question: '¿Con qué frecuencia revisas los números de tu consultorio?',
    help: 'Revisar = ver cifras y decidir algo con ellas.',
    options: [
      { value: 'nunca', label: 'Solo cuando algo va mal.', score: 0 },
      { value: 'contador', label: 'Cuando el contador manda la declaración.', score: 25 },
      { value: 'mensual-ingresos', label: 'Cada mes, pero solo ingresos y gastos.', score: 55 },
      { value: 'mensual-kpis', label: 'Cada mes, con indicadores de conversión y agenda.', score: 85 },
      { value: 'semanal', label: 'Cada semana, con indicadores y acciones asignadas.', score: 100 },
    ],
    gapMeaning:
      'Lo que no se revisa no se corrige. Los consultorios que revisan indicadores mensualmente cierran los huecos antes de que cuesten un trimestre.',
  },
]

export const PRACTICES_BY_SLUG: Record<string, Practice> = Object.fromEntries(
  PRACTICES.map((p) => [p.slug, p]),
)

export function getPractice(slug: string): Practice {
  const practice = PRACTICES_BY_SLUG[slug]
  if (!practice) throw new Error(`Práctica desconocida: ${slug}`)
  return practice
}

export function practicesOfBlock(block: BlockId): Practice[] {
  return PRACTICES.filter((p) => p.block === block)
}
