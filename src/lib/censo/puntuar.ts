/**
 * Cálculo del puntaje del censo.
 *
 * Puro: recibe valores crudos por consultorio y las filas de `formula_puntaje`,
 * y devuelve lo que va a la tabla `puntaje`. No toca la base de datos, así que se
 * puede verificar con un caso a mano.
 *
 * Reglas que vienen del modelo y no son negociables aquí:
 *
 *  - Un dato ausente NO es un cero. El indicador queda fuera del promedio del
 *    bloque y, si el bloque entero queda sin datos, su puntaje es nulo y el
 *    bloque aparece en `bloques_no_medidos`. El informe lo muestra como no
 *    medido, que es distinto de mostrar un cero.
 *  - `no_observado` tampoco es un cero: significa que la conversación no permite
 *    afirmarlo, y se trata como ausente.
 *  - La fórmula manda. Los pesos, las transformaciones y la dirección salen de
 *    `formula_puntaje`, no del código, y cada puntaje guarda con qué versión se
 *    calculó.
 */

import { BLOQUES, type BloqueId, type Direccion } from './indicadores'

/** Mínimo de observaciones para publicar un percentil de grupo de ciudad. */
export const MINIMO_GRUPO = 12

export type ValorCrudo = number | boolean | string | null | undefined

/** Una fila de `formula_puntaje`, ya parseada. */
export type ReglaFormula = {
  version: string
  bloque: BloqueId
  indicador: string
  peso: number
  /** Texto tal como está en la tabla: `log_acotada(2,2880)`, `mapa_enum(si=100,no=0)`… */
  transformacion: string
  direccion: Direccion
}

export type EntradaConsultorio = {
  consultorioId: string
  /** Grupo de ciudad para el percentil de grupo. */
  categoriaCiudad: string | null
  /** Valores crudos por slug de indicador. Ausente o null = no medido. */
  valores: Record<string, ValorCrudo>
}

export type PuntajeIndicador = {
  indicador: string
  bloque: BloqueId
  crudo: ValorCrudo
  /** 0–100 ya orientado (más alto = mejor), o null si no se midió. */
  puntaje: number | null
}

export type PuntajeConsultorio = {
  consultorioId: string
  indicadores: PuntajeIndicador[]
  porBloque: Record<BloqueId, number | null>
  general: number | null
  bloquesNoMedidos: BloqueId[]
  percentilGeneral: number | null
  percentilPorBloque: Record<BloqueId, number | null>
  percentilGrupoCiudad: number | null
}

// ── Transformaciones ────────────────────────────────────────────────────────

type TransformacionParseada =
  | { tipo: 'booleano' }
  | { tipo: 'identidad_pct' }
  | { tipo: 'percentil_universo' }
  | { tipo: 'lineal_acotada'; min: number; max: number }
  | { tipo: 'log_acotada'; min: number; max: number }
  | { tipo: 'mapa_enum'; mapa: Record<string, number> }

/** Lee el texto de `formula_puntaje.transformacion`. */
export function parsearTransformacion(texto: string): TransformacionParseada {
  const match = /^(\w+)(?:\(([^)]*)\))?$/.exec(texto.trim())
  if (!match) throw new Error(`Transformación ilegible: «${texto}»`)
  const [, tipo, args = ''] = match

  switch (tipo) {
    case 'booleano':
      return { tipo: 'booleano' }
    case 'identidad_pct':
      return { tipo: 'identidad_pct' }
    case 'percentil_universo':
      return { tipo: 'percentil_universo' }
    case 'lineal_acotada':
    case 'log_acotada': {
      const [min, max] = args.split(',').map((v) => Number(v.trim()))
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        throw new Error(`Cotas inválidas en «${texto}»`)
      }
      return { tipo, min, max }
    }
    case 'mapa_enum': {
      const mapa: Record<string, number> = {}
      for (const par of args.split(',')) {
        const [clave, valor] = par.split('=')
        if (!clave) continue
        const n = Number(valor)
        if (!Number.isFinite(n)) throw new Error(`Mapa inválido en «${texto}»`)
        mapa[clave.trim()] = n
      }
      return { tipo: 'mapa_enum', mapa }
    }
    default:
      throw new Error(`Transformación desconocida: «${tipo}»`)
  }
}

const clamp100 = (n: number) => Math.min(100, Math.max(0, n))

