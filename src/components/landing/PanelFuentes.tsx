import { FUENTES } from '@/contenido/landing'

/**
 * Los seis sitios donde miramos, arriba del pliegue.
 *
 * Ocupa el lugar donde antes estaba el panel del índice. El índice era una nota
 * de 41 sobre 100 que el lector no había pedido, y lo que hacía era dejar la
 * página archivada como «otro puntaje». Esta lista responde de una vez las dos
 * preguntas que llegaron del campo: qué hacen ustedes, y en qué se diferencian
 * de Doctoralia — porque Doctoralia está en la lista.
 *
 * No hay datos de ejemplo aquí: es la lista real de fuentes, así que nada que
 * marcar como sintético.
 */
export function PanelFuentes() {
  return (
    <figure className="panel m-0">
      <figcaption
        className="etiqueta"
        style={{ color: 'color-mix(in srgb, currentColor 62%, transparent)' }}
      >
        {FUENTES.titulo}
      </figcaption>

      <ul
        className="mt-5 divide-y"
        style={{ borderColor: 'color-mix(in srgb, currentColor 14%, transparent)' }}
      >
        {FUENTES.items.map((f) => (
          <li key={f.nombre} className="py-3.5 first:pt-0">
            <div className="text-[15px] font-semibold">{f.nombre}</div>
            <p className="mt-1 text-[13px] leading-relaxed opacity-75">{f.detalle}</p>
          </li>
        ))}
      </ul>

      <p className="dato mt-5 text-[12px] leading-relaxed opacity-70">{FUENTES.nota}</p>
    </figure>
  )
}
