'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getDb } from '@/lib/db'
import { assessments, users } from '@/lib/db/schema'
import { SEGMENT_SLUGS, SPECIALTY_SLUGS } from '@/lib/benchmark/taxonomy'
import { hashPassword, verifyPassword } from './password'
import { createSession, destroySession } from './session'

export type FormState = { error?: string } | null

const email = z
  .string()
  .trim()
  .min(1, 'Escribe tu correo.')
  .email('Ese correo no parece válido.')
  .transform((v) => v.toLowerCase())

const password = z.string().min(8, 'La contraseña necesita al menos 8 caracteres.')

const registroSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre.'),
  email,
  password,
  clinicName: z.string().trim().optional(),
  specialtySlug: z.enum(SPECIALTY_SLUGS as [string, ...string[]]),
  segmentSlug: z.enum(SEGMENT_SLUGS as [string, ...string[]]),
  city: z.string().trim().optional(),
  phone: z.string().trim().optional(),
})

function safeNext(value: unknown): string {
  // Solo rutas internas: evita que `?siguiente=` se use como redirección abierta.
  return typeof value === 'string' && /^\/(?!\/)/.test(value) ? value : '/plataforma'
}

export async function registrarse(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registroSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos del formulario.' }
  }
  const data = parsed.data
  const db = await getDb()

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1)
  if (existing) {
    return { error: 'Ya existe una cuenta con ese correo. Inicia sesión.' }
  }

  const [created] = await db
    .insert(users)
    .values({
      email: data.email,
      passwordHash: await hashPassword(data.password),
      name: data.name,
      clinicName: data.clinicName || null,
      specialtySlug: data.specialtySlug,
      segmentSlug: data.segmentSlug,
      city: data.city || null,
      phone: data.phone || null,
    })
    .returning({ id: users.id })

  // Un assessment respondido antes de registrarse queda huérfano; se reclama
  // aquí para que el profesional encuentre su auditoría ya lista al entrar.
  await db
    .update(assessments)
    .set({ userId: created.id })
    .where(and(eq(assessments.leadEmail, data.email), isNull(assessments.userId)))

  await createSession(created.id)
  redirect(safeNext(formData.get('siguiente')))
}

const entrarSchema = z.object({ email, password: z.string().min(1, 'Escribe tu contraseña.') })

export async function entrar(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = entrarSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos del formulario.' }
  }

  const db = await getDb()
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1)

  // Mismo mensaje en los dos casos: no revelamos si el correo existe.
  const mensaje = 'Correo o contraseña incorrectos.'
  if (!user) return { error: mensaje }
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: mensaje }
  }

  await createSession(user.id)
  redirect(safeNext(formData.get('siguiente')))
}

export async function salir() {
  await destroySession()
  redirect('/')
}
