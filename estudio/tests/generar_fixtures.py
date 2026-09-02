"""
Genera los datos sintéticos de prueba y los deja escritos en CSV.

Se corre UNA VEZ y su salida se versiona. Los CSV son estáticos a propósito:
generarlos en cada prueba haría frágil la comprobación de reproducibilidad byte
a byte y esconderia los valores conocidos que las pruebas de aritmética
necesitan.

    python3 tests/generar_fixtures.py

Dos conjuntos:

  datos/                  la edición completa. Dimensionada para que los mínimos
                          se cumplan donde deben y falle donde tiene que fallar.
  tests/fixtures/minimo/  treinta consultorios. Casi nada pasa el mínimo, así
                          que ejercita el camino de «no medido en esta edición».

Composición de la edición, y por qué cada número:

  universo                200   consultorios activos de ortodoncia en 12 ciudades
  + excluidos              12   duplicado, cerrado, fuera de alcance, no ortodoncia
  medidos                 169   filas de contacto_campo no excluidas
  respondieron            133   dentro del corte de reloj
  con_ficha               200
  con_sitio_rastreado     131   de los que tienen dominio; el resto falló el rastreo
  con_instagram           118
  con_serp_medido         200
  declararon               59

  capital_principal        52   2 ciudades × 26
  intermedia               84   6 ciudades × 14
  capital_departamental    64   4 ciudades × 16
  -> el corte por tipo de ciudad SE PUBLICA, y también sobre `respondieron`,
     que es el denominador más exigente porque pierde a los que no contestaron

Lo que NO se puede publicar con esta cantidad, y el documento tiene que decirlo:

  por municipio           ≤24   prohibido por regla, y tampoco llegaría
  franja × tipo de ciudad ~13   el cruce de segundo nivel no alcanza el mínimo
                                aunque cada dimensión por separado sí lo haga

Dos factores latentes independientes, `presencia` y `reloj`, gobiernan los
indicadores. Que sean independientes es deliberado: es lo que hace que el
contra-hallazgo exista en el fixture y el motor tenga algo que encontrar. Eso
prueba la maquinaria, no describe el mercado.
"""

from __future__ import annotations

import csv
import math
import os
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# ── municipios ─────────────────────────────────────────────────────────────
# (dane, nombre, departamento, dep_id, categoria, n_consultorios, area_metro)
MUNICIPIOS = [
    ("08001", "Barranquilla", "Atlántico", "08", "capital_principal", 26, "Área Metropolitana de Barranquilla"),
    ("68001", "Bucaramanga", "Santander", "68", "capital_principal", 26, "Área Metropolitana de Bucaramanga"),
    ("63001", "Armenia", "Quindío", "63", "intermedia", 14, ""),
    ("73001", "Ibagué", "Tolima", "73", "intermedia", 14, ""),
    ("41001", "Neiva", "Huila", "41", "intermedia", 14, ""),
    ("19001", "Popayán", "Cauca", "19", "intermedia", 14, ""),
    ("47001", "Santa Marta", "Magdalena", "47", "intermedia", 14, ""),
    ("50001", "Villavicencio", "Meta", "50", "intermedia", 14, ""),
    ("66001", "Pereira", "Risaralda", "66", "capital_departamental", 16, "Área Metropolitana Centro Occidente"),
    ("17001", "Manizales", "Caldas", "17", "capital_departamental", 16, ""),
    ("52001", "Pasto", "Nariño", "52", "capital_departamental", 16, ""),
    ("54001", "Cúcuta", "Norte de Santander", "54", "capital_departamental", 16, "Área Metropolitana de Cúcuta"),
]

POBLACION = {
    "08001": 1_336_000, "68001": 613_000, "63001": 306_000, "73001": 542_000,
    "41001": 357_000, "19001": 320_000, "47001": 515_000, "50001": 553_000,
    "66001": 482_000, "17001": 434_000, "52001": 392_000, "54001": 777_000,
}

CONSULTAS = [
    ("ortodoncista", "servicio"),
    ("brackets precio", "precio"),
    ("ortodoncia invisible", "servicio"),
    ("ortodoncista cerca de mi", "servicio"),
    ("clinica de ortodoncia", "servicio"),
]

# Factor sobre el tiempo de respuesta por tipo de ciudad. Es lo que hace que el
# hallazgo 02 tenga dirección y la comprobación `grupo_mayor` pase. Se aplica al
# reloj y NO a `presencia`, de modo que el contra-hallazgo del 07 sobrevive.
FACTOR_CIUDAD = {"capital_principal": 0.72, "capital_departamental": 1.20, "intermedia": 1.45}

