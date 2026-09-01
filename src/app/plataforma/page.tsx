import Link from 'next/link'
import type { Metadata } from 'next'

import { Card, DemoDataNotice, SectionTitle } from '@/components/ui/chrome'
import { getAssessmentsForUser } from '@/lib/assessment/actions'
import { requireUser } from '@/lib/auth/session'
import { formatDate } from '@/lib/benchmark/format'
import { getSourceNote } from '@/lib/benchmark/queries'
import { getSegment, getSpecialty } from '@/lib/benchmark/taxonomy'
import { getStudies } from '@/lib/content/studies'

export const metadata: Metadata = { title: 'Mi plataforma' }

export default async function PlataformaPage() {
  const user = await requireUser()
  const [assessments, studies, sourceNote] = await Promise.all([
    getAssessmentsForUser(user.id, user.email),
    getStudies(),
    getSourceNote(user.specialtySlug),
  ])

  const miEstudio = studies.find((s) => s.specialtySlug === user.specialtySlug)
  const ultimo = assessments[0]

  return (
    <>
      <SectionTitle
        eyebrow={`${getSpecialty(user.specialtySlug)?.name} · ${getSegment(user.segmentSlug)?.name}`}
        title={user.clinicName || user.name}
        lead="Tus auditorías contra el sector y los estudios del periodo."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <Card className="p-6">
          <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">Mis auditorías</h2>

          {assessments.length === 0 ? (
            <div className="mt-4">
              <p className="text-[14px] leading-relaxed text-[var(--color-ink-2)]">
                Todavía no has respondido el assessment. Son 20 preguntas y al terminar tu
                consultorio queda ubicado dentro de la distribución de tu especialidad.
              </p>
              <Link
                href="/assessment"
                className="mt-4 inline-block rounded-md bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-accent)]"
              >
                Hacer el assessment
              </Link>
            </div>
          ) : (
            <>
              <ul className="mt-4 divide-y divide-[var(--color-hair)]">
                {assessments.map((assessment) => (
                  <li
                    key={assessment.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-3.5"
                  >
                    <div>
                      <p className="text-[14px] font-medium text-[var(--color-ink)]">
                        {assessment.result.tier.label}
                        <span className="tabular ml-2 text-[13px] font-normal text-[var(--color-ink-2)]">
                          {assessment.result.globalScore}/100
                        </span>
                      </p>
                      <p className="text-[12px] text-[var(--color-muted)]">
                        {formatDate(assessment.createdAt)} · periodo {assessment.period} · índice de
                        medición {assessment.result.indiceMedicion} %
                      </p>
                    </div>
                    <Link
                      href={`/plataforma/auditoria/${assessment.id}`}
                      className="text-[13px] font-medium text-[var(--color-accent)]"
                    >
                      Abrir auditoría →
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/assessment"
                className="mt-5 inline-block rounded-md border border-[var(--color-axis)] px-4 py-2 text-[13px] font-medium text-[var(--color-ink)] hover:border-[var(--color-brand)]"
              >
                Volver a medir
              </Link>
            </>
          )}
        </Card>

        <div className="space-y-6">
          {ultimo ? (
            <Card className="p-6">
              <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
                Tu prioridad de este periodo
              </h2>
              {ultimo.result.priorities.length > 0 ? (
                <>
                  <p className="mt-3 text-[13px] font-medium text-[var(--color-ink)]">
                    {ultimo.result.priorities[0].label}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                    {ultimo.result.priorities[0].meaning}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                  No hay huecos por debajo del objetivo. El siguiente paso es medir lo que quedó
                  sin responder.
                </p>
              )}
            </Card>
          ) : null}

          {miEstudio ? (
            <Card className="p-6">
              <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
                Estudio de tu especialidad
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                {miEstudio.summary}
              </p>
              <Link
                href={`/estudios/${miEstudio.slug}`}
                className="mt-3 inline-block text-[13px] font-medium text-[var(--color-accent)]"
              >
                {miEstudio.title} {miEstudio.period} →
              </Link>
            </Card>
          ) : null}

          <DemoDataNotice sourceNote={sourceNote} />
        </div>
      </div>
    </>
  )
}
