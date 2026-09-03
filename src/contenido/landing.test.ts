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
    fuera.add(C.INDICE.introCalibrado)
    C.INDICE.reglas.forEach((r) => fuera.add(r.textoCalibrado))
  } else {
    fuera.add(C.INDICE.introEnCalibracion)
    C.INDICE.reglas.forEach((r) => {
      if ('textoEnCalibracion' in r)
        fuera.add((r as { textoEnCalibracion: string }).textoEnCalibracion)
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
    'los mejores',
    'el mejor',
    'la mejor',
    'n.º 1',
    'no. 1',
    'número uno',
    'líderes',
    'el líder',
    'los más',
    'único en',
    'insuperable',
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
    'botox',
    'toxina botulínica',
    'ácido hialurónico',
    'bótox',
    'dysport',
    'juvederm',
    'invisalign',
    'lidocaína',
    'minoxidil',
    'finasterida',
    'ozempic',
    'semaglutida',
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
    assert.ok(/en calibración/i.test(C.INDICE.insignia))
    assert.ok(!RENDERIZADAS.includes(C.INDICE.introCalibrado))
    assert.ok(/en calibración/i.test(C.INDICE.introEnCalibracion))
  })

  it('no se afirma un margen de error que todavía no existe', () => {
    if (C.CONFIG.indiceCalibrado) return
    const afirma = RENDERIZADAS.filter((s) =>
      /margen de error al lado de la cifra|sin cifra sin su error/i.test(s),
    )
    assert.deepEqual(afirma, [], 'la tasa de error está pendiente: no se puede anunciar')
  })

  it('los pesos suman 100 y están visibles', () => {
    const suma = C.DIMENSIONES.items.reduce((t, d) => t + d.peso, 0)
    assert.equal(suma, 100)
  })

  it('hay una palanca por dimensión y ninguna de más', () => {
    // «Si algo no mueve el índice, no lo hacemos.»
    assert.equal(C.PALANCAS.items.length, C.DIMENSIONES.items.length)
    const dimensiones = C.DIMENSIONES.items.map((d) => d.nombre)
    assert.deepEqual(
      C.PALANCAS.items.map((p) => p.dimension),
      dimensiones,
    )
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
    assert.equal(C.MARCA.nombre, 'Kleia')
    assert.ok(C.META.title.startsWith('Kleia'))
  })

  it('el nombre sale de un solo sitio', () => {
    // Ya cambió una vez, de Kleo a Kleia. Que vuelva a cambiar tiene que seguir
    // siendo una línea, así que nada de lo que se renderiza puede escribirlo.
    assert.ok(C.META.title.startsWith(C.MARCA.nombre), 'el title no deriva de MARCA.nombre')
    for (const ruta of ['../app/page.tsx', '../app/layout.tsx']) {
      const archivo = readFileSync(new URL(ruta, import.meta.url), 'utf8')
      const codigo = archivo.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
      assert.ok(
        !codigo.includes(C.MARCA.nombre),
        `${ruta} escribe «${C.MARCA.nombre}» a mano en vez de leer MARCA.nombre`,
      )
    }
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
    assert.deepEqual(
      HEROE.filter((v) => TEXTO.includes(v)),
      [],
    )
  })

  it('no hay registro de Cuidador', () => {
    const CUIDADOR = [
      'te cuidamos',
      'nos encargamos de todo',
      'tu tranquilidad',
      'déjalo en nuestras manos',
    ]
    assert.deepEqual(
      CUIDADOR.filter((v) => TEXTO.includes(v)),
      [],
    )
  })

  it('una sola acción primaria, repetida', () => {
    assert.equal(C.CIERRE.cta, C.PORTADA.cta)
    assert.ok(!TEXTO.includes('agenda una demo'))
    assert.ok(!TEXTO.includes('solicita una demostración'))
  })
})

