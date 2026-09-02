import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { INDICADORES } from './indicadores'
import {
  MINIMO_GRUPO,
  parsearTransformacion,
  puntuarUniverso,
  rangoPercentil,
  type EntradaConsultorio,
  type ReglaFormula,
} from './puntuar'

/** Las mismas reglas que `seedFormulaPuntaje` escribe en la base. */
const REGLAS: ReglaFormula[] = INDICADORES.map((i) => ({
  version: 'v0-propuesta',
  bloque: i.bloque,
  indicador: i.slug,
  peso: i.pesoPropuesto,
  transformacion: i.cotas
    ? `${i.transformacion}(${i.cotas[0]},${i.cotas[1]})`
    : i.mapa
      ? `${i.transformacion}(${Object.entries(i.mapa)
          .map(([k, v]) => `${k}=${v}`)
          .join(',')})`
      : i.transformacion,
  direccion: i.direccion,
}))

function puntuarUno(valores: Record<string, unknown>, categoriaCiudad = 'capital_principal') {
  const entrada: EntradaConsultorio = {
    consultorioId: 'x',
    categoriaCiudad,
    valores: valores as EntradaConsultorio['valores'],
  }
  return puntuarUniverso([entrada], REGLAS).consultorios[0]
}

const indicador = (r: ReturnType<typeof puntuarUno>, slug: string) =>
  r.indicadores.find((i) => i.indicador === slug)!

describe('parsearTransformacion', () => {
  it('lee todas las transformaciones del catálogo sembrado', () => {
    for (const regla of REGLAS) {
      assert.doesNotThrow(() => parsearTransformacion(regla.transformacion), regla.indicador)
    }
  })

  it('rechaza cotas invertidas y transformaciones desconocidas', () => {
    assert.throws(() => parsearTransformacion('lineal_acotada(10,1)'))
    assert.throws(() => parsearTransformacion('raiz_cuadrada(1,2)'))
  })
})

describe('escalas', () => {
  it('orienta menos_es_mejor: responder rápido puntúa alto', () => {
    const rapido = indicador(puntuarUno({ minutos_primera_respuesta: 2 }), 'minutos_primera_respuesta')
    const lento = indicador(puntuarUno({ minutos_primera_respuesta: 2880 }), 'minutos_primera_respuesta')
    assert.equal(rapido.puntaje, 100)
    assert.equal(lento.puntaje, 0)
  })

  it('la escala logarítmica da resolución donde la lineal la aplasta', () => {
    const p = (m: number) =>
      indicador(puntuarUno({ minutos_primera_respuesta: m }), 'minutos_primera_respuesta').puntaje!
    // Contestar en 2 minutos y contestar en 10 son mundos distintos para el
    // paciente. En una escala lineal sobre [2, 2880] esa diferencia sería de
    // menos de un punto; en logarítmica son más de diez.
    const enLineal = ((10 - 2) / (2880 - 2)) * 100
    assert.ok(enLineal < 1)
    assert.ok(p(2) - p(10) > 10)
  })

  it('recorta fuera de las cotas en vez de salirse de 0–100', () => {
    assert.equal(indicador(puntuarUno({ calificacion: 5.5 }), 'calificacion').puntaje, 100)
    assert.equal(indicador(puntuarUno({ calificacion: 1 }), 'calificacion').puntaje, 0)
  })

  it('mapa_enum puntúa por valor y deja fuera lo que no está en el mapa', () => {
    assert.equal(indicador(puntuarUno({ dio_precio: 'exacto' }), 'dio_precio').puntaje, 100)
    assert.equal(indicador(puntuarUno({ dio_precio: 'rango' }), 'dio_precio').puntaje, 70)
    assert.equal(indicador(puntuarUno({ dio_precio: 'no' }), 'dio_precio').puntaje, 0)
  })
})

describe('un dato ausente no es un cero', () => {
  it('sin ningún dato, los cinco bloques quedan no medidos y el general es nulo', () => {
    const r = puntuarUno({})
    assert.equal(r.bloquesNoMedidos.length, 5)
    assert.equal(r.general, null)
    assert.equal(r.percentilGeneral, null)
  })

  it('un bloque con datos no arrastra a los que no los tienen', () => {
    const r = puntuarUno({ hubo_respuesta: true, minutos_primera_respuesta: 8 })
    assert.ok(r.porBloque.respuesta !== null)
    assert.equal(r.porBloque.visibilidad, null)
    assert.ok(r.bloquesNoMedidos.includes('visibilidad'))
    assert.ok(!r.bloquesNoMedidos.includes('respuesta'))
  })

  it('percentil_universo sin población no inventa un percentil', () => {
    // Un solo consultorio, sin valor propio: no hay con qué compararlo.
    assert.equal(indicador(puntuarUno({}), 'presencia_paquete_local').puntaje, null)
  })

  it('un nulo no se convierte en el peor valor posible', () => {
    // Number(null) es 0: si se colara, este indicador puntuaría 0 en vez de null.
    assert.equal(indicador(puntuarUno({ calificacion: null }), 'calificacion').puntaje, null)
  })
})

describe('no_observado no es un no', () => {
  it('sale del promedio del bloque en vez de puntuar cero', () => {
    const dijoNo = puntuarUno({ hubo_respuesta: true, ofrecio_agendar: 'no' })
    const noSeObservo = puntuarUno({ hubo_respuesta: true, ofrecio_agendar: 'no_observado' })
    assert.ok(noSeObservo.porBloque.respuesta! > dijoNo.porBloque.respuesta!)
  })
})

describe('rangoPercentil', () => {
  it('usa el rango medio, así que un booleano no regala el percentil 100', () => {
    const poblacion = [...Array(60).fill(0), ...Array(40).fill(100)]
    assert.equal(rangoPercentil(0, poblacion), 30)
    assert.equal(rangoPercentil(100, poblacion), 80)
  })

  it('con población vacía devuelve la mediana en vez de fallar', () => {
    assert.equal(rangoPercentil(10, []), 50)
  })
})

describe('percentil de grupo de ciudad', () => {
  const grupo = (n: number, cat: string): EntradaConsultorio[] =>
    Array.from({ length: n }, (_, i) => ({
      consultorioId: `${cat}-${i}`,
      categoriaCiudad: cat,
      valores: { hubo_respuesta: i % 2 === 0, minutos_primera_respuesta: 10 + i },
    }))

  it('se publica solo si el grupo llega al mínimo de observaciones', () => {
    const res = puntuarUniverso(
      [...grupo(MINIMO_GRUPO + 8, 'capital_principal'), ...grupo(MINIMO_GRUPO - 7, 'intermedia')],
      REGLAS,
    )
    const grande = res.consultorios.find((c) => c.consultorioId.startsWith('capital'))!
    const chico = res.consultorios.find((c) => c.consultorioId.startsWith('intermedia'))!
    assert.ok(grande.percentilGrupoCiudad !== null)
    assert.equal(chico.percentilGrupoCiudad, null)
  })
})