/**
 * Convierte a número solo si hay dato. Existe porque `Number(null)` es 0 y eso
 * convertiría un indicador no medido en el peor valor posible — exactamente lo
 * que el modelo prohíbe.
 */
function aNumero(valor: ValorCrudo): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  if (valor === 'no_observado' || valor === 'no_dice') return null
  if (typeof valor === 'boolean') return valor ? 1 : 0
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

/**
 * Lleva un valor crudo a 0–100 sin orientar todavía (eso lo hace `orientar`).
 * Devuelve null cuando no hay dato: `percentil_universo` se resuelve fuera,
 * porque necesita ver todo el universo.
 */
function aEscala(valor: ValorCrudo, t: TransformacionParseada): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  // `no_observado` no es un no: es que no se puede afirmar.
  if (valor === 'no_observado' || valor === 'no_dice') return null

  switch (t.tipo) {
    case 'booleano':
      if (typeof valor === 'boolean') return valor ? 100 : 0
      if (valor === 'si') return 100
      if (valor === 'no') return 0
      return null

    case 'identidad_pct': {
      const n = aNumero(valor)
      return n === null ? null : clamp100(n)
    }

    case 'lineal_acotada': {
      const n = aNumero(valor)
      if (n === null) return null
      return clamp100(((n - t.min) / (t.max - t.min)) * 100)
    }

    case 'log_acotada': {
      const n = aNumero(valor)
      if (n === null) return null
      // log1p para admitir el cero, que en varios indicadores es legítimo.
      const lo = Math.log1p(Math.max(0, t.min))
      const hi = Math.log1p(Math.max(0, t.max))
      const v = Math.log1p(Math.max(0, n))
      return clamp100(((v - lo) / (hi - lo)) * 100)
    }

    case 'mapa_enum': {
      if (typeof valor !== 'string') return null
      const n = t.mapa[valor]
      return n === undefined ? null : clamp100(n)
    }

    case 'percentil_universo':
      // Se resuelve en la segunda pasada.
      return null
  }
}

/** Aplica la dirección: en `menos_es_mejor` el puntaje se invierte. */
function orientar(escala: number, direccion: Direccion): number {
  return direccion === 'mas_es_mejor' ? escala : 100 - escala
}

// ── Percentiles ─────────────────────────────────────────────────────────────

/**
 * Rango percentil de `valor` dentro de `poblacion`, por el método del rango
 * medio: cuenta los menores más la mitad de los empates. Con empates masivos
 * —y un booleano los produce— es el único que no regala el percentil 100 a
 * todo el que tiene el valor alto.
 */
export function rangoPercentil(valor: number, poblacion: number[]): number {
  if (poblacion.length === 0) return 50
  let menores = 0
  let iguales = 0
  for (const v of poblacion) {
    if (v < valor) menores += 1
    else if (v === valor) iguales += 1
  }
  return ((menores + iguales / 2) / poblacion.length) * 100
}

// ── Cálculo ─────────────────────────────────────────────────────────────────

function mediaPonderada(items: { puntaje: number; peso: number }[]): number | null {
  const usables = items.filter((i) => i.peso > 0)
  if (usables.length === 0) return null
  const total = usables.reduce((s, i) => s + i.peso, 0)
  if (total === 0) return null
  return usables.reduce((s, i) => s + i.puntaje * i.peso, 0) / total
}

export type ResultadoPuntuacion = {
  version: string
  /** Peso de cada bloque en el puntaje general. */
  pesoBloque: Record<BloqueId, number>
  consultorios: PuntajeConsultorio[]
}

/**
 * Puntúa el universo entero de una edición.
 *
 * Dos pasadas por necesidad: los indicadores con transformación
 * `percentil_universo` y todos los percentiles necesitan ver la población
 * completa antes de poder situar a nadie.
 */
