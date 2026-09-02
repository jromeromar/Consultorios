import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PercentileBullet, PercentileLegend } from '@/components/charts/PercentileBullet'
import { FichaTecnica } from '@/components/censo/FichaTecnica'
import { ResumenIndicadores } from '@/components/censo/ResumenIndicadores'
import { Card, SectionTitle, SiteFooter, SiteHeader } from '@/components/ui/chrome'
import { getSessionUser } from '@/lib/auth/session'
import { getBloque } from '@/lib/censo/indicadores'
import { getCategoriasCiudad, getPanorama } from '@/lib/censo/queries'

/** Las cifras salen de la base en cada visita: no se congelan en el build. */
export const dynamic = 'force-dynamic'

type Params = { edicionId: string }
type Search = { ciudad?: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const panorama = await getPanorama((await params).edicionId)
  if (!panorama) return { title: 'Edición no encontrada' }
  return {
    title: panorama.edicion.nombre,
    description:
      'Distribución de los cinco bloques del censo de ortodoncia: visibilidad, reputación, contenido, respuesta y reservabilidad.',
  }
}

export default async function CensoPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<Search>
}) {
  const [{ edicionId }, search] = await Promise.all([params, searchParams])
  const [user, categorias] = await Promise.all([getSessionUser(), getCategoriasCiudad()])

  const corte = search.ciudad && categorias.some((c) => c.slug === search.ciudad) ? search.ciudad : undefined
  const panorama = await getPanorama(edicionId, corte)
  if (!panorama) notFound()

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <Link href="/estudios" className="text-[12px] text-[var(--color-accent)]">
          ← Todos los estudios
        </Link>

        <div className="mt-4">
          <SectionTitle
            eyebrow="Censo de ortodoncia · Colombia"
            title={panorama.edicion.nombre}
            lead="Cinco bloques observados desde fuera: si apareces cuando alguien busca, qué encuentra cuando te compara, si publicas, qué pasa cuando te escribe, y qué tan fácil es cerrar una cita. Ningún indicador depende de que el consultorio conteste una encuesta."
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[12px] text-[var(--color-muted)]">Corte:</span>
          <Link
            href={`/estudios/censo/${edicionId}`}
            className={`rounded-full border px-3 py-1.5 text-[12px] ${
              !corte
                ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                : 'border-[var(--color-hair)] text-[var(--color-ink-2)] hover:border-[var(--color-axis)]'
            }`}
          >
            Todo el censo
          </Link>
          {categorias.map((categoria) => (
            <Link
              key={categoria.slug}
              href={`/estudios/censo/${edicionId}?ciudad=${categoria.slug}`}
              className={`rounded-full border px-3 py-1.5 text-[12px] ${
                corte === categoria.slug
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                  : 'border-[var(--color-hair)] text-[var(--color-ink-2)] hover:border-[var(--color-axis)]'
              }`}
            >
              {categoria.nombre}
            </Link>
          ))}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="space-y-6">
            <Card className="p-6">
              <SectionTitle
                eyebrow="Dónde está el sector"
                title="Distribución de los cinco bloques"
                lead="Cada barra es la distribución del puntaje de un bloque en el corte seleccionado. La banda gris es la mitad central; la marca vertical, la mediana."
              />
              <div className="mt-6">
                <PercentileLegend showValue={false} />
                <div className="mt-5 space-y-6">
                  {panorama.bloques.map((bloque) =>
                    bloque.n === 0 ? (
                      <p
                        key={bloque.bloque}
                        className="text-[13px] leading-relaxed text-[var(--color-ink-2)]"
                      >
                        <span className="font-medium">{bloque.nombre}:</span> sin medir en este
                        corte.
                      </p>
                    ) : (
                      <div key={bloque.bloque}>
                        <PercentileBullet
                          label={bloque.nombre}
                          unit="count"
                          direction="higher_better"
                          distribution={{
                            kpiSlug: bloque.bloque,
                            p10: bloque.p10,
                            p25: bloque.p25,
                            p50: bloque.p50,
                            p75: bloque.p75,
                            p90: bloque.p90,
                            sampleSize: bloque.n,
                            sourceNote: '',
                          }}
                        />
                        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-[var(--color-ink-2)]">
                          {getBloque(bloque.bloque).claim}
                          {bloque.noMedidos > 0 ? (
                            <span className="text-[var(--color-muted)]">
                              {' '}
                              {bloque.noMedidos} consultorios de este corte quedaron sin medir en
                              este bloque.
                            </span>
                          ) : null}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </Card>

            {panorama.bloques.map((bloque) => {
              const resumenes = panorama.indicadores.filter(
                (r) => r.indicador.bloque === bloque.bloque,
              )
              if (resumenes.length === 0) return null
              return (
                <Card key={bloque.bloque} className="p-6">
                  <SectionTitle
                    eyebrow={`Bloque · mediana ${Math.round(bloque.p50)}`}
                    title={bloque.nombre}
                    lead={getBloque(bloque.bloque).claim}
                  />
                  <div className="mt-6">
                    <ResumenIndicadores resumenes={resumenes} />
                  </div>
                </Card>
              )
            })}
          </div>

          <div className="space-y-6 lg:sticky lg:top-6">
            <FichaTecnica edicion={panorama.edicion} nCorte={panorama.n} />

            <Card className="p-6">
              <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
                ¿Dónde cae tu consultorio?
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                Tu consultorio ya está en el censo: el puntaje se calculó sin que tuvieras que
                contestar nada. Reclama tu ficha y verás tus cinco bloques con tu percentil
                nacional y el de tu grupo de ciudad.
              </p>
              <Link
                href="/plataforma"
                className="mt-4 inline-block rounded-md bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-accent)]"
              >
                Reclamar mi consultorio
              </Link>
            </Card>

            <Card className="p-6">
              <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
                Cómo se lee un bloque no medido
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                Un bloque sin datos aparece como <strong>no medido</strong>, nunca como cero. Si el
                rastreador no pudo leer un sitio, eso no significa que el consultorio no tenga
                reserva en línea: significa que no se sabe. La diferencia importa, y es la razón de
                que la columna «sin medir» esté en todas las tablas.
              </p>
            </Card>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
