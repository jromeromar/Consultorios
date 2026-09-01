import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { LoginForm } from '@/components/auth/LoginForm'
import { Card, SiteFooter, SiteHeader } from '@/components/ui/chrome'
import { getSessionUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Entrar' }

function safeNext(value: string | undefined): string {
  return value && /^\/(?!\/)/.test(value) ? value : '/plataforma'
}

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string }>
}) {
  const user = await getSessionUser()
  const { siguiente } = await searchParams
  const next = safeNext(siguiente)
  if (user) redirect(next)

  return (
    <>
      <SiteHeader user={null} />
      <main className="mx-auto max-w-md px-5 py-16">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--color-brand)]">
          Entrar a la plataforma
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
          Tus auditorías y los estudios completos del periodo.
        </p>
        <Card className="mt-6 p-6">
          <LoginForm siguiente={next} />
        </Card>
        <p className="mt-5 text-[13px] text-[var(--color-ink-2)]">
          ¿Todavía no tienes cuenta?{' '}
          <Link href="/registro" className="font-medium text-[var(--color-accent)] underline">
            Crear una
          </Link>{' '}
          o{' '}
          <Link href="/assessment" className="font-medium text-[var(--color-accent)] underline">
            empezar por el assessment
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  )
}