export function puntuarUniverso(
  entradas: EntradaConsultorio[],
  reglas: ReglaFormula[],
  opciones: { minimoGrupo?: number } = {},
): ResultadoPuntuacion {
  if (reglas.length === 0) throw new Error('Sin reglas de fórmula: no hay nada con que puntuar')
  const version = reglas[0].version
  const minimoGrupo = opciones.minimoGrupo ?? MINIMO_GRUPO

  const parseadas = reglas.map((r) => ({ ...r, t: parsearTransformacion(r.transformacion) }))

  // Pasada 1 — escala directa, y recolección de crudos para percentil_universo.
  const crudosPorIndicador = new Map<string, number[]>()
  for (const regla of parseadas) {
    if (regla.t.tipo !== 'percentil_universo') continue
    const valores: number[] = []
    for (const e of entradas) {
      const n = aNumero(e.valores[regla.indicador])
      if (n !== null) valores.push(n)
    }
    crudosPorIndicador.set(regla.indicador, valores)
  }

  const parciales = entradas.map((entrada) => {
    const indicadores: PuntajeIndicador[] = parseadas.map((regla) => {
      const crudo = entrada.valores[regla.indicador] ?? null
      let escala: number | null

      if (regla.t.tipo === 'percentil_universo') {
        const n = aNumero(crudo)
        const poblacion = crudosPorIndicador.get(regla.indicador) ?? []
        // Sin dato propio, o sin población con la que comparar, no se puede
        // situar a nadie: es no medido, no un cero.
        escala = n === null || poblacion.length === 0 ? null : rangoPercentil(n, poblacion)
      } else {
        escala = aEscala(crudo, regla.t)
      }

      return {
        indicador: regla.indicador,
        bloque: regla.bloque,
        crudo,
        puntaje: escala === null ? null : orientar(escala, regla.direccion),
      }
    })

    const porBloque = {} as Record<BloqueId, number | null>
    const bloquesNoMedidos: BloqueId[] = []

    for (const bloque of BLOQUES) {
      const items = indicadores
        .filter((i) => i.bloque === bloque.id && i.puntaje !== null)
        .map((i) => ({
          puntaje: i.puntaje!,
          peso: parseadas.find((r) => r.indicador === i.indicador)!.peso,
        }))
      const valor = mediaPonderada(items)
      porBloque[bloque.id] = valor
      if (valor === null) bloquesNoMedidos.push(bloque.id)
    }

    // Los cinco bloques pesan igual en el general: el documento fija los pesos
    // dentro del bloque, no entre bloques.
    const general = mediaPonderada(
      BLOQUES.filter((b) => porBloque[b.id] !== null).map((b) => ({
        puntaje: porBloque[b.id]!,
        peso: 1,
      })),
    )

    return { entrada, indicadores, porBloque, general, bloquesNoMedidos }
  })

  // Pasada 2 — percentiles sobre la población ya puntuada.
  const generales = parciales.map((p) => p.general).filter((v): v is number => v !== null)
  const porBloquePoblacion = {} as Record<BloqueId, number[]>
  for (const bloque of BLOQUES) {
    porBloquePoblacion[bloque.id] = parciales
      .map((p) => p.porBloque[bloque.id])
      .filter((v): v is number => v !== null)
  }

  const gruposCiudad = new Map<string, number[]>()
  for (const p of parciales) {
    const grupo = p.entrada.categoriaCiudad
    if (!grupo || p.general === null) continue
    const lista = gruposCiudad.get(grupo) ?? []
    lista.push(p.general)
    gruposCiudad.set(grupo, lista)
  }

  const consultorios: PuntajeConsultorio[] = parciales.map((p) => {
    const percentilPorBloque = {} as Record<BloqueId, number | null>
    for (const bloque of BLOQUES) {
      const valor = p.porBloque[bloque.id]
      percentilPorBloque[bloque.id] =
        valor === null ? null : rangoPercentil(valor, porBloquePoblacion[bloque.id])
    }

    const grupo = p.entrada.categoriaCiudad
    const poblacionGrupo = grupo ? gruposCiudad.get(grupo) ?? [] : []
    const percentilGrupoCiudad =
      p.general !== null && poblacionGrupo.length >= minimoGrupo
        ? Math.round(rangoPercentil(p.general, poblacionGrupo))
        : null

    return {
      consultorioId: p.entrada.consultorioId,
      indicadores: p.indicadores,
      porBloque: p.porBloque,
      general: p.general,
      bloquesNoMedidos: p.bloquesNoMedidos,
      percentilGeneral: p.general === null ? null : Math.round(rangoPercentil(p.general, generales)),
      percentilPorBloque,
      percentilGrupoCiudad,
    }
  })

  return {
    version,
    pesoBloque: Object.fromEntries(BLOQUES.map((b) => [b.id, 1 / BLOQUES.length])) as Record<
      BloqueId,
      number
    >,
    consultorios,
  }
}
