'use client'

import { useState } from 'react'

import { CONFIG, CONTACTO, FORMULARIO, PORTADA } from '@/contenido/landing'

/**
 * El formulario de un solo campo del copy.
 *
 * Con `CONFIG.indiceDisponible` en falso —hoy— el envío NO promete un número en
 * un minuto, porque la herramienta no existe todavía. Muestra el estado real y
 * pide un canal para enviarlo, con el nombre del consultorio ya escrito en el
 * mensaje: así nada se promete de más y ningún contacto se pierde.
 *
 * Cuando la herramienta exista, el interruptor pasa a verdadero y este mismo
 * formulario lleva al índice.
 */
export function Formulario({ id = 'medir' }: { id?: string }) {
    const [consultorio, setConsultorio] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [contacto, setContacto] = useState('')

  const nombre = consultorio.trim()
  const puedeSeguir = nombre.length >= 3

  if (!enviado) {
    return (
      <form
        id={id}
        className="mt-7"
        onSubmit={(e) => {
          e.preventDefault()
          if (puedeSeguir) setEnviado(true)
        }}
      >
        <label className="block">
          <span className="etiqueta">{PORTADA.campo}</span>
          <input
            name="consultorio"
            value={consultorio}
            onChange={(e) => setConsultorio(e.target.value)}
            autoComplete="organization"
            required
            minLength={3}
            className="dato mt-2 w-full rounded-[3px] border border-[var(--color-linea-fuerte)] bg-[var(--color-papel)] px-4 py-3.5 text-[15px] text-[var(--color-tinta)] outline-none focus-visible:border-[var(--color-acento)]"
          />
        </label>

        <button type="submit" className="boton mt-4 w-full sm:w-auto" disabled={!puedeSeguir}>
          {PORTADA.cta}
        </button>

        <p className="dato mt-3 text-[12.5px] leading-relaxed text-[var(--color-tenue)]">
          {PORTADA.microcopy}
        </p>
      </form>
    )
  }

  const estado = CONFIG.indiceDisponible ? FORMULARIO.disponible : FORMULARIO.enPreparacion
  const mensaje = encodeURIComponent(
    `Hola. Quiero el Índice de Reputación de ${nombre}.` +
      (contacto ? ` Me pueden escribir a ${contacto}.` : ''),
  )

  return (
    <div className="tarjeta mt-7 p-5">
      <p className="text-[15px] font-semibold">{estado.titulo}</p>
      <p className="dato mt-1 text-[13px] text-[var(--color-tinta-2)]">{nombre}</p>
      <p className="entrada mt-3 text-[15px]">{estado.texto}</p>

      {!CONFIG.indiceDisponible ? (
        <div className="mt-4">
          <label className="block">
            <span className="etiqueta">{FORMULARIO.enPreparacion.campoContacto}</span>
            <input
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              className="dato mt-2 w-full rounded-[3px] border border-[var(--color-linea-fuerte)] bg-[var(--color-papel)] px-4 py-3 text-[14px] text-[var(--color-tinta)] outline-none focus-visible:border-[var(--color-acento)]"
            />
          </label>
          <a
            className="boton mt-3 w-full sm:w-auto"
            href={`https://wa.me/${CONTACTO.whatsapp}?text=${mensaje}`}
            target="_blank"
            rel="noreferrer"
          >
            Enviar por WhatsApp
          </a>
          <button
            type="button"
            className="dato mt-3 block text-[12.5px] text-[var(--color-acento-ink)] underline"
            onClick={() => setEnviado(false)}
          >
            Cambiar el nombre del consultorio
          </button>
        </div>
      ) : null}
    </div>
  )
}
