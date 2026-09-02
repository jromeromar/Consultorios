import Link from 'next/link'
import type { Metadata } from 'next'

import { SpecialtyBars } from '@/components/charts/SpecialtyBars'
import { TableView } from '@/components/charts/TableView'
import { Card, DemoDataNotice, SectionTitle, SiteFooter, SiteHeader } from '@/components/ui/chrome'
import { getSessionUser } from '@/lib/auth/session'
import { formatValue } from '@/lib/benchmark/format'
import { getKpi } from '@/lib/benchmark/kpis'
import { getKpiAcrossSpecialties } from '@/lib/benchmark/queries'
import { PERIOD_ACTUAL, getSpecialty } from '@/lib/benchmark/taxonomy'
import { getEdiciones } from '@/lib/censo/queries'
import { getStudies } from '@/lib/content/studies'

export const metadata: Metadata = {
  title: 'Estudios de Benchmark',
  description:
    'Distribuciones comerciales por especialidad: ortodoncia, odontología estética, medicina estética y más.',
}

/** Indicador de portada: el que más separa al cuartil alto del resto. */
const KPI_PORTADA = 'tasa-cierre'

export default async function EstudiosPage() {
  const [user, studies, across, ediciones] = await Promise.all([
    getSessionUser(),
    getStudies(),
    getKpiAcrossSpecialties(KPI_PORTADA),
    getEdiciones(),
  ])

  const kpi = getKpi(KPI_PORTADA)
  const bars = across
    .map(({ specialtySlug, distribution }) => ({
      slug: specialtySlug,
      label: getSpecialty(specialtySlug)?.short ?? specialtySlug,
      median: distribution.p50,
      p25: distribution.p25,
      p75: distribution.p75,
    }))
    .sort((a, b) => b.median - a.median)

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <SectionTitle
          eyebrow={`Periodo ${PERIOD_ACTUAL}`}
          title="Estudios de Benchmark"
          lead="Cada estudio publica la distribución de 14 indicadores comerciales de una especialidad: conversión, precio y margen, captación, operación y retención. Se lee por percentiles, porque el promedio de un sector así de disperso no describe a nadie."
        />

        <div className="mt-6 max-w-3xl">
          <DemoDataNotice sourceNote={across[0]?.distribution.sourceNote} />
        </div>

        {ediciones.length > 0 ? (
          <section className="mt-10">
            <SectionTitle
              eyebrow="Censo de ortodoncia"
              title="Ediciones del censo"
              lead="El censo observa desde fuera todo el universo de consultorios de ortodoncia del país: visibilidad, reputación, contenido, respuesta y reservabilidad. Ningún indicador depende de que el consultorio conteste una encuesta."
            />
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {ediciones.map((edicion) => (
                <li key={edicion.edicionId}>
                  <Link href={`/estudios/censo/${edicion.edicionId}`} className="block h-full">
                    <Card className="h-full p-5 transition-colors hover:border-[var(--color-axis)]">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
                        {edicion.publicadaEn ?? 'sin publicar'}
                      </p>
                      <h3 className="mt-2 text-[15px] font-semibold text-[var(--color-brand)]">
                        {edicion.nombre}
                      </h3>
                      <p className="tabular mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                        Universo {edicion.nUniverso ?? '—'} · contactados {edicion.nMuestra ?? '—'} ·
                        respondieron {edicion.nRespondio ?? '—'}
                      </p>
                      <p className="mt-3 text-[12px] font-medium text-[var(--color-accent)]">
                        Abrir la edición →
                      </p>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <Card className="p-6">
            <SectionTitle
              eyebrow="Comparativa entre especialidades"
              title={kpi.name}
              lead={kpi.help}
            />
            <div className="mt-5">
              <SpecialtyBars bars={bars} unit={kpi.unit} highlight={user?.specialtySlug} />
              <TableView
                caption={`${kpi.name} por especialidad`}
                headers={['Especialidad', 'p25', 'Mediana', 'p75']}
                rows={bars.map((bar) => [
                  bar.label,
                  formatValue(bar.p25, kpi.unit),
                  formatValue(bar.median, kpi.unit),
                  formatValue(bar.p75, kpi.unit),
                ])}
              />
            </div>
          </Card>

          <Card className="flex flex-col justify-between p-6">
            <SectionTitle
              eyebrow="Tu posición"
              title="El estudio dice dónde está el sector. La auditoría dice dónde estás tú."
              lead="El assessment son 20 preguntas sobre lo que ya sabes de tu consultorio. Al terminar recibes tu puntaje, tu posición dentro de la distribución y los huecos ordenados por impacto."
            />
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/assessment"
                className="rounded-md bg-[var(--color-brand)] px-5 py-2.5 text-[13px] font-medium text-white hover:bg-[var(--color-accent)]"
              >
                Hacer el assessment
              </Link>
              {user ? (
                <Link
                  href="/plataforma"
                  className="rounded-md border border-[var(--color-axis)] px-5 py-2.5 text-[13px] font-medium text-[var(--color-ink)] hover:border-[var(--color-brand)]"
                >
                  Ver mis auditorías
                </Link>
              ) : null}
            </div>
          </Card>
        </div>

        <h2 className="mt-14 text-[18px] font-semibold tracking-tight text-[var(--color-ink)]">
          Estudios publicados
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {studies.map((study) => (
            <li key={study.slug}>
              <Link href={`/estudios/${study.slug}`} className="block h-full">
                <Card className="h-full p-5 transition-colors hover:border-[var(--color-axis)]">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
                    {study.period}
                  </p>
                  <h3 className="mt-2 text-[15px] font-semibold text-[var(--color-brand)]">
                    {study.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                    {study.summary}
                  </p>
                  <p className="mt-3 text-[12px] font-medium text-[var(--color-accent)]">
                    Abrir el estudio →
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  )
}
