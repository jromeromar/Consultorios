import Link from 'next/link'

import { FunnelBars } from '@/components/charts/FunnelBars'
import { PercentileBullet, PercentileLegend } from '@/components/charts/PercentileBullet'
import { ScoreBars } from '@/components/charts/ScoreBars'
import { ScoreDial } from '@/components/charts/ScoreDial'
import { TableView } from '@/components/charts/TableView'
import { Card, DemoDataNotice, SectionTitle } from '@/components/ui/chrome'
import { formatCurrency, formatPercentile, formatValue } from '@/lib/benchmark/format'
import { getBlock, getKpi } from '@/lib/benchmark/kpis'
import { OBJETIVO_PERCENTIL, type Result } from '@/lib/benchmark/scoring'
import { getSegment, getSpecialty } from '@/lib/benchmark/taxonomy'

type Props = {
  result: Result
  leadName: string
  clinicName?: string | null
  /** `preview` recorta el detalle y empuja al registro. */
  mode: 'preview' | 'full'
  registerHref?: string
}

export function AuditReport({ result, leadName, clinicName, mode, registerHref }: Props) {
  const specialty = getSpecialty(result.specialtySlug)
  const segment = getSegment(result.segmentSlug)
  const full = mode === 'full'

  return (
    <div className="space-y-6">
      <Card className="p-6 sm:p-8">
        <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-start">
          <ScoreDial score={result.globalScore} tier={result.tier} />

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--color-muted)]">
              Auditoría vs. sector · {specialty?.name} · {segment?.name} · {result.period}
            </p>
            <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-tight text-[var(--color-ink)]">
              {clinicName || leadName}
            </h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[var(--color-ink-2)]">
              {result.tier.claim}
            </p>

            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              <Stat
                label="Puntaje global"
                value={String(result.globalScore)}
                note="Promedio ponderado de los cuatro bloques."
              />
              <Stat
                label="Índice de medición"
                value={`${result.indiceMedicion} %`}
                note={`Pudiste responder ${result.kpisRespondidos} de ${result.kpisTotales} indicadores.`}
              />
              <Stat
                label="Huecos priorizados"
                value={String(result.priorities.length)}
                note="Ordenados por cuántos puntos recuperan."
              />
            </dl>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle
            eyebrow="Dónde estás parado"
            title="Puntaje por bloque"
            lead="Cada bloque compara tus respuestas contra la distribución de tu especialidad. 50 es la mediana del sector."
          />
          <div className="mt-5">
            <ScoreBars
              bars={result.blocks.map((block) => ({
                label: block.name,
                score: block.score,
                note: getBlock(block.blockId).claim,
              }))}
            />
            <TableView
              caption="Puntaje por bloque"
              headers={['Bloque', 'Peso', 'Puntaje']}
              rows={result.blocks.map((block) => [
                block.name,
                `${Math.round(block.weight * 100)} %`,
                block.score === null ? 'sin datos' : Math.round(block.score),
              ])}
            />
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle
            eyebrow="Qué mover primero"
            title="Huecos ordenados por impacto"
            lead={`El orden no es por gravedad: es por cuántos puntos del puntaje global recuperas al llevar cada uno al percentil ${OBJETIVO_PERCENTIL}.`}
          />
          {result.priorities.length === 0 ? (
            <p className="mt-5 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
              No hay huecos por debajo del objetivo con los datos que entregaste. El siguiente
              paso es medir lo que quedó sin responder.
            </p>
          ) : (
            <ol className="mt-5 space-y-4">
              {result.priorities.slice(0, full ? undefined : 1).map((priority, index) => (
                <li key={`${priority.kind}-${priority.slug}`} className="flex gap-3">
                  <span className="tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)] text-[12px] font-semibold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--color-ink)]">
                      {priority.label}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                      {priority.meaning}
                    </p>
                    <p className="tabular mt-1 text-[12px] text-[var(--color-muted)]">
                      {getBlock(priority.block).name} · puntaje actual{' '}
                      {Math.round(priority.score)} · recupera{' '}
                      {priority.upside.toFixed(1)} pts del global
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {!full && result.priorities.length > 1 ? (
            <LockedNotice
              count={result.priorities.length - 1}
              registerHref={registerHref ?? '/registro'}
            />
          ) : null}
        </Card>
      </div>

      {full && result.funnel ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <SectionTitle
              eyebrow="Tu embudo"
              title="De contacto a caso aceptado"
              lead={`Con tus números, el embudo produce ${formatCurrency(result.funnel.ingresoActual)} al mes en tratamiento aceptado.`}
            />
            <div className="mt-5">
              <FunnelBars steps={result.funnel.steps} />
              <TableView
                caption="Etapas del embudo mensual"
                headers={['Etapa', 'Volumen mensual']}
                rows={result.funnel.steps.map((step) => [
                  step.label,
                  Math.round(step.value).toLocaleString('es-MX'),
                ])}
              />
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle
              eyebrow="Cuánto vale cerrar cada hueco"
              title="Un solo cambio a la vez"
              lead={`Cada línea lleva un único indicador al percentil ${OBJETIVO_PERCENTIL} de tu especialidad y deja el resto igual. No se suman entre sí.`}
            />
            <ul className="mt-5 space-y-3">
              {result.funnel.escenarios.map((escenario) => (
                <li
                  key={escenario.kpiSlug}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--color-hair)] pb-3 last:border-0"
                >
                  <span className="text-[13px] text-[var(--color-ink)]">{escenario.label}</span>
                  <span className="tabular text-[13px] font-semibold text-[var(--color-good)]">
                    +{formatCurrency(escenario.delta)} / mes
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] leading-relaxed text-[var(--color-muted)]">
              Modelo aritmético sobre tus propias cifras, no una proyección de resultados. Sirve
              para ordenar el esfuerzo, no como promesa.
            </p>
          </Card>
        </div>
      ) : null}

      {full ? (
        <>
          {result.blocks.map((block) => {
            const conDatos = block.kpis.filter((k) => k.distribution !== null)
            if (conDatos.length === 0 && block.practices.length === 0) return null
            return (
              <Card key={block.blockId} className="p-6">
                <SectionTitle
                  eyebrow={`Bloque · puntaje ${block.score === null ? '—' : Math.round(block.score)}`}
                  title={block.name}
                  lead={getBlock(block.blockId).claim}
                />

                {conDatos.length > 0 ? (
                  <div className="mt-6">
                    <PercentileLegend />
                    <div className="mt-5 space-y-6">
                      {conDatos.map((kpi) => (
                        <div key={kpi.kpiSlug}>
                          <PercentileBullet
                            label={kpi.name}
                            unit={kpi.unit}
                            direction={kpi.direction}
                            distribution={kpi.distribution!}
                            scale={getKpi(kpi.kpiSlug).scale}
                            value={kpi.value}
                          />
                          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-[var(--color-ink-2)]">
                            {kpi.value === null ? (
                              <>
                                <span className="font-medium">Sin medición.</span> {getKpi(kpi.kpiSlug).help}
                              </>
                            ) : kpi.position === 'rezago' ? (
                              <>
                                <span className="font-medium text-[var(--color-critical)]">
                                  Rezago ({formatPercentile(kpi.percentile)}).
                                </span>{' '}
                                {kpi.gapMeaning} Objetivo del sector:{' '}
                                {formatValue(kpi.target, kpi.unit)}.
                              </>
                            ) : kpi.position === 'promedio' ? (
                              <>
                                <span className="font-medium">
                                  En el promedio ({formatPercentile(kpi.percentile)}).
                                </span>{' '}
                                Para entrar al cuartil alto:{' '}
                                {formatValue(kpi.target, kpi.unit)}.
                              </>
                            ) : (
                              <>
                                <span className="font-medium text-[var(--color-good)]">
                                  Ventaja ({formatPercentile(kpi.percentile)}).
                                </span>{' '}
                                Está por encima de la mitad central del sector.
                                {kpi.scored ? '' : ' Este indicador se compara pero no puntúa.'}
                              </>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                    <TableView
                      caption={`Indicadores de ${block.name}`}
                      headers={['Indicador', 'Tu valor', 'p25', 'Mediana', 'p75', 'Percentil']}
                      rows={conDatos.map((kpi) => [
                        kpi.name,
                        formatValue(kpi.value, kpi.unit),
                        formatValue(kpi.distribution!.p25, kpi.unit),
                        formatValue(kpi.distribution!.p50, kpi.unit),
                        formatValue(kpi.distribution!.p75, kpi.unit),
                        formatPercentile(kpi.percentile),
                      ])}
                    />
                  </div>
                ) : null}

                {block.practices.length > 0 ? (
                  <div className="mt-7 border-t border-[var(--color-hair)] pt-5">
                    <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">
                      Prácticas del bloque
                    </h3>
                    <ul className="mt-3 space-y-4">
                      {block.practices.map((practice) => (
                        <li key={practice.practiceSlug}>
                          <p className="text-[13px] text-[var(--color-ink)]">{practice.question}</p>
                          <p className="mt-1 text-[13px] text-[var(--color-ink-2)]">
                            {practice.optionLabel ? (
                              <>
                                <span className="text-[var(--color-muted)]">Respondiste:</span>{' '}
                                {practice.optionLabel}
                              </>
                            ) : (
                              <span className="text-[var(--color-muted)]">Sin responder.</span>
                            )}
                          </p>
                          {practice.score !== null && practice.score < 75 ? (
                            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-ink-2)]">
                              {practice.gapMeaning}{' '}
                              <span className="text-[var(--color-muted)]">
                                Referencia del cuartil alto: {practice.bestLabel}
                              </span>
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Card>
            )
          })}
        </>
      ) : (
        <Card className="p-6">
          <SectionTitle
            eyebrow="Lo que falta"
            title="La auditoría completa está lista"
            lead="Incluye tus 14 indicadores contra la distribución de tu especialidad, tu embudo mensual reconstruido y el valor en pesos de cerrar cada hueco."
          />
          <Link
            href={registerHref ?? '/registro'}
            className="mt-5 inline-block rounded-md bg-[var(--color-brand)] px-5 py-2.5 text-[13px] font-medium text-white hover:bg-[var(--color-accent)]"
          >
            Crear mi cuenta y abrir la auditoría
          </Link>
        </Card>
      )}

      <DemoDataNotice />
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">{label}</dt>
      <dd className="mt-1 text-[22px] font-semibold leading-none text-[var(--color-ink)]">
        {value}
      </dd>
      <dd className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-ink-2)]">{note}</dd>
    </div>
  )
}

function LockedNotice({ count, registerHref }: { count: number; registerHref: string }) {
  return (
    <p className="mt-5 rounded-md border border-dashed border-[var(--color-axis)] bg-[var(--color-surface-2)] px-4 py-3 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
      Hay {count} {count === 1 ? 'hueco más' : 'huecos más'} priorizados en tu auditoría completa.{' '}
      <Link href={registerHref} className="font-medium text-[var(--color-accent)] underline">
        Crea tu cuenta
      </Link>{' '}
      para verlos con el detalle por indicador.
    </p>
  )
}
