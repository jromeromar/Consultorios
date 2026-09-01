import Link from 'next/link'

import { SiteFooter, SiteHeader } from '@/components/ui/chrome'
import { getSessionUser } from '@/lib/auth/session'

export default async function HomePage() {
  const user = await getSessionUser()

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-6xl px-5">
        <section className="border-b border-[var(--color-hair)] py-16 sm:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Agencia para consultorios y clínicas
          </p>
          <h1 className="mt-4 max-w-3xl text-[34px] font-semibold leading-[1.15] tracking-tight text-[var(--color-brand)] sm:text-[44px]">
            Sabemos qué hace el cuartil alto de tu especialidad. Ahora tú también.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-[var(--color-ink-2)]">
            Trabajamos con ortodoncistas, médicos, odontólogos estéticos y medicina estética. El
            sitio completo está en construcción; la plataforma de estudios ya está abierta.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/estudios"
              className="rounded-md bg-[var(--color-brand)] px-5 py-2.5 text-[14px] font-medium text-white hover:bg-[var(--color-accent)]"
            >
              Entrar a Estudios
            </Link>
            <Link
              href="/assessment"
              className="rounded-md border border-[var(--color-axis)] px-5 py-2.5 text-[14px] font-medium text-[var(--color-ink)] hover:border-[var(--color-brand)]"
            >
              Comparar mi consultorio
            </Link>
          </div>
        </section>

        <section className="grid gap-8 py-14 sm:grid-cols-3">
          {[
            {
              title: 'Estudios de Benchmark',
              body: 'La distribución real de cada indicador comercial por especialidad y por tamaño de consultorio. Percentiles, no promedios.',
            },
            {
              title: 'Assessment de 20 preguntas',
              body: 'Responde lo que sí mides. Al terminar, tu consultorio queda ubicado dentro de la distribución de tu especialidad.',
            },
            {
              title: 'Auditoría vs. sector',
              body: 'Tus huecos ordenados por cuánto ingreso mensual recuperas al cerrarlos, calculado con tus propias cifras.',
            },
          ].map((item) => (
            <div key={item.title}>
              <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">{item.title}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
                {item.body}
              </p>
            </div>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
