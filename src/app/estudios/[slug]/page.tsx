import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PercentileBullet, PercentileLegend } from '@/components/charts/PercentileBullet'
import { TableView } from '@/components/charts/TableView'
import { Card, DemoDataNotice, SectionTitle, SiteFooter, SiteHeader } from '@/components/ui/chrome'
import { getSessionUser } from '@/lib/auth/session'
import { formatValue } from '@/lib/benchmark/format'
import { BLOCKS, KPIS, getKpi } from '@/lib/benchmark/kpis'
import { getDistributions } from '@/lib/benchmark/queries'
import { SEGMENTS, getSegment, getSpecialty } from '@/lib/benchmark/taxonomy'
import { getStudy } from '@/lib/content/studies'

type Params = { slug: string }
type Search = { segmento?: string }

/** Las cifras salen de la base en cada visita: no se congelan en el build. */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const study = await getStudy((await params).slug)
  if (!study) return { title: 'Estudio no encontrado' }
  return { title: `${study.title} ${study.period}`, description: study.summary }
}

export default async function EstudioPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<Search>
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams])
  const study = await getStudy(slug)
  if (!study) notFound()

  const specialty = getSpecialty(study.specialtySlug)!
  const segmentSlug =
    search.segmento && getSegment(search.segmento) ? search.segmento : 'all'

  const [user, distributions] = await Promise.all([
    getSessionUser(),
    getDistributions({
      specialtySlug: study.specialtySlug,
      segmentSlug,
      period: study.period,
    }),
  ])

  const byKpi = new Map(distributions.map((d) => [d.kpiSlug, d]))
  const sampleSize = distributions[0]?.sampleSize
  const sourceNote = distributions[0]?.sourceNote

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <Link href="/estudios" className="text-[12px] text-[var(--color-accent)]">
          ← Todos los estudios
        </Link>

        <div className="mt-4">
          <SectionTitle
            eyebrow={`${specialty.name} · periodo ${study.period}`}
            title={study.title}
            lead={study.summary}
          />
        </div>

        <div className="mt-6 max-w-3xl">
          <DemoDataNotice sampleSize={sampleSize} sourceNote={sourceNote} />
        </div>

        {distributions.length === 0 ? (
          <Card className="mt-8 p-6">
            <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
              Este periodo todavía no tiene cifras publicadas
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-ink-2)]">
              La lectura del periodo ya está escrita, pero el benchmark de {specialty.name} para{' '}
              {study.period} aún no alcanza muestra publicable. Un corte se publica a partir de 12
              consultorios: por debajo de eso los percentiles no significan nada y una cifra
              individual sería deducible.
            </p>
            <Link
              href="/assessment"
              className="mt-4 inline-block rounded-md bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-accent)]"
            >
              Responder el assessment y sumar a la muestra
            </Link>
          </Card>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[12px] text-[var(--color-muted)]">Corte:</span>
          {[{ slug: 'all', name: 'Todo el sector' }, ...SEGMENTS].map((option) => {
            const active = option.slug === segmentSlug
            return (
              <Link
                key={option.slug}
                href={
                  option.slug === 'all'
                    ? `/estudios/${study.slug}`
                    : `/estudios/${study.slug}?segmento=${option.slug}`
                }
                className={`rounded-full border px-3 py-1.5 text-[12px] ${
                  active
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                    : 'border-[var(--color-hair)] text-[var(--color-ink-2)] hover:border-[var(--color-axis)]'
                }`}
              >
                {option.name}
              </Link>
            )
          })}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="space-y-6">
            {BLOCKS.map((block) => {
              const kpis = KPIS.filter((k) => k.block === block.id).filter((k) =>
                byKpi.has(k.slug),
              )
              if (kpis.length === 0) return null
              return (
                <Card key={block.id} className="p-6">
                  <SectionTitle eyebrow="Bloque" title={block.name} lead={block.claim} />
                  <div className="mt-6">
                    <PercentileLegend showValue={false} />
                    <div className="mt-5 space-y-6">
                      {kpis.map((kpi) => (
                        <div key={kpi.slug}>
                          <PercentileBullet
                            label={kpi.name}
                            unit={kpi.unit}
                            direction={kpi.direction}
                            distribution={byKpi.get(kpi.slug)!}
                            scale={kpi.scale}
                          />
                          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-[var(--color-ink-2)]">
                            {kpi.help}
                          </p>
                        </div>
                      ))}
                    </div>
                    <TableView
                      caption={`${block.name} — distribución del sector`}
                      headers={['Indicador', 'p10', 'p25', 'Mediana', 'p75', 'p90']}
                      rows={kpis.map((kpi) => {
                        const d = byKpi.get(kpi.slug)!
                        return [
                          kpi.name,
                          formatValue(d.p10, kpi.unit),
                          formatValue(d.p25, kpi.unit),
                          formatValue(d.p50, kpi.unit),
                          formatValue(d.p75, kpi.unit),
                          formatValue(d.p90, kpi.unit),
                        ]
                      })}
                    />
                  </div>
                </Card>
              )
            })}
          </div>

          <div className="space-y-6 lg:sticky lg:top-6">
            <Card className="p-6">
              <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
                Lectura del periodo
              </h2>
              <div
                className="prose-estudio mt-4 space-y-3 text-[13px] leading-relaxed text-[var(--color-ink-2)] [&_h2]:mt-5 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:text-[var(--color-ink)] [&_p]:mt-3"
                dangerouslySetInnerHTML={{ __html: study.html }}
              />
            </Card>

            <Card className="p-6">
              <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
                ¿Dónde cae tu consultorio?
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                Responde el assessment y estas mismas barras se dibujan con tu marca encima, más el
                cálculo de cuánto vale cerrar cada hueco.
              </p>
              <Link
                href="/assessment"
                className="mt-4 inline-block rounded-md bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-accent)]"
              >
                Hacer el assessment
              </Link>
            </Card>

            <Card className="p-6">
              <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
                Cómo se calculan los indicadores
              </h2>
              <dl className="mt-3 space-y-3 text-[12px] leading-relaxed">
                {KPIS.filter((k) => k.block === 'comercial')
                  .slice(0, 3)
                  .map((kpi) => (
                    <div key={kpi.slug}>
                      <dt className="font-medium text-[var(--color-ink)]">{getKpi(kpi.slug).name}</dt>
                      <dd className="text-[var(--color-ink-2)]">{kpi.help}</dd>
                    </div>
                  ))}
              </dl>
            </Card>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
