import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { SignJWT, jwtVerify } from 'jose'

import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { DEMO_MODE } from '@/lib/mode'

const COOKIE = 'consultorios_session'
const DURACION_DIAS = 30

export type SessionUser = {
  id: string
  email: string
  name: string
  role: string
  clinicName: string | null
  specialtySlug: string
  segmentSlug: string
  city: string | null
}

/** Secreto efímero del modo demostración: uno por proceso, nunca en disco. */
let secretoEfimero: Uint8Array | undefined

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET
  if (value && value.length >= 32) return new TextEncoder().encode(value)

  if (DEMO_MODE) {
    // En demostración la base vive en memoria: una sesión no puede sobrevivir
    // al proceso de todas formas, así que un secreto por instancia es coherente
    // y evita firmar con una constante pública.
    secretoEfimero ??= crypto.getRandomValues(new Uint8Array(48))
    return secretoEfimero
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_SECRET falta o es demasiado corto. Genera uno con `openssl rand -base64 48`.',
    )
  }
  // Solo desarrollo: constante para que la sesión sobreviva un reinicio.
  return new TextEncoder().encode('desarrollo-local-no-usar-en-produccion-0000000')
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_DIAS}d`)
    .sign(secret())

  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACION_DIAS * 24 * 60 * 60,
  })
}

export async function destroySession() {
  const store = await cookies()
  store.delete(COOKIE)
}

/** Usuario de la sesión, o null. Nunca lanza por un token inválido o vencido. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null

  let userId: string
  try {
    const { payload } = await jwtVerify(token, secret())
    if (typeof payload.sub !== 'string') return null
    userId = payload.sub
  } catch {
    return null
  }

  const db = await getDb()
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!row) return null

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    clinicName: row.clinicName,
    specialtySlug: row.specialtySlug,
    segmentSlug: row.segmentSlug,
    city: row.city,
  }
}

export async function requireUser(returnTo = '/plataforma'): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect(`/entrar?siguiente=${encodeURIComponent(returnTo)}`)
  return user
}
