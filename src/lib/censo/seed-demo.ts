import { sql } from 'drizzle-orm'

import type { Db } from '../db/connect'
import {
  consultorio,
  consultorioSnapshot,
  contactoCampo,
  edicionEstudio,
  guion,
  instagramSnapshot,
  municipio,
  serpLocal,
  sitioSnapshot,
} from '../db/schema-censo'
import { VERSION_FORMULA_PROPUESTA } from './indicadores'

/**
 * Censo de DEMOSTRACIÓN.
 *
 * ⚠️  Consultorios inventados. Sirve para operar el circuito completo —censo →
 * puntaje → percentiles → auditoría— antes del primer levantamiento real. Cada
 * consultorio se marca con `fuente_listado = 'manual'` y `estrato_muestra`
 * empieza por «demo», así que se distingue de un dato real con una consulta.
 *
 * Los huecos son deliberados: hay consultorios sin sitio rastreable, sin cuenta
 * de Instagram y sin contacto de campo, para que `bloques_no_medidos` se ejercite
 * y la interfaz tenga que mostrar «no medido» de verdad.
 */

export const ESTRATO_DEMO = 'demo-sintetico'
export const EDICION_DEMO = 'Censo de ortodoncia · edición de demostración'

const MUNICIPIOS = [
  { id: '11001', nombre: 'Bogotá D.C.', dep: 'Bogotá D.C.', depId: '11', cat: 'capital_principal', area: null },
  { id: '05001', nombre: 'Medellín', dep: 'Antioquia', depId: '05', cat: 'capital_principal', area: 'Valle de Aburrá' },
  { id: '76001', nombre: 'Cali', dep: 'Valle del Cauca', depId: '76', cat: 'capital_principal', area: null },
  { id: '08001', nombre: 'Barranquilla', dep: 'Atlántico', depId: '08', cat: 'capital_principal', area: 'Área Metropolitana de Barranquilla' },
  { id: '68001', nombre: 'Bucaramanga', dep: 'Santander', depId: '68', cat: 'capital_departamental', area: 'Área Metropolitana de Bucaramanga' },
  { id: '66001', nombre: 'Pereira', dep: 'Risaralda', depId: '66', cat: 'capital_departamental', area: 'Área Metropolitana Centro Occidente' },
  { id: '05360', nombre: 'Itagüí', dep: 'Antioquia', depId: '05', cat: 'intermedia', area: 'Valle de Aburrá' },
  { id: '73001', nombre: 'Ibagué', dep: 'Tolima', depId: '73', cat: 'capital_departamental', area: null },
] as const

