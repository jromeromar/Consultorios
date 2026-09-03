import { INSTRUMENTO } from '@/contenido/landing'

/**
 * La pantalla del índice: un número, el percentil y las cinco barras con su peso.
 *
 * Es el visual de apoyo que el copy pide, y es la demo: quien llega del stand ya
 * la vio. Los datos van marcados como ejemplo, y nunca hay una cara.
 *
 * Una sola serie, un solo color: la longitud de la barra ya codifica la
 * magnitud, así que el color no vuelve a decirlo.
 */

const EJEMPLO = {
  indice: 41,
  percentil: 28,
  dimensiones: [
    { id: 'presencia', valor: 62 },
    { id: 'prueba-social', valor: 24 },
    { id: 'encontrabilidad', valor: 38 },
    { id: 'respuesta', valor: 51 },
    { id: 'reservabilidad', valor: 0 },
  ],
} as const

export function PanelIndice() {
  return (
    <figure className="panel m-0">
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="etiqueta" style={{ color: 'color-mix(in srgb, currentColor 62%, transparent)' }}>
          Índice de Reputación
        </span>
        <span
          className="etiqueta"
          style={{ color: 'color-mix(in srgb, currentColor 62%, transparent)' }}
        >
          Datos de ejemplo
        </span>
      </figcaption>

      <div className="mt-5 flex items-end gap-5">
        <div className="cifra">{EJEMPLO.indice}</div>
        <div className="pb-2">
          <div className="dato text-[13px] leading-tight opacity-70">de 100</div>
          <div className="dato mt-2 text-[15px] leading-tight">
            percentil {EJEMPLO.percentil}
          </div>
          <div className="dato text-[12px] leading-tight opacity-70">
            frente a tu especialidad en tu ciudad
          </div>
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {INSTRUMENTO.dimensiones.map((d) => {
          const valor = EJEMPLO.dimensiones.find((x) => x.id === d.id)?.valor ?? 0
          return (
            <li key={d.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] font-medium">{d.nombre}</span>
                <span className="dato text-[12.5px] opacity-70">
                  peso {d.peso} · {valor}
                </span>
              </div>
              <div className="barra-pista">
                <div className="barra-valor" style={{ width: `${Math.max(1.5, valor)}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}
