import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { Formulario } from '@/components/landing/Formulario'
import { PanelFuentes } from '@/components/landing/PanelFuentes'
import { PanelIndice } from '@/components/landing/PanelIndice'
import {
  CIERRE,
  CONFIG,
  CONTACTO,
  DIMENSIONES,
  DIRECTORIOS,
  HECHOS,
  INDICE,
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

export const metadata: Metadata = {
  title: META.title,
  description: META.description,
}

/**
 * Encabezado de sección, en los tres niveles de profundidad que la página
 * promete y en el mismo orden siempre:
 *
 *   tag · la pregunta que la sección responde
 *   h2  · la respuesta en una frase, que se sostiene sola al hacer skimming
 *   h3  · la misma respuesta con un grado más de detalle
 *
 * Un solo componente para las diez secciones: si un nivel faltara en una, se
 * vería de inmediato, y ninguna puede inventarse una jerarquía propia.
 */
function Encabezado({
  tag,
  h2,
  h3,
  insignia,
}: {
  tag: string
  h2: string
  h3: string
  insignia?: ReactNode
}) {
  return (
    <div className="encabezado">
      <p className="tag">{tag}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2>{h2}</h2>
        {insignia}
      </div>
      <h3>{h3}</h3>
    </div>
  )
}

/**
 * Landing de Kleia · servicio de reputación.
 *
 * El copy vive entero en src/contenido/landing.ts, y cada decisión que el copy
 * dejó abierta es un interruptor de CONFIG. Esta página solo compone.
 *
 * Sin imágenes: el copy prohíbe fotos de pacientes y de tratamientos, y la única
 * transformación que se muestra es de datos.
 */
export default function Landing() {
  return (
    <>
      {/* Verificación 10: mientras nadie firme la segunda revisión, la página se
          anuncia como borrador. Y si el número de contacto es un marcador, lo
          dice, porque sin él ninguna solicitud llega a ninguna parte. */}
      {REVISION === null || !CONTACTO.numeroDefinido ? (
        <div className="cintillo">
          <strong>Borrador</strong>{' '}
          {REVISION === null ? 'Sin la segunda revisión de copy firmada.' : null}{' '}
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
            {/* Para quién es, antes del titular: quien no encaje se excluye en
                cuatro segundos en vez de concluir que no se entiende. */}
            <p className="segmento">{PORTADA.segmento}</p>
            <h1 className="mt-5 max-w-[24ch] text-[clamp(32px,4.8vw,52px)] font-semibold leading-[1.06] tracking-[-0.03em] text-balance">
              {PORTADA.h1}
            </h1>
            <p className="prosa mt-6">{PORTADA.subtitulo}</p>
            <p className="mt-5 max-w-[58ch] border-l-2 pl-4 text-[14.5px] leading-relaxed text-[var(--color-tinta-2)] border-[var(--color-linea-fuerte)]">
              {PORTADA.noAplica}
            </p>
            <Formulario />
          </div>
          <PanelFuentes />
        </div>
      </header>

      <main className="medida">
        {/* ── qué encontramos · sustituye a la barra de logos ────────────── */}
        <section className="seccion">
          <Encabezado tag={HECHOS.tag} h2={HECHOS.h2} h3={HECHOS.h3} />
          <ul className="mt-8 grid gap-8 sm:grid-cols-3">
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
        </section>

        {/* ── qué está pasando ───────────────────────────────────────────── */}
        <section className="seccion">
          <Encabezado tag={PROBLEMA.tag} h2={PROBLEMA.h2} h3={PROBLEMA.h3} />
          <div className="prosa mt-8">
            {PROBLEMA.parrafos.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
        </section>

        {/* ── qué se puede medir ─────────────────────────────────────────── */}
        <section className="seccion">
          <Encabezado tag={DIMENSIONES.tag} h2={DIMENSIONES.h2} h3={DIMENSIONES.h3} />
          <p className="entrada">{DIMENSIONES.intro}</p>
          <ul className="mt-8 grid gap-px overflow-hidden rounded-[3px] border border-[var(--color-linea)] bg-[var(--color-linea)] sm:grid-cols-2 lg:grid-cols-3">
            {DIMENSIONES.items.map((d) => (
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
        </section>

        {/* ── en qué se diferencia de un directorio ─────────────────────── */}
        <section className="seccion">
          <Encabezado tag={DIRECTORIOS.tag} h2={DIRECTORIOS.h2} h3={DIRECTORIOS.h3} />
          <ul className="mt-7 grid gap-7 sm:grid-cols-3">
            {DIRECTORIOS.items.map((d) => (
              <li key={d.titulo}>
                <p className="text-[15px] font-semibold">{d.titulo}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-tinta-2)]">
                  {d.texto}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── cómo lo medimos ────────────────────────────────────────────── */}
        <section className="seccion">
          <Encabezado
            tag={INDICE.tag}
            h2={INDICE.h2}
            h3={INDICE.h3}
            insignia={
              !CONFIG.indiceCalibrado ? <span className="insignia">{INDICE.insignia}</span> : null
            }
          />
          <p className="entrada">
            {CONFIG.indiceCalibrado ? INDICE.introCalibrado : INDICE.introEnCalibracion}
          </p>
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_1.15fr] lg:items-start">
            <PanelIndice />
            <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
              {INDICE.reglas.map((r) => (
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

        {/* ── qué hacemos ────────────────────────────────────────────────── */}
        <section className="seccion">
          <Encabezado tag={PALANCAS.tag} h2={PALANCAS.h2} h3={PALANCAS.h3} />
          <p className="entrada">{PALANCAS.intro}</p>

          <ul className="mt-8 divide-y divide-[var(--color-linea)] border-y border-[var(--color-linea)]">
            {PALANCAS.items.map((p) => (
              <li
                key={p.dimension}
                className="grid gap-2 py-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8"
              >
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
        </section>

        {/* ── cómo trabajar con nosotros ─────────────────────────────────────── */}
        <section className="seccion">
          <Encabezado tag={PASOS.tag} h2={PASOS.h2} h3={PASOS.h3} />
          <ol className="mt-8 grid gap-px overflow-hidden rounded-[3px] border border-[var(--color-linea)] bg-[var(--color-linea)] sm:grid-cols-3">
            {PASOS.items.map((p) => (
              <li key={p.numero} className="bg-[var(--color-papel-2)] p-5">
                <span className="dato text-[12px] text-[var(--color-tenue)]">
                  {String(p.numero).padStart(2, '0')}
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
        </section>

        {/* ── qué no somos ───────────────────────────────────────────────── */}
        <section className="seccion">
          <Encabezado tag={NO_SOMOS.tag} h2={NO_SOMOS.h2} h3={NO_SOMOS.h3} />
          <ul className="mt-7 grid gap-7 sm:grid-cols-2">
            {NO_SOMOS.items.map((n) => (
              <li key={n.titulo}>
                <p className="text-[15px] font-semibold">{n.titulo}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-tinta-2)]">
                  {n.texto}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── cuánto cuesta · solo si la decisión de oferta está tomada ──── */}
        {CONFIG.mostrarPrecio ? (
          <section className="seccion">
            <Encabezado tag={PRECIO.tag} h2={PRECIO.h2} h3={PRECIO.h3} />
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
          </section>
        ) : null}

        {/* ── qué nos preguntan ───────────────────────────────────────────── */}
        <section className="seccion">
          <Encabezado tag={PREGUNTAS.tag} h2={PREGUNTAS.h2} h3={PREGUNTAS.h3} />
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
        </section>

        {/* ── por dónde empezamos ──────────────────────────────────────────── */}
        <section className="seccion border-b border-[var(--color-linea)]">
          <Encabezado tag={CIERRE.tag} h2={CIERRE.h2} h3={CIERRE.h3} />
          <p className="entrada">{CIERRE.cuerpo}</p>
          <a className="boton mt-6" href="#medir">
            {CIERRE.cta}
          </a>
          <p className="dato mt-3 text-[12.5px] text-[var(--color-tenue)]">{CIERRE.microcopy}</p>
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
