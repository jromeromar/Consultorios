/**
 * Las diez verificaciones de la sección 4 del copy, mecanizadas.
 *
 * Se corren sobre las cadenas del módulo de contenido, que es donde vivirían las
 * infracciones. Cada una cita la regla que hace cumplir y de dónde sale.
 *
 *   npm test
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import * as C from './landing'

/** Todas las cadenas del contenido, aplanadas. */
function cadenas(valor: unknown, salida: string[] = []): string[] {
  if (typeof valor === 'string') salida.push(valor)
  else if (Array.isArray(valor)) valor.forEach((v) => cadenas(v, salida))
  else if (valor && typeof valor === 'object') {
    Object.values(valor as Record<string, unknown>).forEach((v) => cadenas(v, salida))
  }
  return salida
}

const TODAS = cadenas(C)

/** Lo que la página realmente renderiza, según los interruptores de CONFIG. */
function renderizadas(): string[] {
  const fuera = new Set<string>()
  if (!C.CONFIG.mostrarPrecio) cadenas(C.PRECIO).forEach((s) => fuera.add(s))
  if (!C.CONFIG.indiceCalibrado) {
    fuera.add(C.INSTRUMENTO.introCalibrado)
    C.INSTRUMENTO.reglas.forEach((r) => fuera.add(r.textoCalibrado))
  } else {
    fuera.add(C.INSTRUMENTO.introEnCalibracion)
    C.INSTRUMENTO.reglas.forEach((r) => {
      if ('textoEnCalibracion' in r) fuera.add((r as { textoEnCalibracion: string }).textoEnCalibracion)
    })
  }
  if (!C.CONFIG.umbralPausaDefinido) {
    fuera.add(C.PRECIO.pausaDefinida)
    const ultima = C.PREGUNTAS.items[C.PREGUNTAS.items.length - 1]
    if ('respuestaDefinida' in ultima) fuera.add(ultima.respuestaDefinida)
  }
  if (!C.CONFIG.indiceDisponible) cadenas(C.FORMULARIO.disponible).forEach((s) => fuera.add(s))
  // Las alternativas de titular no se renderizan: existen para probar.
  C.PORTADA.h1Alternativas.forEach((s) => fuera.add(s))
  return TODAS.filter((s) => !fuera.has(s))
}

const RENDERIZADAS = renderizadas()
const TEXTO = RENDERIZADAS.join('\n').toLowerCase()

describe('1 · Vocabulario prohibido', () => {
  // «captar», «conseguir», «traer» son vocabulario de expediente disciplinario.
  // «llenar agendas» y «más pacientes» chocan con la decisión 20 y la Ley 1480.
  const PROHIBIDAS = ['captar', 'conseguir', 'traer', 'llenar', 'más pacientes']

  for (const palabra of PROHIBIDAS) {
    it(`no aparece «${palabra}» en ninguna parte de la página`, () => {
      const encontradas = RENDERIZADAS.filter((s) => s.toLowerCase().includes(palabra))
      assert.deepEqual(encontradas, [], `«${palabra}» en: ${encontradas[0]?.slice(0, 70)}`)
    })
  }

  it('tampoco aparece en el copy que no se renderiza', () => {
    // Un interruptor puede encenderse mañana: la infracción no puede estar
    // esperando dentro del módulo.
    for (const palabra of PROHIBIDAS) {
      const encontradas = TODAS.filter((s) => s.toLowerCase().includes(palabra))
      assert.deepEqual(encontradas, [], `«${palabra}» latente en: ${encontradas[0]?.slice(0, 70)}`)
    }
  })
})

describe('2 · Sin superlativos comparativos con colegas', () => {
  const SUPERLATIVOS = [
    'los mejores', 'el mejor', 'la mejor', 'n.º 1', 'no. 1', 'número uno',
    'líderes', 'el líder', 'los más', 'único en', 'insuperable',
  ]
  it('ninguno aparece', () => {
    // C-355/94: la publicidad de servicios de salud no puede afirmar
    // superioridad comparativa sobre colegas.
    const hallados = SUPERLATIVOS.filter((s) => TEXTO.includes(s))
    assert.deepEqual(hallados, [])
  })
})

describe('3 · Sin nombres de fármacos ni principios activos', () => {
  // Decreto 334/2022: ni siquiera de ejemplo.
  const FARMACOS = [
    'botox', 'toxina botulínica', 'ácido hialurónico', 'bótox', 'dysport', 'juvederm',
    'invisalign', 'lidocaína', 'minoxidil', 'finasterida', 'ozempic', 'semaglutida',
  ]
  it('ninguno aparece', () => {
    const hallados = FARMACOS.filter((f) => TEXTO.includes(f))
    assert.deepEqual(hallados, [])
  })
})

describe('4 · Sin imágenes de pacientes ni de tratamientos', () => {
  it('la página no usa ninguna etiqueta de imagen', () => {
    const pagina = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')
    assert.ok(!/<img\b|<Image\b/.test(pagina), 'la landing no debe traer imágenes')
  })

  it('el contenido no referencia archivos de imagen', () => {
    const conImagen = TODAS.filter((s) => /\.(png|jpe?g|webp|avif)\b/i.test(s))
    assert.deepEqual(conImagen, [])
  })
})

