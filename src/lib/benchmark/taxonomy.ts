/** Taxonomía compartida: especialidades, segmentos y periodos del benchmark. */

export const PERIOD_ACTUAL = '2026-S1'
export const PAIS_DEFAULT = 'CO'

export type Specialty = { slug: string; name: string; short: string; anchor: string }

/** `anchor` = el tratamiento de referencia usado en el bloque de precios. */
export const SPECIALTIES: Specialty[] = [
  {
    slug: 'ortodoncia',
    name: 'Ortodoncia',
    short: 'Ortodoncia',
    anchor: 'tratamiento de ortodoncia completo (brackets convencionales)',
  },
  {
    slug: 'odontologia-estetica',
    name: 'Odontología estética',
    short: 'Odont. estética',
    anchor: 'diseño de sonrisa (6–8 carillas)',
  },
  {
    slug: 'odontologia-general',
    name: 'Odontología general',
    short: 'Odont. general',
    anchor: 'rehabilitación con corona sobre implante',
  },
  {
    slug: 'medicina-estetica',
    name: 'Medicina estética',
    short: 'Med. estética',
    anchor: 'protocolo facial completo (toxina + rellenos)',
  },
  {
    slug: 'medicina-especialidad',
    name: 'Medicina de especialidad',
    short: 'Med. especialidad',
    anchor: 'paquete de consulta + estudios de primera vez',
  },
  {
    slug: 'nutricion-bienestar',
    name: 'Nutrición y bienestar',
    short: 'Nutrición',
    anchor: 'programa de acompañamiento de 3 meses',
  },
]

export const SPECIALTY_SLUGS = SPECIALTIES.map((s) => s.slug)

export function getSpecialty(slug: string): Specialty | undefined {
  return SPECIALTIES.find((s) => s.slug === slug)
}

export type Segment = { slug: string; name: string; description: string }

export const SEGMENTS: Segment[] = [
  {
    slug: 'solo',
    name: 'Profesional independiente',
    description: 'Un solo profesional, con o sin asistente.',
  },
  {
    slug: 'clinica-pequena',
    name: 'Clínica pequeña',
    description: '2 a 4 profesionales en una sede.',
  },
  {
    slug: 'clinica-multiple',
    name: 'Clínica o grupo grande',
    description: '5 o más profesionales, una o varias sedes.',
  },
]

export const SEGMENT_SLUGS = SEGMENTS.map((s) => s.slug)

export function getSegment(slug: string): Segment | undefined {
  return SEGMENTS.find((s) => s.slug === slug)
}
