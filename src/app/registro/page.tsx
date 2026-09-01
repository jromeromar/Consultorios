import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { RegisterForm } from '@/components/auth/RegisterForm'
import { Card, SiteFooter, SiteHeader } from '@/components/ui/chrome'
import { getSessionUser } from '@/lib/auth/session'
import { SEGMENT_SLUGS, SPECIALTY_SLUGS } from '@/lib/benchmark/taxonomy'

export const metadata: Metadata = { title: 'Crear cuenta' }

type Search = {
  correo?: string
  especialidad?: string
  segmento?: string
  siguiente?: string
}

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const user = await getSessionUser()
  const search = await searchParams
  const next =
    search.siguiente && /^\/(?!\/)/.test(search.siguiente) ? search.siguiente : '/plataforma'
  if (user) redirect(next)

  return (
    <>
      <SiteHeader user={null} />
      <main className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--color-brand)]">
          Crear tu cuenta
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
          Si ya respondiste el assessment con este mismo correo, tu auditoría queda ligada a la
          cuenta en cuanto la creas.
        </p>
        <Card className="mt-6 p-6">
          <RegisterForm
            siguiente={next}
            correo={search.correo}
            especialidad={
              search.especialidad && SPECIALTY_SLUGS.includes(search.especialidad)
                ? search.especialidad
                : undefined
            }
            segmento={
              search.segmento && SEGMENT_SLUGS.includes(search.segmento)
                ? search.segmento
                : undefined
            }
          />
        </Card>
        <p className="mt-5 text-[13px] text-[var(--color-ink-2)]">
          ¿Ya tienes cuenta?{' '}
          <Link href="/entrar" className="font-medium text-[var(--color-accent)] underline">
            Entrar
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  )
}
