import type { Metadata } from 'next'

import { AssessmentForm } from '@/components/assessment/AssessmentForm'
import { Card, DemoDataNotice, SectionTitle, SiteFooter, SiteHeader } from '@/components/ui/chrome'
import { getSessionUser } from '@/lib/auth/session'
import { BLOCKS } from '@/lib/benchmark/kpis'
import { getSourceNote } from '@/lib/benchmark/queries'

export const metadata: Metadata = {
  title: 'Assessment de benchmark',
  description:
    'Veinte preguntas sobre tu consultorio. Al terminar, tu posición dentro de la distribución de tu especialidad.',
}

export default async function AssessmentPage() {
  const user = await getSessionUser()
  const sourceNote = await getSourceNote(user?.specialtySlug)

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <Card className="p-6 sm:p-8">
            <SectionTitle
              eyebrow="Assessment · 6 a 8 minutos"
              title="Compara tu consultorio contra tu especialidad"
              lead="Responde con lo que tengas a mano. Lo que no midas, márcalo: el índice de medición es parte del resultado, no una penalización escondida."
            />
            <div className="mt-8">
              <AssessmentForm
                prefill={
                  user
                    ? {
                        leadName: user.name,
                        leadEmail: user.email,
                        clinicName: user.clinicName ?? undefined,
                        specialtySlug: user.specialtySlug,
                        segmentSlug: user.segmentSlug,
                        autenticado: true,
                      }
                    : undefined
                }
              />
            </div>
          </Card>

          <aside className="space-y-6 lg:sticky lg:top-6">
            <Card className="p-6">
              <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">Qué vas a recibir</h2>
              <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                <li>Un puntaje de 0 a 100 donde 50 es la mediana de tu especialidad.</li>
                <li>Tu posición exacta en la distribución de cada indicador que respondas.</li>
                <li>Tus huecos ordenados por cuántos puntos del global recuperan.</li>
                <li>Tu embudo mensual reconstruido y el valor en pesos de cerrar cada hueco.</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">Los cuatro bloques</h2>
              <ol className="mt-3 space-y-3 text-[13px] leading-relaxed">
                {BLOCKS.map((block) => (
                  <li key={block.id}>
                    <span className="font-medium text-[var(--color-ink)]">{block.name}</span>{' '}
                    <span className="tabular text-[12px] text-[var(--color-muted)]">
                      {Math.round(block.weight * 100)} % del puntaje
                    </span>
                    <span className="block text-[var(--color-ink-2)]">{block.claim}</span>
                  </li>
                ))}
              </ol>
            </Card>

            <DemoDataNotice sourceNote={sourceNote} />
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
