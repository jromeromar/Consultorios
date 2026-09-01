'use server'

import { and, desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getDistributions } from '@/lib/benchmark/queries'
import { KPIS_BY_SLUG } from '@/lib/benchmark/kpis'
import { PRACTICES_BY_SLUG } from '@/lib/benchmark/practices'
import { PAIS_DEFAULT, PERIOD_ACTUAL, SEGMENT_SLUGS, SPECIALTY_SLUGS } from '@/lib/benchmark/taxonomy'
import { scoreAssessment, type Answers, type Result } from '@/lib/benchmark/scoring'
import { getDb } from '@/lib/db'
import { assessments } from '@/lib/db/schema'
import { getSessionUser } from '@/lib/auth/session'

export type EnviarState = { error?: string } | null

const contactoSchema = z.object({
  leadName: z.string().trim().min(2, 'Escribe tu nombre.'),
  leadEmail: z
    .string()
    .trim()
    .min(1, 'Escribe tu correo.')
    .email('Ese correo no parece válido.')
    .transform((v) => v.toLowerCase()),
  leadPhone: z.string().trim().optional(),
  clinicName: z.string().trim().optional(),
  specialtySlug: z.enum(SPECIALTY_SLUGS as [string, ...string[]]),
  segmentSlug: z.enum(SEGMENT_SLUGS as [string, ...string[]]),
})

/**
 * Normaliza el JSON del formulario: descarta claves desconocidas, recorta los
 * numéricos a su rango declarado y valida que cada opción de práctica exista.
 */
function sanitizeAnswers(raw: unknown): Answers {
  const answers: Answers = {}
  if (typeof raw !== 'object' || raw === null) return answers

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const kpi = KPIS_BY_SLUG[key]
    if (kpi) {
      if (value === null || value === '' || value === undefined) continue
      const n = Number(value)
      if (!Number.isFinite(n)) continue
      answers[key] = Math.min(kpi.max, Math.max(kpi.min, n))
      continue
    }

    const practice = PRACTICES_BY_SLUG[key]
    if (practice && typeof value === 'string') {
      if (practice.options.some((o) => o.value === value)) answers[key] = value
    }
  }

  return answers
}

export async function enviarAssessment(
  _prev: EnviarState,
  formData: FormData,
): Promise<EnviarState> {
  const parsed = contactoSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos de contacto.' }
  }

  let raw: unknown
  try {
    raw = JSON.parse(String(formData.get('respuestas') ?? '{}'))
  } catch {
    return { error: 'No pudimos leer tus respuestas. Vuelve a intentarlo.' }
  }
  const answers = sanitizeAnswers(raw)
  if (Object.keys(answers).length === 0) {
    return { error: 'Responde al menos una pregunta antes de enviar.' }
  }

  const data = parsed.data
  const distributions = await getDistributions({
    specialtySlug: data.specialtySlug,
    segmentSlug: data.segmentSlug,
  })
  if (distributions.length === 0) {
    return {
      error: 'Todavía no hay benchmark cargado para esa especialidad. Escríbenos y lo resolvemos.',
    }
  }

  const result = scoreAssessment({
    answers,
    distributions,
    specialtySlug: data.specialtySlug,
    segmentSlug: data.segmentSlug,
    period: PERIOD_ACTUAL,
  })

  const session = await getSessionUser()
  const db = await getDb()
  const [created] = await db
    .insert(assessments)
    .values({
      userId: session?.id ?? null,
      leadEmail: data.leadEmail,
      leadName: data.leadName,
      leadPhone: data.leadPhone || null,
      clinicName: data.clinicName || null,
      specialtySlug: data.specialtySlug,
      segmentSlug: data.segmentSlug,
      period: PERIOD_ACTUAL,
      country: PAIS_DEFAULT,
      answers,
      result,
    })
    .returning({ id: assessments.id })

  redirect(session ? `/plataforma/auditoria/${created.id}` : `/assessment/${created.id}`)
}

export type AssessmentRecord = {
  id: string
  userId: string | null
  leadEmail: string
  leadName: string
  clinicName: string | null
  specialtySlug: string
  segmentSlug: string
  period: string
  answers: Answers
  result: Result
  createdAt: Date
}

function toRecord(row: typeof assessments.$inferSelect): AssessmentRecord {
  return {
    id: row.id,
    userId: row.userId,
    leadEmail: row.leadEmail,
    leadName: row.leadName,
    clinicName: row.clinicName,
    specialtySlug: row.specialtySlug,
    segmentSlug: row.segmentSlug,
    period: row.period,
    answers: row.answers as Answers,
    result: row.result as Result,
    createdAt: row.createdAt,
  }
}

export async function getAssessment(id: string): Promise<AssessmentRecord | null> {
  const db = await getDb()
  const [row] = await db.select().from(assessments).where(eq(assessments.id, id)).limit(1)
  return row ? toRecord(row) : null
}

export async function getAssessmentsForUser(
  userId: string,
  email: string,
): Promise<AssessmentRecord[]> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(assessments)
    .where(eq(assessments.userId, userId))
    .orderBy(desc(assessments.createdAt))

  if (rows.length > 0) return rows.map(toRecord)

  // Red de seguridad: un assessment respondido con el mismo correo antes de
  // registrarse y que no alcanzó a reclamarse.
  const byEmail = await db
    .select()
    .from(assessments)
    .where(and(eq(assessments.leadEmail, email)))
    .orderBy(desc(assessments.createdAt))
  return byEmail.map(toRecord)
}