describe('5 · Cada cifra con su fuente al lado', () => {
  it('los hechos de la barra declaran su fuente', () => {
    assert.ok(C.HECHOS.fuente.includes('2026'))
    assert.ok(/entrevistas/i.test(C.HECHOS.fuente))
  })

  it('no hay cifras del censo insinuadas mientras no esté calibrado', () => {
    // El copy es explícito: [DATO DEL CENSO PENDIENTE] no se publica ni se
    // insinúa hasta que el censo esté calibrado.
    assert.ok(!TEXTO.includes('censo'))
    assert.ok(!TEXTO.includes('pendiente]'))
  })

  it('ningún marcador sin resolver queda en el contenido', () => {
    const marcadores = TODAS.filter((s) => /\[[A-ZÁÉÍÓÚÑ ]{4,}\]|\[Ajustar/.test(s))
    assert.deepEqual(marcadores, [])
  })
})

describe('6 · El índice no sale sin calibración, o sale marcado', () => {
  it('si no está calibrado, la sección se marca y no anuncia margen de error', () => {
    if (C.CONFIG.indiceCalibrado) return
    assert.ok(/en calibración/i.test(C.INSTRUMENTO.insignia))
    assert.ok(!RENDERIZADAS.includes(C.INSTRUMENTO.introCalibrado))
    assert.ok(/en calibración/i.test(C.INSTRUMENTO.introEnCalibracion))
  })

  it('no se afirma un margen de error que todavía no existe', () => {
    if (C.CONFIG.indiceCalibrado) return
    const afirma = RENDERIZADAS.filter((s) =>
      /margen de error al lado de la cifra|sin cifra sin su error/i.test(s),
    )
    assert.deepEqual(afirma, [], 'la tasa de error está pendiente: no se puede anunciar')
  })

  it('los pesos suman 100 y están visibles', () => {
    const suma = C.INSTRUMENTO.dimensiones.reduce((t, d) => t + d.peso, 0)
    assert.equal(suma, 100)
  })

  it('hay una palanca por dimensión y ninguna de más', () => {
    // «Si algo no mueve el índice, no lo hacemos.»
    assert.equal(C.PALANCAS.items.length, C.INSTRUMENTO.dimensiones.length)
    const dimensiones = C.INSTRUMENTO.dimensiones.map((d) => d.nombre)
    assert.deepEqual(C.PALANCAS.items.map((p) => p.dimension), dimensiones)
  })
})

describe('7 · La cláusula de pausa no dice «está en el contrato» sin número', () => {
  it('mientras el umbral no esté definido, no se afirma el contrato', () => {
    if (C.CONFIG.umbralPausaDefinido) return
    const afirma = RENDERIZADAS.filter((s) => /está en el contrato/i.test(s))
    assert.deepEqual(afirma, [], 'el umbral no tiene número todavía')
  })

  it('la versión sin definir dice que se acuerda por escrito', () => {
    assert.ok(/por escrito antes de empezar/i.test(C.PRECIO.pausaSinDefinir))
  })
})

describe('8 · Ningún marcador de marca sin resolver', () => {
  it('no queda «MARCA POR DEFINIR» en ningún lugar', () => {
    assert.ok(!TODAS.join(' ').includes('MARCA POR DEFINIR'))
  })

  it('la marca tiene nombre', () => {
    assert.equal(C.MARCA.nombre, 'Kleo')
    assert.ok(C.META.title.startsWith('Kleo'))
  })

  it('el title y la meta caben en sus límites', () => {
    assert.ok(C.META.title.length <= 60, `title: ${C.META.title.length} caracteres`)
    assert.ok(C.META.description.length <= 155, `meta: ${C.META.description.length} caracteres`)
  })
})

describe('9 · Nada de identidad de Ropofy', () => {
  it('la marca no se menciona en el contenido', () => {
    assert.ok(!TEXTO.includes('ropofy'))
  })

  it('ni en la página ni en los tokens', () => {
    for (const ruta of ['../app/page.tsx', '../app/globals.css', '../app/layout.tsx']) {
      const fuente = readFileSync(new URL(ruta, import.meta.url), 'utf8')
      assert.ok(!/ropofy/i.test(fuente), ruta)
    }
  })
})

describe('10 · Segunda revisión firmada', () => {
  it('mientras nadie firme, la página se anuncia como borrador', () => {
    const pagina = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')
    if (C.REVISION === null) {
      assert.ok(/REVISION/.test(pagina), 'la página debe mirar REVISION y mostrar el borrador')
    } else {
      assert.ok(C.REVISION.nombre && C.REVISION.fecha, 'la firma necesita nombre y fecha')
    }
  })
})

describe('Registro y tono', () => {
  it('el registro es tuteo y no se mezcla con usted', () => {
    // Decisión reversible del copy. Mezclarlos sí es un error.
    const conUsted = RENDERIZADAS.filter((s) => /\busted\b|\bsu consultorio\b/i.test(s))
    assert.deepEqual(conUsted, [], 'la página está en tuteo: no puede mezclar')
  })

  it('no hay verbos del Héroe', () => {
    const HEROE = ['conquista', 'domina', 'triunfa', 'gana el mercado', 'lidera el mercado']
    assert.deepEqual(HEROE.filter((v) => TEXTO.includes(v)), [])
  })

  it('no hay registro de Cuidador', () => {
    const CUIDADOR = ['te cuidamos', 'nos encargamos de todo', 'tu tranquilidad', 'déjalo en nuestras manos']
    assert.deepEqual(CUIDADOR.filter((v) => TEXTO.includes(v)), [])
  })

  it('una sola acción primaria, repetida', () => {
    assert.equal(C.CIERRE.cta, C.PORTADA.cta)
    assert.ok(!TEXTO.includes('agenda una demo'))
    assert.ok(!TEXTO.includes('solicita una demostración'))
  })
})