/** Generador determinista: el censo de demostración es el mismo en cada arranque. */
function rng(semilla: number) {
  let s = semilla
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

const CONSULTAS = [
  'ortodoncista',
  'brackets precio',
  'ortodoncia invisible',
  'ortodoncista cerca de mi',
  'clinica de ortodoncia',
] as const

const CATEGORIAS_GOOGLE = [
  'Ortodoncista',
  'Ortodoncista',
  'Ortodoncista',
  'Dentista',
  'Clínica dental',
  'Odontólogo',
]

export async function seedCensoDemo(db: Db, total = 180): Promise<{
  edicionId: string
  consultorios: number
}> {
  await db
    .insert(municipio)
    .values(
      MUNICIPIOS.map((m) => ({
        municipioId: m.id,
        nombreMunicipio: m.nombre,
        departamento: m.dep,
        departamentoId: m.depId,
        categoriaCiudad: m.cat,
        areaMetropolitana: m.area,
        esCabeceraDeArea: m.area !== null && (m.id === '05001' || m.id === '08001' || m.id === '68001' || m.id === '66001'),
      })),
    )
    .onConflictDoNothing()

  const [edicion] = await db
    .insert(edicionEstudio)
    .values({
      nombre: EDICION_DEMO,
      campoInicio: '2026-08-01',
      campoFin: '2026-08-31',
      corteRelojHoras: 48,
      municipiosIncluidos: MUNICIPIOS.map((m) => m.id).join(';'),
      versionFormula: VERSION_FORMULA_PROPUESTA,
      publicadaEn: '2026-09-15',
      notasMetodo:
        'Edición de demostración con consultorios sintéticos. No es un levantamiento de campo.',
    })
    .returning({ edicionId: edicionEstudio.edicionId })

  const [guionDemo] = await db
    .insert(guion)
    .values({
      version: 'demo-1',
      canal: 'whatsapp',
      texto:
        'Hola, buenos días. Quisiera saber cuánto cuesta el tratamiento de brackets y si tienen cita esta semana.',
      vigenteDesde: '2026-08-01',
    })
    .returning({ guionId: guion.guionId })

  const azar = rng(20260901)
  const consultorios: string[] = []
  /** Para armar el paquete local como lo que es: un ranking por municipio. */
  const porMunicipio = new Map<string, { consultorioId: string; madurez: number; nombre: string }[]>()

  for (let i = 0; i < total; i += 1) {
    const muni = MUNICIPIOS[i % MUNICIPIOS.length]
    // Madurez sintética del consultorio: mueve todos sus indicadores a la vez,
    // que es lo que pasa en la realidad.
    const madurez = azar()

    const [fila] = await db
      .insert(consultorio)
      .values({
        cid: `demo-${1_000_000_000_000_000 + i}`,
        placeId: `ChIJdemo${String(i).padStart(4, '0')}`,
        esOrtodoncia: true,
        tipoEstablecimiento:
          madurez > 0.85 ? 'clinica_multisilla' : madurez > 0.5 ? 'consultorio_individual' : 'consultorio_individual',
        estadoRegistro: 'activo',
        fuenteListado: 'manual',
        enMuestraEstudio: true,
        estratoMuestra: `${ESTRATO_DEMO}-${muni.cat}`,
        fechaAlta: '2026-08-01',
        fechaUltimaCaptura: '2026-08-20',
      })
      .returning({ consultorioId: consultorio.consultorioId })

    consultorios.push(fila.consultorioId)
    const ranking = porMunicipio.get(muni.id) ?? []
    ranking.push({ consultorioId: fila.consultorioId, madurez, nombre: `Ortodoncia Demo ${i + 1}` })
    porMunicipio.set(muni.id, ranking)

    const tieneCuenta = madurez > 0.3
    const tieneSitio = madurez > 0.4

    await db.insert(consultorioSnapshot).values({
      consultorioId: fila.consultorioId,
      fechaCaptura: '2026-08-20',
      fuenteCaptura: 'maps',
      nombreComercial: `Ortodoncia Demo ${i + 1}`,
      nombreNormalizado: `ortodoncia demo ${i + 1}`,
      categoriaPrincipal:
        madurez > 0.45
          ? 'Ortodoncista'
          : CATEGORIAS_GOOGLE[Math.floor(azar() * CATEGORIAS_GOOGLE.length)],
      municipioId: muni.id,
      esAreaDeServicio: madurez < 0.15,
      calificacion: String(Math.min(5, 3.6 + madurez * 1.3).toFixed(1)),
      resenasTotal: Math.round(3 + madurez * madurez * 320),
      fechaResenaMasReciente: fechaResena(madurez, azar()),
      resenasRespondidasPct: madurez > 0.5 ? String(Math.round(madurez * 90)) : null,
      tieneHorarioPublicado: madurez > 0.25,
      fotosN: Math.round(1 + madurez * 60),
      telefonoE164: `+5730${String(1_000_000 + i).slice(0, 7)}`,
      dominio: tieneSitio ? `demo${i + 1}.co` : null,
      instagramHandle: tieneCuenta ? `ortodonciademo${i + 1}` : null,
    })

    if (tieneSitio) {
      // Un 10 % de los sitios falla el rastreo: sus indicadores quedan nulos,
      // no falsos. Es el caso que la interfaz tiene que mostrar como no medido.
      const rastreoOk = azar() > 0.1
      await db.insert(sitioSnapshot).values({
        consultorioId: fila.consultorioId,
        dominio: `demo${i + 1}.co`,
        fechaRastreo: '2026-08-22',
        estadoRastreo: rastreoOk ? 'ok' : azar() > 0.5 ? 'timeout' : 'error_dns',
        tieneGtm: rastreoOk ? madurez > 0.6 : null,
        tienePixelMeta: rastreoOk ? madurez > 0.7 : null,
        plataformaAgendaDetectada: rastreoOk
          ? madurez > 0.8
            ? 'dentalink'
            : madurez > 0.65
              ? 'agendapro'
              : 'ninguno'
          : null,
        tieneReservaOnline: rastreoOk ? madurez > 0.72 : null,
        tienePagoEnLinea: rastreoOk ? madurez > 0.88 : null,
        pasarelaDetectada: rastreoOk ? (madurez > 0.88 ? 'wompi' : 'ninguna') : null,
        esMovilResponsive: rastreoOk ? madurez > 0.35 : null,
      })
    }

    if (tieneCuenta) {
      await db.insert(instagramSnapshot).values({
        consultorioId: fila.consultorioId,
        handle: `ortodonciademo${i + 1}`,
        fechaCaptura: '2026-08-21',
        seguidores: Math.round(200 + madurez * madurez * 24_000),
        publicacionesTotal: Math.round(20 + madurez * 800),
        publicaciones30d: Math.round(madurez * 18),
        interaccionPromedioPct: String((0.4 + madurez * 4).toFixed(2)),
        ultimaPublicacionFecha: madurez > 0.5 ? '2026-08-18' : '2026-05-02',
        tieneEnlaceEnBio: madurez > 0.3,
        destinoEnlace:
          madurez > 0.82 ? 'reserva' : madurez > 0.5 ? 'whatsapp' : madurez > 0.3 ? 'sitio' : 'ninguno',
        esCuentaProfesional: madurez > 0.4,
        publicaAntesDespues: madurez > 0.55,
      })
    }

    // El 75 % del universo entra a la muestra de campo.
    if (azar() < 0.75) {
      const respondio = madurez > 0.28
      const minutos = respondio ? Math.max(2, Math.round(600 * Math.pow(1 - madurez, 2.2))) : null
      await db.insert(contactoCampo).values({
        consultorioId: fila.consultorioId,
        edicionId: edicion.edicionId,
        guionId: guionDemo.guionId,
        canal: 'whatsapp',
        destinoUsado: `+5730${String(1_000_000 + i).slice(0, 7)}`,
        emisorId: 'demo-emisor-1',
        enviadoEn: new Date('2026-08-12T13:05:00-05:00'),
        diaSemana: 3,
        franjaHoraria: 'mediodia',
        estadoEnvio: 'entregado',
        minutosPrimeraRespuesta: minutos,
        huboRespuesta: respondio,
        tipoPrimerRespondedor: respondio ? (madurez > 0.7 ? 'persona' : 'automatico') : null,
        // Nulo cuando no hubo respuesta: el modelo lo exige.
        ofrecioAgendar: respondio ? (madurez > 0.5 ? 'si' : madurez > 0.35 ? 'no' : 'no_observado') : null,
        dioPrecio: respondio ? (madurez > 0.75 ? 'exacto' : madurez > 0.45 ? 'rango' : 'no') : null,
        precioMinMencionado: respondio && madurez > 0.45 ? Math.round((2_800_000 + madurez * 4_000_000) / 1000) * 1000 : null,
        huboSeguimientoEspontaneo: respondio ? (madurez > 0.8 ? 'si' : 'no') : null,
        codificadoPor: 'seed-demo',
        codificadoEn: '2026-08-31',
        versionCodificacion: 'demo-1',
        excluidoDelAnalisis: false,
      })
    }
  }

  // Paquete local: cinco consultas por municipio. En cada una, los
  // consultorios del municipio se ordenan por madurez con algo de ruido y
  // ocupan las posiciones 1..N. Solo los tres primeros de cada consulta entran
  // al paquete local, que es lo que Google muestra.
  const CONSULTAS_POR_MUNICIPIO = 5
  for (const [municipioId, filas] of porMunicipio) {
    const nombreMuni = MUNICIPIOS.find((m) => m.id === municipioId)!.nombre
    for (let k = 0; k < CONSULTAS_POR_MUNICIPIO; k += 1) {
      const orden = [...filas]
        .map((f) => ({ ...f, criterio: f.madurez + (azar() - 0.5) * 0.35 }))
        .sort((a, b) => b.criterio - a.criterio)
        .slice(0, 3)

      for (let pos = 0; pos < orden.length; pos += 1) {
        await db.insert(serpLocal).values({
          consultaTexto: `${CONSULTAS[k]} en ${nombreMuni}`,
          consultaNormalizada: `${CONSULTAS[k]}-${k}-${municipioId}`,
          municipioId,
          fechaConsulta: '2026-08-19',
          dispositivo: 'movil',
          bloque: 'paquete_local',
          posicion: pos + 1,
          nombreResultadoCrudo: orden[pos].nombre,
          consultorioId: orden[pos].consultorioId,
          metodoEmparejamiento: 'place_id',
          confianzaEmparejamiento: '1',
        })
      }
    }
  }

  await db
    .update(edicionEstudio)
    .set({ nMuestra: sql`(select count(*) from contacto_campo where edicion_id = ${edicion.edicionId})` })
    .where(eq2(edicion.edicionId))

  return { edicionId: edicion.edicionId, consultorios: consultorios.length }
}

/** Helper local para no importar `eq` solo por una línea. */
function eq2(edicionId: string) {
  return sql`${edicionEstudio.edicionId} = ${edicionId}`
}

function fechaResena(madurez: number, ruido: number): string {
  // Los maduros tienen reseñas frescas; los demás, viejas.
  const diasAtras = Math.round((1 - madurez) * 500 + ruido * 40)
  const fecha = new Date('2026-08-31T00:00:00Z')
  fecha.setUTCDate(fecha.getUTCDate() - diasAtras)
  return fecha.toISOString().slice(0, 10)
}