FRANJAS = ["manana", "mediodia", "tarde"]
# Proporción de respuesta dentro de la primera hora por franja. El mediodía cae
# a la mitad: es el hallazgo 02 y el fixture tiene que contenerlo.
PROP_PRIMERA_HORA = {"manana": 0.42, "mediodia": 0.19, "tarde": 0.30}

# Nombres inventados con forma de nombre real. Existen para que la prueba de
# anonimato tenga algo que buscar en el JSON agregado: con el campo vacío esa
# prueba pasaría de vacío y no demostraría nada.
NOMBRES = [
    "Clínica Arboleda", "Ortodoncia Sanmiguel", "Centro Valderrama",
    "Consultorio Echeverri", "Clínica Betancur", "Ortodoncia Zapata",
    "Centro Ocampo", "Clínica Restrepo", "Consultorio Villegas",
    "Ortodoncia Cadavid", "Centro Mejía", "Clínica Uribe",
]

CATEGORIAS_FICHA = ["Dentista", "Clínica dental", "Odontólogo"]


def nombre_de(indice: int) -> str:
    return f"{NOMBRES[indice % len(NOMBRES)]} {indice:03d}"


EXCLUIDOS = (
    [("duplicado", True)] * 4 + [("cerrado", True)] * 3
    + [("fuera_de_alcance", True)] * 3 + [("activo", False)] * 2
)


def azar(semilla: int):
    """Congruencial lineal: mismo resultado en cualquier máquina y versión."""
    estado = semilla

    def siguiente() -> float:
        nonlocal estado
        estado = (estado * 1103515245 + 12345) % 2147483648
        return estado / 2147483648

    return siguiente


def escribir(ruta: Path, columnas: list[str], filas: list[dict]) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with open(ruta, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columnas, lineterminator="\n")
        w.writeheader()
        for fila in filas:
            w.writerow({c: fila.get(c, "") for c in columnas})
    print(f"  {str(ruta.relative_to(RAIZ)):46} {len(filas):>4} filas")


def interp(v: float, a: float, b: float) -> float:
    return a + v * (b - a)