describe('11 · Tres niveles de profundidad', () => {
  /** Las secciones en el orden de la página, con su nombre para los mensajes. */
  const NOMBRES = [
    'HECHOS',
    'PROBLEMA',
    'DIMENSIONES',
    'INDICE',
    'PALANCAS',
    'PASOS',
    'NO_SOMOS',
    'PRECIO',
    'PREGUNTAS',
    'CIERRE',
  ] as const
  const SECCIONES = C.SECCIONES.map((s, i) => ({ nombre: NOMBRES[i], ...s }))

  it('cada sección tiene los tres niveles, sin excepciones', () => {
    assert.equal(SECCIONES.length, NOMBRES.length)
    for (const s of SECCIONES) {
      for (const nivel of ['tag', 'h2', 'h3'] as const) {
        assert.ok(s[nivel]?.trim().length, `${s.nombre} no tiene ${nivel}`)
      }
    }
  })

  it('cada tag es una pregunta, porque es la pregunta que la sección responde', () => {
    for (const s of SECCIONES) {
      assert.ok(
        s.tag.startsWith('¿') && s.tag.endsWith('?'),
        `el tag de ${s.nombre} no es una pregunta: «${s.tag}»`,
      )
    }
  })

  it('los tags mantienen una sola voz: la nuestra, o ninguna', () => {
    // Es nuestra página. Aquí decimos «qué hacemos», no «qué hacen», y tampoco
    // le prestamos la voz al lector con un «¿por dónde empiezo?»: diez tags en
    // tres voces distintas leídos en fila suenan a tres páginas pegadas.
    const AJENA = /\b(ustedes|hacen|miden|cobran|ofrecen|prometen|trabajan|empiezan|son)\b/i
    for (const s of SECCIONES) {
      assert.ok(!AJENA.test(s.tag), `el tag de ${s.nombre} habla de nosotros en tercera persona`)
    }
  })

  it('los h2 leídos en orden son frases completas', () => {
    // Es la condición de que el skimming funcione: quien solo lee los h2 lee
    // prosa, no fragmentos que dependan del texto que hay debajo.
    for (const s of SECCIONES) {
      assert.ok(/[.?]$/.test(s.h2), `el h2 de ${s.nombre} no cierra la frase: «${s.h2}»`)
    }
  })

  it('ningún h2 depende del h2 anterior para entenderse', () => {
    // Un h2 que empieza con conector se rompe si la sección de arriba no se lee,
    // y en el skimming se lee salteado.
    const CONECTORES = /^(y|pero|entonces|además|por eso|así que|también|sin embargo)\b/i
    for (const s of SECCIONES) {
      assert.ok(!CONECTORES.test(s.h2), `el h2 de ${s.nombre} arranca con un conector`)
    }
  })

  it('cada h3 agrega detalle en vez de repetir el h2', () => {
    for (const s of SECCIONES) {
      assert.ok(s.h3.length > s.h2.length, `el h3 de ${s.nombre} no agrega detalle sobre su h2`)
      assert.ok(!s.h3.includes(s.h2), `el h3 de ${s.nombre} repite su h2 en vez de profundizarlo`)
    }
  })

  it('ni los tags ni los h2 se repiten entre secciones', () => {
    for (const nivel of ['tag', 'h2'] as const) {
      const vistos = SECCIONES.map((s) => s[nivel])
      assert.equal(new Set(vistos).size, vistos.length, `hay ${nivel} repetidos`)
    }
  })

  it('la historia completa se lee en un vistazo', () => {
    // Si la cadena de h2 no se puede leer de corrido en unos segundos, deja de
    // ser un resumen y vuelve a ser texto.
    const cadena = SECCIONES.map((s) => s.h2).join(' ')
    assert.ok(cadena.length < 700, `la cadena de h2 mide ${cadena.length} caracteres`)
  })

  it('la página renderiza los tres niveles de cada sección', () => {
    const pagina = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')
    for (const nombre of NOMBRES) {
      assert.ok(
        new RegExp(`tag=\\{${nombre}\\.tag\\}`).test(pagina),
        `${nombre} no pasa su tag al encabezado`,
      )
      for (const nivel of ['h2', 'h3']) {
        assert.ok(
          new RegExp(`${nivel}=\\{${nombre}\\.${nivel}\\}`).test(pagina),
          `${nombre} no pasa su ${nivel} al encabezado`,
        )
      }
    }
  })

  it('cada nivel tiene su propio estilo, y los tres se agrupan', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
    // Los dos primeros son los niveles nuevos. Los dos últimos son lo que los
    // agrupa: sin ellos los tres niveles quedan a la misma distancia entre sí
    // que del cuerpo, y dejan de leerse como un encabezado.
    for (const selector of [
      '.tag {',
      '.seccion h3 {',
      '.encabezado > .tag {',
      '.encabezado h3 {',
    ]) {
      assert.ok(css.includes(selector), `falta el estilo ${selector}`)
    }
  })
})
