import type { Metadata } from 'next'

import { Formulario } from '@/components/landing/Formulario'
import { PanelIndice } from '@/components/landing/PanelIndice'
import {
  CIERRE,
  CONFIG,
  CONTACTO,
  HECHOS,
  INSTRUMENTO,
  MARCA,
  META,
  NO_SOMOS,
  PALANCAS,
  PASOS,
  PORTADA,
  PRECIO,
  PREGUNTAS,
  PROBLEMA,
  REVISION,
} from '@/contenido/landing'

export const metadata: Metadata = { title: META.title, description: META.description }

/**
 * Landing de Kleo · servicio de reputación.
 *
 * El copy vive entero en src/contenido/landing.ts, y cada decisión que el copy
 * dejó abierta es un interruptor de CONFIG. Esta página solo compone.
 *
 * Sin imágenes: el copy prohíbe fotos de pacientes y de tratamientos, y la única
 * transformación que se muestra es de datos.
 */
export default function Landing() {
  const seccion = (n: number) => String(n).padStart(2, '0')

  return (
    <>
      {/* Verificación 10: mientras nadie firme la segunda revisión, la página se
          anuncia como borrador. Y si el número de contacto es un marcador, lo
          dice, porque sin él ninguna solicitud llega a ninguna parte. */}
      {REVISION === null || !CONTACTO.numeroDefinido ? (
        <div className="cintillo">
          <strong>Borrador</strong>{' '}
          {REVISION === null
            ? 'Sin la segunda revisión de copy firmada.'
            : null}{' '}
          {!CONTACTO.numeroDefinido
            ? 'El canal de contacto es un marcador: ninguna solicitud llega todavía.'
            : null}
        </div>
      ) : null}

      <header className="medida pt-14 pb-4 sm:pt-20">
        <div className="flex items-baseline gap-3">
          <span className="text-[19px] font-semibold tracking-tight">{MARCA.nombre}</span>
          <span className="dato hidden text-[11.5px] text-[var(--color-tenue)] sm:inline">
            {MARCA.raiz}
          </span>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1.15fr_minmax(0,0.85fr)] lg:items-start lg:gap-16">
          <div>
            <h1 className="max-w-[19ch] text-[clamp(34px,5.4vw,58px)] font-semibold leading-[1.04] tracking-[-0.03em] text-balance">
              {PORTADA.h1}
            </h1>
            <p className="prosa mt-6">{PORTADA.subtitulo}</p>
            <Formulario />
          </div>
          <PanelIndice />
        </div>
      </header>

      <main className="medida">
        {/* ── barra de hechos · sustituye a la barra de logos ────────────── */}
        <section className="seccion">
          <div className="riel">{seccion(1)}</div>
          <div>
            <p className="etiqueta">{HECHOS.encabezado}</p>
            <ul className="mt-6 grid gap-8 sm:grid-cols-3">
              {HECHOS.items.map((h) => (
                <li key={h.cifra}>
                  <div className="text-[30px] font-semibold leading-none tracking-[-0.03em]">
                    {h.cifra}
                  </div>
                  <p className="mt-3 max-w-[30ch] text-[14.5px] leading-relaxed text-[var(--color-tinta-2)]">
                    {h.texto}
                  </p>
                </li>
              ))}
            </ul>
            <p className="dato mt-8 max-w-[62ch] text-[12px] leading-relaxed text-[var(--color-tenue)]">
              {HECHOS.fuente}
            </p>
          </div>
        </section>

        {/* ── el problema ────────────────────────────────────────────────── */}
        <section className="seccion">
          <div className="riel">{seccion(2)}</div>
          <div>
            <h2>{PROBLEMA.h2}</h2>
            <div className="prosa mt-6">
              {PROBLEMA.parrafos.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* ── el instrumento ─────────────────────────────────────────────── */}
        <section className="seccion">
          <div className="riel">{seccion(3)}</div>
          <div>
            <div className="flex flex-wrap items-center gap-4">
              <h2>{INSTRUMENTO.h2}</h2>
              {!CONFIG.indiceCalibrado ? (
                <span className="insignia">{INSTRUMENTO.insignia}</span>
              ) : null}
            </div>
            <p className="entrada">
              {CONFIG.indiceCalibrado
                ? INSTRUMENTO.introCalibrado
                : INSTRUMENTO.introEnCalibracion}
            </p>

            <ul className="mt-8 grid gap-px overflow-hidden rounded-[3px] border border-[var(--color-linea)] bg-[var(--color-linea)] sm:grid-cols-2 lg:grid-cols-3">
              {INSTRUMENTO.dimensiones.map((d) => (
                <li key={d.id} className="bg-[var(--color-papel-2)] p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-semibold">{d.nombre}</span>
                    <span className="dato text-[13px] text-[var(--color-acento-ink)]">{d.peso}</span>
                  </div>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-[var(--color-tinta-2)]">
                    {d.texto}
                  </p>
                </li>
              ))}
              <li className="flex items-center bg-[var(--color-papel-2)] p-5">
                <p className="dato text-[12px] leading-relaxed text-[var(--color-tenue)]">
                  Los pesos suman 100 y están publicados aquí mismo.
                </p>
              </li>
            </ul>

            <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-3">
              {INSTRUMENTO.reglas.map((r) => (
                <div key={r.titulo}>
                  <dt className="text-[14px] font-semibold">{r.titulo}</dt>
                  <dd className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-tinta-2)]">
                    {!CONFIG.indiceCalibrado && 'textoEnCalibracion' in r
                      ? r.textoEnCalibracion
                      : r.textoCalibrado}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── qué hacemos con la medición ────────────────────────────────── */}
        <section className="seccion">
          <div className="riel">{seccion(4)}</div>
          <div>
            <h2>{PALANCAS.h2}</h2>
            <p className="entrada">{PALANCAS.intro}</p>

            <ul className="mt-8 divide-y divide-[var(--color-linea)] border-y border-[var(--color-linea)]">
              {PALANCAS.items.map((p) => (
                <li key={p.dimension} className="grid gap-2 py-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8">
                  <span className="text-[14.5px] font-semibold">{p.dimension}</span>
                  <p className="max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-tinta-2)]">
                    {p.texto}
                  </p>
                </li>
              ))}
            </ul>

            <div
              className="mt-8 rounded-[3px] p-6"
              style={{
                background: 'var(--color-acento-tenue)',
                borderLeft: '3px solid var(--color-acento)',
              }}
            >
              <p className="text-[19px] font-semibold leading-snug tracking-[-0.015em]">
                {PALANCAS.resenas.titulo}
              </p>
              <p className="mt-2.5 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-tinta-2)]">
                {PALANCAS.resenas.texto}
              </p>
            </div>
          </div>
        </section>

        {/* ── cómo funciona ──────────────────────────────────────────────── */}
        <section className="seccion">
          <div className="riel">{seccion(5)}</div>
          <div>
            <h2>{PASOS.h2}</h2>
            <ol className="mt-8 grid gap-px overflow-hidden rounded-[3px] border border-[var(--color-linea)] bg-[var(--color-linea)] sm:grid-cols-3">
              {PASOS.items.map((p) => (
                <li key={p.numero} className="bg-[var(--color-papel-2)] p-5">
                  <span className="dato text-[12px] text-[var(--color-tenue)]">
                    {seccion(p.numero)}
                  </span>
                  <p className="mt-2 text-[15px] font-semibold">{p.titulo}</p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-tinta-2)]">
                    {p.texto}
                  </p>
                </li>
              ))}
            </ol>
            <a className="boton boton-secundario mt-6" href="#medir">
              {PASOS.ctaSecundario}
            </a>
          </div>
        </section>

        {/* ── lo que esto no es ──────────────────────────────────────────── */}
        <section className="seccion">
          <div className="riel">{seccion(6)}</div>
          <div>
            <h2>{NO_SOMOS.h2}</h2>
            <ul className="mt-7 grid gap-7 sm:grid-cols-3">
              {NO_SOMOS.items.map((n) => (
                <li key={n.titulo}>
                  <p className="text-[15px] font-semibold">{n.titulo}</p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-tinta-2)]">
                    {n.texto}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── precio · solo si la decisión de oferta está tomada ─────────── */}
        {CONFIG.mostrarPrecio ? (
          <section className="seccion">
            <div className="riel">{seccion(7)}</div>
            <div>
              <h2>{PRECIO.h2}</h2>
              <p className="entrada">{PRECIO.intro}</p>
              <div className="mt-7 overflow-x-auto">
                <table className="dato w-full min-w-[560px] border-collapse text-[14px]">
                  <thead>
                    <tr className="border-b border-[var(--color-linea-fuerte)] text-left">
                      <th className="py-3 pr-4 font-medium text-[var(--color-tenue)]" />
                      {PRECIO.tramos.map((t) => (
                        <th key={t} className="py-3 pr-4 text-right font-medium">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PRECIO.filas.map((f) => (
                      <tr key={f.concepto} className="border-b border-[var(--color-linea)]">
                        <td className="py-3 pr-4">{f.concepto}</td>
                        {f.valores.map((v) => (
                          <td key={v} className="py-3 pr-4 text-right">
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <dt className="text-[14px] font-semibold">Cláusula de pausa.</dt>
                  <dd className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-tinta-2)]">
                    {CONFIG.umbralPausaDefinido ? PRECIO.pausaDefinida : PRECIO.pausaSinDefinir}
                  </dd>
                </div>
                <div>
                  <dt className="text-[14px] font-semibold">Sobre el módulo de contenido.</dt>
                  <dd className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-tinta-2)]">
                    {PRECIO.contenido}
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        ) : null}

        {/* ── preguntas ──────────────────────────────────────────────────── */}
        <section className="seccion">
          <div className="riel">{CONFIG.mostrarPrecio ? seccion(8) : seccion(7)}</div>
          <div>
            <h2>{PREGUNTAS.h2}</h2>
            <ul className="mt-7 divide-y divide-[var(--color-linea)] border-y border-[var(--color-linea)]">
              {PREGUNTAS.items.map((q) => {
                const respuesta =
                  'respuesta' in q
                    ? q.respuesta
                    : CONFIG.umbralPausaDefinido
                      ? q.respuestaDefinida
                      : q.respuestaSinDefinir
                return (
                  <li key={q.pregunta} className="py-5">
                    <p className="text-[15px] font-semibold">{q.pregunta}</p>
                    <p className="prosa mt-2 text-[16px]">{respuesta}</p>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* ── cierre ─────────────────────────────────────────────────────── */}
        <section className="seccion border-b border-[var(--color-linea)]">
          <div className="riel">{CONFIG.mostrarPrecio ? seccion(9) : seccion(8)}</div>
          <div>
            <h2>{CIERRE.h2}</h2>
            <p className="entrada">{CIERRE.cuerpo}</p>
            <a className="boton mt-6" href="#medir">
              {CIERRE.cta}
            </a>
            <p className="dato mt-3 text-[12.5px] text-[var(--color-tenue)]">{CIERRE.microcopy}</p>
          </div>
        </section>
      </main>

      <footer className="medida py-10">
        <p className="dato text-[12px] leading-relaxed text-[var(--color-tenue)]">
          {MARCA.nombre} · {MARCA.raiz}
        </p>
      </footer>
    </>
  )
}