def generar(destino: Path, municipios, semilla: int, etiqueta: str) -> None:
    print(f"\n── {etiqueta} ──")
    r = azar(semilla)

    consultorios, fichas, sitios, cuentas, contactos = [], [], [], [], []
    resenas, declarados, serps = [], [], []
    por_municipio: dict[str, list[tuple[str, float, str]]] = {}

    indice = 0
    for dane, nombre, _dep, _depid, _cat, cuantos, _area in municipios:
        for _ in range(cuantos):
            indice += 1
            cid = f"C-{indice:04d}"

            # Los tres primeros son controles con valores exactos en las anclas,
            # para que las pruebas de aritmética tengan un resultado que afirmar.
            control = cid if indice <= 3 else None
            if control == "C-0001":
                presencia = reloj = 1.0
            elif control == "C-0002":
                presencia = reloj = 0.0
            else:
                presencia = r()
                reloj = r()          # independiente de presencia, a propósito

            consultorios.append({
                "consultorio_id": cid,
                "cid": f"1{indice:019d}",
                "place_id": f"ChIJfix{indice:05d}",
                "es_ortodoncia": "true",
                "tipo_establecimiento": "clinica_multisilla" if presencia > 0.85 else "consultorio_individual",
                "estado_registro": "activo",
                "fuente_listado": "google_maps",
                "en_muestra_estudio": "true",
                "estrato_muestra": f"sintetico-{_cat}",
                "fecha_alta": "2026-09-01",
                "fecha_ultima_captura": "2026-09-12",
            })
            nombre = nombre_de(indice)
            por_municipio.setdefault(dane, []).append((cid, presencia, nombre))

            # ── ficha pública: todos la tienen ─────────────────────────────
            cat_ok = presencia > 0.42 or control == "C-0001"
            # Los controles se fijan contra campo_fin, que es lo que el motor usa
            # para la recencia: si se fijaran contra fecha_captura caerían a un
            # día de la ancla y el control dejaría de ser exacto.
            dias_resena = 16 if control == "C-0001" else (366 if control == "C-0002" else round(interp((1 - presencia) ** 1.4, 12, 420)))
            fichas.append({
                "consultorio_id": cid,
                "fecha_captura": "2026-09-12",
                "fuente_captura": "maps",
                "nombre_comercial": nombre,
                "nombre_normalizado": nombre.lower(),
                "categoria_principal": "Ortodoncista" if cat_ok else ("Dentista" if r() > 0.4 else "Clínica dental"),
                "municipio_id": dane,
                "es_area_de_servicio": "false" if (presencia > 0.12 or control == "C-0001") else "true",
                "calificacion": f"{min(5.0, interp(presencia, 3.6, 4.95)):.1f}" if not control else ("4.9" if control == "C-0001" else "3.8"),
                "resenas_total": 200 if control == "C-0001" else (0 if control == "C-0002" else round(interp(presencia ** 2, 2, 380))),
                "fecha_resena_mas_reciente": _fecha_menos("2026-09-12", dias_resena),
                "resenas_respondidas_pct": 60 if control == "C-0001" else (0 if control == "C-0002" else round(interp(max(0.0, presencia - 0.35) ** 1.5, 0, 78))),
                "tiene_horario_publicado": "true" if (presencia > 0.2 or control == "C-0001") else "false",
                "fotos_n": round(interp(presencia, 1, 70)),
                "telefono_e164": f"+5730{5_000_000 + indice}",
                "dominio": f"fix{indice}.co" if presencia > 0.30 or control else "",
                "instagram_handle": f"fix{indice}" if presencia > 0.42 or control else "",
            })

            # ── sitio: solo quien tiene dominio; 1 de cada 8 falla el rastreo ─
            if presencia > 0.30 or control:
                ok = control is not None or r() > 0.125
                sitios.append({
                    "consultorio_id": cid,
                    "dominio": f"fix{indice}.co",
                    "fecha_rastreo": "2026-09-13",
                    "estado_rastreo": "ok" if ok else ("timeout" if r() > 0.5 else "error_dns"),
                    "tiene_reserva_online": ("true" if presencia > 0.70 else "false") if ok else "",
                    "tiene_pago_en_linea": ("true" if presencia > 0.87 else "false") if ok else "",
                    "es_movil_responsive": ("true" if presencia > 0.33 else "false") if ok else "",
                    "plataforma_agenda_detectada": ("dentalink" if presencia > 0.88 else "agendapro" if presencia > 0.75 else "ninguno") if ok else "",
                })

            # ── cuenta pública ───────────────────────────────────────────────
            if presencia > 0.42 or control:
                cuentas.append({
                    "consultorio_id": cid,
                    "handle": f"fix{indice}",
                    "fecha_captura": "2026-09-12",
                    "seguidores": 20000 if control == "C-0001" else (100 if control == "C-0002" else round(interp(presencia ** 2, 120, 26000))),
                    "publicaciones_30d": 12 if control == "C-0001" else round(interp(presencia, 0, 16)),
                    "interaccion_promedio_pct": "4.0" if control == "C-0001" else ("0.5" if control == "C-0002" else f"{interp(presencia, 0.3, 4.6):.2f}"),
                    "es_cuenta_profesional": "true" if presencia > 0.5 or control == "C-0001" else "false",
                    "destino_enlace": _destino(presencia, control),
                    "publica_antes_despues": "true" if presencia > 0.6 else "false",
                })

            # ── reseñas detalladas: subconjunto ─────────────────────────────
            if r() < 0.43:
                for k in range(3):
                    resenas.append({
                        "consultorio_id": cid,
                        "fecha_publicacion": _fecha_menos("2026-09-12", 20 + k * 45),
                        "calificacion": 5 if presencia > 0.5 else 4,
                        "tiene_respuesta_del_negocio": "true" if presencia > 0.6 else "false",
                        "dias_hasta_respuesta": 2 if presencia > 0.6 else "",
                        "fecha_captura": "2026-09-12",
                    })

            # ── datos declarados: subconjunto ───────────────────────────────
            if r() < 0.30 or control:
                precio = round(interp(presencia, 2_600_000, 6_400_000) / 100_000) * 100_000
                for campo, num, txt, bol in (
                    ("precio_lista", precio, "", ""),
                    ("cobra_primera_cita", "", "", "true" if presencia > 0.5 else "false"),
                    ("consultas_mes", round(interp(presencia, 18, 190)), "", ""),
                ):
                    declarados.append({
                        "consultorio_id": cid, "fecha": "2026-09-10", "evento": "stand_congreso",
                        "campo": campo, "valor_numero": num, "valor_texto": txt,
                        "valor_booleano": bol, "rol_de_quien_declara": "profesional",
                        "confianza": "alta",
                    })

    # ── contacto de campo ──────────────────────────────────────────────────
    # La muestra se reparte POR MUNICIPIO, no cortando la lista por el principio:
    # tomar los primeros N dejaría municipios enteros sin medir, y con ellos una
    # categoría de ciudad completa, lo que haría que el corte por tipo de ciudad
    # fallara para las estadísticas de campo aunque pasara para las de ficha.
    # Se contacta ~87 % de cada municipio, de modo que cada categoría llegue al
    # mínimo por sí sola.
    elegidos: list[str] = []
    cat_de_cid: dict[str, str] = {}
    for dane, _n, _d, _di, categoria, *_ in municipios:
        lista = [cid for cid, _p, _n in por_municipio.get(dane, [])]
        for cid in lista:
            cat_de_cid[cid] = categoria
        cuantos = max(1, round(len(lista) * 0.875))
        elegidos.extend(lista[:cuantos])

    # Los cinco excluidos del análisis se reparten, uno por municipio. Tomarlos
    # del final los dejaba todos en la misma ciudad y hundía su categoría por
    # debajo del mínimo.
    a_excluir = {elegidos[i] for i in range(0, len(elegidos), max(1, len(elegidos) // 5))[:5]} \
        if False else {lista_i for lista_i in [elegidos[k] for k in range(2, len(elegidos), max(1, len(elegidos)//5))][:5]}

    r2 = azar(semilla + 7)
    for i, cid in enumerate(elegidos):
        franja = FRANJAS[i % 3]
        control = cid if cid in ("C-0001", "C-0002") else None
        reloj = 1.0 if control == "C-0001" else (0.0 if control == "C-0002" else r2())

        respondio = control == "C-0001" or (control is None and reloj > 0.235)
        rapido = r2() < PROP_PRIMERA_HORA[franja]
        if not respondio:
            minutos = ""
        elif control == "C-0001":
            minutos = 5
        else:
            base = (12 if rapido else 220) * FACTOR_CIUDAD[cat_de_cid[cid]]
            minutos = max(2, round(math.exp(math.log(base) + (r2() - 0.5) * 2.4)))

        excluido = cid in a_excluir
        contactos.append({
            "consultorio_id": cid,
            "edicion_id": "ed-2026-09",
            "guion_id": "g-1",
            "canal": "whatsapp",
            "emisor_id": f"emisor-{1 + i % 3}",
            "enviado_en": f"2026-09-{3 + i % 9:02d}T{_hora(franja)}:00-05:00",
            "dia_semana": 1 + i % 5,
            "franja_horaria": franja,
            "estado_envio": "entregado",
            "minutos_primera_respuesta": minutos,
            "hubo_respuesta": "true" if respondio else "false",
            "tipo_primer_respondedor": ("automatico" if respondio and minutos != "" and minutos < 15 and r2() < 0.6 else "persona") if respondio else "",
            # no_observado en una parte de los que respondieron: tiene que salir
            # del numerador y del denominador, no contar como «no».
            "ofrecio_agendar": _tri(respondio, reloj > 0.55, r2() < 0.17),
            "dio_precio": _precio(respondio, reloj, r2()),
            "hubo_seguimiento_espontaneo": _tri(respondio, reloj > 0.80, r2() < 0.12),
            "codificado_por": "fixture",
            "codificado_en": "2026-09-14",
            "version_codificacion": "v1",
            "excluido_del_analisis": "true" if excluido else "false",
            "motivo_exclusion": "prueba de piloto, guion distinto" if excluido else "",
        })

    # ── excluidos del universo ─────────────────────────────────────────────
    for j, (estado, es_orto) in enumerate(EXCLUIDOS, start=1):
        consultorios.append({
            "consultorio_id": f"X-{j:03d}",
            "cid": f"9{j:019d}",
            "es_ortodoncia": "true" if es_orto else "false",
            "estado_registro": estado,
            "consultorio_id_maestro": "C-0004" if estado == "duplicado" else "",
            "motivo_duplicado": "mismo telefono" if estado == "duplicado" else "",
            "fuente_listado": "google_maps",
            "en_muestra_estudio": "false",
            "fecha_alta": "2026-09-01",
        })

    # ── paquete local: un ranking por municipio y consulta ─────────────────
    r3 = azar(semilla + 13)
    for dane, nombre, _d, _di, _c, _n, _a in municipios:
        lista = por_municipio.get(dane, [])
        for k, (consulta, _intencion) in enumerate(CONSULTAS):
            # Los controles se fuerzan: C-0001 siempre primero (presencia 5,
            # posición 1) y C-0002 nunca aparece. Sin eso, el ruido del ranking
            # los movería y dejarían de ser controles exactos.
            candidatos = [t for t in lista if t[0] != "C-0002"]
            resto = sorted(
                [t for t in candidatos if t[0] != "C-0001"],
                key=lambda t: -(t[1] + (r3() - 0.5) * 0.3),
            )
            fijo = [t for t in candidatos if t[0] == "C-0001"]
            orden = (fijo + resto)[:3]
            for pos, (cid, _p, nombre_serp) in enumerate(orden, start=1):
                serps.append({
                    "consulta_texto": f"{consulta} en {nombre}",
                    "consulta_normalizada": f"{consulta.replace(' ', '-')}-{k}-{dane}",
                    "municipio_id": dane,
                    "fecha_consulta": "2026-09-11",
                    "dispositivo": "movil",
                    "bloque": "paquete_local",
                    "posicion": pos,
                    "nombre_resultado_crudo": nombre_serp,
                    "consultorio_id": cid,
                    "metodo_emparejamiento": "place_id",
                    "confianza_emparejamiento": "1.0",
                })

    # ── escritura ──────────────────────────────────────────────────────────
    escribir(destino / "municipio.csv",
             ["municipio_id", "nombre_municipio", "departamento", "departamento_id",
              "categoria_ciudad", "area_metropolitana", "es_cabecera_de_area"],
             [{"municipio_id": d, "nombre_municipio": n, "departamento": dep,
               "departamento_id": di, "categoria_ciudad": c, "area_metropolitana": a,
               "es_cabecera_de_area": "true" if a else "false"}
              for d, n, dep, di, c, _cn, a in municipios])

    escribir(destino / "indicador_geografico.csv",
             ["ambito_tipo", "ambito_id", "indicador", "periodo", "valor", "unidad",
              "fuente", "version_serie", "fecha_captura"],
             [{"ambito_tipo": "municipio", "ambito_id": d, "indicador": "poblacion",
               "periodo": "2026", "valor": POBLACION[d], "unidad": "habitantes",
               "fuente": "dane_proyeccion", "version_serie": "2018-2035",
               "fecha_captura": "2026-09-01"} for d, *_ in municipios])

    escribir(destino / "volumen_busqueda.csv",
             ["consulta_texto", "consulta_normalizada", "vertical", "tipo_intencion",
              "conjunto", "ambito_tipo", "ambito_id", "fecha_captura", "herramienta",
              "ventana", "volumen_mes", "cpc_estimado", "dificultad_seo"],
             [{"consulta_texto": f"{c} en {n}", "consulta_normalizada": f"{c.replace(' ', '-')}-{k}-{d}",
               "vertical": "ortodoncia", "tipo_intencion": it, "conjunto": "nucleo",
               "ambito_tipo": "municipio", "ambito_id": d, "fecha_captura": "2026-09-05",
               "herramienta": "ubersuggest", "ventana": "12m",
               "volumen_mes": 20 + (POBLACION[d] // 40000) * (5 - k),
               "cpc_estimado": 1200 + k * 300, "dificultad_seo": 8 + k * 4}
              for d, n, *_ in municipios for k, (c, it) in enumerate(CONSULTAS)])

    escribir(destino / "consultorio.csv",
             ["consultorio_id", "cid", "place_id", "es_ortodoncia", "tipo_establecimiento",
              "estado_registro", "consultorio_id_maestro", "motivo_duplicado",
              "fuente_listado", "en_muestra_estudio", "estrato_muestra", "fecha_alta",
              "fecha_ultima_captura"], consultorios)

    escribir(destino / "consultorio_snapshot.csv",
             ["consultorio_id", "fecha_captura", "fuente_captura", "nombre_comercial",
              "nombre_normalizado", "categoria_principal",
              "municipio_id", "es_area_de_servicio", "calificacion", "resenas_total",
              "fecha_resena_mas_reciente", "resenas_respondidas_pct",
              "tiene_horario_publicado", "fotos_n", "telefono_e164", "dominio",
              "instagram_handle"], fichas)

    escribir(destino / "sitio_snapshot.csv",
             ["consultorio_id", "dominio", "fecha_rastreo", "estado_rastreo",
              "tiene_reserva_online", "tiene_pago_en_linea", "es_movil_responsive",
              "plataforma_agenda_detectada"], sitios)

    escribir(destino / "instagram_snapshot.csv",
             ["consultorio_id", "handle", "fecha_captura", "seguidores",
              "publicaciones_30d", "interaccion_promedio_pct", "es_cuenta_profesional",
              "destino_enlace", "publica_antes_despues"], cuentas)

    escribir(destino / "resena.csv",
             ["consultorio_id", "fecha_publicacion", "calificacion",
              "tiene_respuesta_del_negocio", "dias_hasta_respuesta", "fecha_captura"],
             resenas)

    escribir(destino / "contacto_campo.csv",
             ["consultorio_id", "edicion_id", "guion_id", "canal", "emisor_id",
              "enviado_en", "dia_semana", "franja_horaria", "estado_envio",
              "minutos_primera_respuesta", "hubo_respuesta", "tipo_primer_respondedor",
              "ofrecio_agendar", "dio_precio", "hubo_seguimiento_espontaneo",
              "codificado_por", "codificado_en", "version_codificacion",
              "excluido_del_analisis", "motivo_exclusion"], contactos)

    escribir(destino / "dato_declarado.csv",
             ["consultorio_id", "fecha", "evento", "campo", "valor_numero",
              "valor_texto", "valor_booleano", "rol_de_quien_declara", "confianza"],
             declarados)

    escribir(destino / "serp_local.csv",
             ["consulta_texto", "consulta_normalizada", "municipio_id", "fecha_consulta",
              "dispositivo", "bloque", "posicion", "nombre_resultado_crudo",
              "consultorio_id", "metodo_emparejamiento", "confianza_emparejamiento"],
             serps)

    ciudades = ";".join(d for d, *_ in municipios)
    escribir(destino / "edicion_estudio.csv",
             ["edicion_id", "nombre", "campo_inicio", "campo_fin", "corte_reloj_horas",
              "municipios_incluidos", "version_formula", "publicada_en", "notas_metodo"],
             [{"edicion_id": "ed-2026-09",
               "nombre": "Ortodoncia Colombia · primera edición",
               "campo_inicio": "2026-09-03", "campo_fin": "2026-09-11",
               "corte_reloj_horas": 48, "municipios_incluidos": ciudades,
               "version_formula": "v1.0", "publicada_en": "2026-09-25",
               "notas_metodo": "Datos sintéticos de prueba. No es un levantamiento de campo."}])


def _destino(p: float, control) -> str:
    if control == "C-0001":
        return "reserva"
    if control == "C-0002":
        return "ninguno"
    if p > 0.84:
        return "reserva"
    if p > 0.58:
        return "whatsapp"
    if p > 0.44:
        return "sitio"
    return "ninguno"


def _tri(respondio: bool, si: bool, no_obs: bool) -> str:
    if not respondio:
        return ""            # nulo, no «no»: no respondió, no se pudo observar
    if no_obs:
        return "no_observado"
    return "si" if si else "no"


def _precio(respondio: bool, reloj: float, ruido: float) -> str:
    if not respondio:
        return ""
    if ruido < 0.13:
        return "no_observado"
    return "exacto" if reloj > 0.78 else ("rango" if reloj > 0.46 else "no")


def _hora(franja: str) -> str:
    return {"manana": "09:15", "mediodia": "13:05", "tarde": "16:40"}[franja]


def _fecha_menos(base: str, dias: int) -> str:
    from datetime import date, timedelta
    y, m, d = (int(x) for x in base.split("-"))
    return (date(y, m, d) - timedelta(days=int(dias))).isoformat()


if __name__ == "__main__":
    generar(RAIZ / "datos", MUNICIPIOS, 20260911, "edición completa · 160 en universo")
    minimo = [
        ("08001", "Barranquilla", "Atlántico", "08", "capital_principal", 11, ""),
        ("73001", "Ibagué", "Tolima", "73", "intermedia", 10, ""),
        ("66001", "Pereira", "Risaralda", "66", "capital_departamental", 9, ""),
    ]
    generar(RAIZ / "tests" / "fixtures" / "minimo", minimo, 424242,
            "mínimo · 30 en universo, casi nada publicable")
