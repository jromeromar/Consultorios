import type { Edicion } from '@/lib/censo/queries'

/**
 * Ficha técnica generada desde `edicion_estudio`, no escrita a mano. Es lo que
 * el modelo pide: la muestra que declara la portada y la que se usó para
 * calcular no pueden separarse.
 */
export function FichaTecnica({ edicion, nCorte }: { edicion: Edicion; nCorte?: number }) {
  const municipios = edicion.municipiosIncluidos?.split(';').filter(Boolean) ?? []
  const esDemo =
    /demostraci[oó]n/i.test(edicion.nombre) || /sint[eé]tic/i.test(edicion.notasMetodo ?? '')

  const filas: [string, string][] = [
    ['Universo', edicion.nUniverso === null ? 'no calculado' : `${edicion.nUniverso} consultorios`],
    ['Muestra de campo', edicion.nMuestra === null ? '—' : `${edicion.nMuestra} contactados`],
    ['Respondieron', edicion.nRespondio === null ? '—' : `${edicion.nRespondio}`],
    ['Corte de reloj', edicion.corteRelojHoras ? `${edicion.corteRelojHoras} horas` : '—'],
    [
      'Trabajo de campo',
      edicion.campoInicio && edicion.campoFin ? `${edicion.campoInicio} a ${edicion.campoFin}` : '—',
    ],
    ['Municipios', municipios.length > 0 ? String(municipios.length) : '—'],
    ['Versión de la fórmula', edicion.versionFormula ?? '—'],
  ]

  return (
    <div className="rounded-md border border-[var(--color-hair)] bg-[var(--color-surface-2)] p-4">
      <h2 className="text-[13px] font-semibold text-[var(--color-ink)]">Ficha técnica</h2>
      {esDemo ? (
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-critical)]">
          <strong className="font-semibold">Edición de demostración.</strong> Los consultorios de
          esta edición son sintéticos: sirven para operar la plataforma antes del primer
          levantamiento real, no como resultado de un censo.
        </p>
      ) : null}
      <dl className="tabular mt-3 space-y-1.5 text-[12px]">
        {nCorte !== undefined ? (
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-muted)]">Consultorios en este corte</dt>
            <dd className="text-[var(--color-ink)]">{nCorte}</dd>
          </div>
        ) : null}
        {filas.map(([clave, valor]) => (
          <div key={clave} className="flex justify-between gap-4">
            <dt className="text-[var(--color-muted)]">{clave}</dt>
            <dd className="text-right text-[var(--color-ink)]">{valor}</dd>
          </div>
        ))}
      </dl>
      {edicion.notasMetodo ? (
        <p className="mt-3 border-t border-[var(--color-hair)] pt-3 text-[12px] leading-relaxed text-[var(--color-ink-2)]">
          {edicion.notasMetodo}
        </p>
      ) : null}
    </div>
  )
}
