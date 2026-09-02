#!/usr/bin/env python3
"""
Una página pública desde el JSON de la edición.

    python3 render_agregado.py --edicion 2026-09

Usa **únicamente** el lector anónimo: si una plantilla de este documento pidiera
un nombre propio, el lector revienta con un mensaje que explica la regla. Habla
del sector y nunca del proveedor, en tercera persona sobre los consultorios
medidos y nunca en segunda sobre un profesional.

No calcula nada. Si aquí hiciera falta un número que el JSON no trae, el número
falta en calcular.py.
"""

from __future__ import annotations

import argparse
import sys
from html import escape
from pathlib import Path

import estilo
import plantilla
import svg
from lectura import leer_anonimo

RAIZ = Path(__file__).resolve().parent

NO_MEDIDO = (
    '<p class="h-nomedido"><b>No medido en esta edición.</b> La muestra de este corte '
    "no llegó al mínimo de observaciones que el estudio exige para publicar una cifra, "
    "así que el hallazgo no se estima ni se interpola.</p>"
)


# ═══════════════════════════════════════════════════════════════════════════
# Gráficos y tablas por forma
# ═══════════════════════════════════════════════════════════════════════════

def _tabla(encabezados: list[str], filas: list[list[str]]) -> str:
    th = "".join(f"<th>{escape(h)}</th>" for h in encabezados)
    tr = "".join(
        "<tr>" + "".join(f"<td>{escape(str(c))}</td>" for c in fila) + "</tr>" for fila in filas
    )
    return (
        '<details class="tabla-datos"><summary>Ver los datos en tabla</summary>'
        f'<div class="desliza"><table><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'
        "</details>"
    )


def _grafico_y_tabla(h: dict, E: dict) -> tuple[str, str]:
    """Cada forma sabe qué estadística consume y qué tabla equivalente publica."""
    forma, clave = h["forma"], h["grafica"]
    e = E[clave]
    estampa = f"hallazgo.{h['id']}"

    if forma == "barras":
        datos = e["valor"]
        extra = ("incluye la cubeta sin respuesta"
                 if clave == "respuesta.distribucion_minutos" else "")
        grafico = svg.barras(datos, unidad=_unidad(e, extra), estampa=estampa)
        tabla = _tabla(["Categoría", "Consultorios"], [[d["etiqueta"], d["n"]] for d in datos])
        return grafico, tabla

    if forma == "linea":
        orden = ["manana", "mediodia", "tarde"]
        etiquetas = {"manana": "Mañana", "mediodia": "Mediodía", "tarde": "Tarde"}
        datos = [
            {"etiqueta": etiquetas.get(k, k), "valor": e["valor"][k]["valor"],
             "texto": e["valor"][k]["texto"], "clave": k, "n": e["valor"][k]["n"]}
            for k in orden if k in e["valor"]
        ]
        grafico = svg.linea(datos, unidad=_unidad(e, "% respondido dentro de la primera hora"),
                            destacar="Mediodía", estampa=estampa)
        tabla = _tabla(["Franja", "Medidos", "Respondió en 1ª hora"],
                       [[d["etiqueta"], d["n"], d["texto"]] for d in datos])
        return grafico, tabla

    if forma == "barras_grupo":
        etiquetas = {
            "categoria_correcta": "Con la categoría de su especialidad",
            "categoria_incorrecta": "Con otra categoría",
        }
        datos = [
            {"etiqueta": etiquetas.get(k, k.replace("_", " ")), "valor": v["valor"],
             "texto": v["texto"], "nota": f"n = {v['n']} · aparecen {v['aparecen']}"}
            for k, v in e["valor"].items()
        ]
        grafico = svg.barras_grupo(datos, unidad=_unidad(e, "% que aparece en el bloque de mapas"),
                                   estampa=estampa)
        tabla = _tabla(["Grupo", "Consultorios", "Aparecen", "% que aparece"],
                       [[d["etiqueta"], d["nota"].split("·")[0].replace("n = ", "").strip(),
                         d["nota"].split("aparecen")[1].strip(), d["texto"]] for d in datos])
        return grafico, tabla

    if forma == "dispersion":
        grafico = svg.dispersion(
            e["puntos"], unidad=_unidad(e, "minutos hasta la primera respuesta"),
            eje_y=e["eje_y"], rho_texto=f"rho de Spearman = {_coma(e['valor'])}",
            mediana_y=e["mediana_y"], estampa=estampa,
        )
        otra = E[next(c for c in h["estadisticas"] if c != clave)]
        tabla = _tabla(
            ["Cruce", "Consultorios", "rho de Spearman", "Mediana del eje vertical"],
            [
                [f"Respuesta contra {e['eje_y']}", e["n"], _coma(e["valor"]), _coma(e["mediana_y"])],
                [f"Respuesta contra {otra['eje_y']}", otra["n"], _coma(otra["valor"]),
                 _coma(otra["mediana_y"])],
            ],
        )
        return grafico, tabla

    raise ValueError(f"Forma de gráfico desconocida: {forma}")


DENOMINADOR_LEGIBLE = {
    "universo": "consultorios del universo",
    "medidos": "consultorios medidos",
    "respondieron": "consultorios que respondieron",
    "con_ficha": "consultorios con ficha leída",
    "con_sitio_rastreado": "sitios rastreados con estado correcto",
    "con_instagram": "cuentas públicas emparejadas",
    "con_serp_medido": "consultorios en municipio con búsqueda medida",
    "declararon": "consultorios que declararon el dato",
}


def _unidad(e: dict, extra: str = "") -> str:
    """
    Toda unidad de gráfico lleva su denominador y su n. Es lo que hace exigible
    que ninguna estadística se publique sin decir sobre qué se calculó.
    """
    base = DENOMINADOR_LEGIBLE.get(e["denominador"], e["denominador"])
    cola = f" · {extra}" if extra else ""
    sin_observar = (
        f" · {e['no_observado_n']} sin observar" if e.get("no_observado_n") else ""
    )
    return f"{base} · n = {e['n']}{sin_observar}{cola}"


def _coma(v) -> str:
    return "no medido" if v is None else str(v).replace(".", ",")


# ═══════════════════════════════════════════════════════════════════════════
# Fragmentos
# ═══════════════════════════════════════════════════════════════════════════

def _franja_metodo(d: dict) -> str:
    f = d["ficha_tecnica"]
    filas = [
        ("Muestra", f"{f['n_medidos']} consultorios"),
        ("Universo", f"{f['n_universo']}"),
        ("Respondieron", f"{f['n_respondio']}"),
        ("Ciudades", f"{f['n_ciudades']}"),
        ("Campo", f"{f['campo_inicio']} a {f['campo_fin']}"),
        ("Publicación", "Agregada y anónima"),
    ]
    return "".join(f"<div><dt>{escape(k)}</dt><dd>{escape(str(v))}</dd></div>" for k, v in filas)


def _indice(d: dict) -> str:
    partes = ['<span class="et">Hallazgos</span>']
    for h in d["hallazgos"]:
        partes.append(f'<a href="#{h["id"]}">{h["numero"]}</a>')
    partes.append('<span class="sep"></span>')
    for anc, txt in (("metodo", "Método"), ("contexto", "Contexto"),
                     ("limites", "Límites"), ("ficha", "Ficha técnica")):
        partes.append(f'<a href="#{anc}">{escape(txt)}</a>')
    return "".join(partes)


def _apoyo(d: dict) -> str:
    partes = []
    for a in d["titular"]["apoyo"]:
        cifra = a["cifra"] if a["publicable"] else "no medido"
        partes.append(
            f'<div><div class="n">{escape(cifra)}</div>'
            f'<div class="t">{escape(a["texto"])}</div></div>'
        )
    return "".join(partes)


def _metodo(d: dict) -> str:
    f, m, E = d["ficha_tecnica"], d["textos"]["metodo"], d["estadisticas"]
    ciudades = ", ".join(sorted(c["nombre"] for c in f["ciudades"]))
    corte = d["cortes"]["tipo_ciudad"]
    grupos = " · ".join(f"{k.replace('_', ' ')} {v}" for k, v in sorted(corte["grupos"].items()))
    corte_texto = (
        f"El percentil se calcula sobre el total nacional. El corte por tipo de ciudad se "
        f"publica aparte porque cada grupo llega al mínimo de {corte['minimo_grupo']} "
        f"observaciones: {grupos}."
        if corte["publicable"] else
        f"El corte por tipo de ciudad no se publica en esta edición: {corte['motivo']}."
    )
    prohibido = d["cortes"]["municipio"]
    cruce = d["cortes"]["franja_x_tipo_ciudad"]

    filas = [
        ("Universo", f"{f['n_universo']} consultorios de ortodoncia con presencia pública en "
                     f"{f['n_ciudades']} ciudades: {ciudades}."),
        ("Muestra", f"{f['n_medidos']} recibieron el instrumento de campo y {f['n_respondio']} "
                    f"respondieron dentro del corte de reloj."),
        ("Instrumento", m["instrumento"]),
        ("Ventana", f"Del {f['campo_inicio']} al {f['campo_fin']}."),
        ("Qué se registró", m["que_se_registro"]),
        ("Corte del reloj", f"{f['corte_reloj_horas']} horas. Lo que llegó después se registra "
                            "como sin respuesta y no entra en el cálculo de la mediana."),
        ("Los dos denominadores", m["denominadores"]),
        ("Observación ausente", m["no_observado"]),
        ("Cortes publicados", corte_texto),
        ("Cortes que no se publican",
         f"Por ciudad individual, nunca: {prohibido['motivo']}. "
         f"El cruce de franja y tipo de ciudad tampoco en esta edición: {cruce['motivo']}."),
        ("Publicación", m["anonimato"]),
        ("Qué no se midió", m["que_no_se_midio"]),
    ]
    if f.get("notas_metodo"):
        filas.insert(0, ("Datos de esta edición", f["notas_metodo"]))

    html = "".join(f"<div><dt>{escape(k)}</dt><dd>{escape(v)}</dd></div>" for k, v in filas)
    return html + _bloques_publicados(d)


def _bloques_publicados(d: dict) -> str:
    """
    La mediana de cada bloque, publicada y estampada.

    Va en la ficha de método porque es declaración de método, no una sección
    nueva. Y tiene que estar: es la cifra que la auditoría individual dibuja en
    su curva, así que sin publicarla aquí la prueba de consistencia entre los dos
    documentos no tendría contra qué comparar.
    """
    partes = []
    for b in sorted(d["bloques"], key=lambda x: x["paso"]):
        if not b["publicable"] or b["mediana"] is None:
            partes.append(
                f'<span data-stat="bloque.{b["id"]}.mediana">'
                f'{escape(b["nombre"])} no medido</span>'
            )
            continue
        partes.append(
            f'<span data-stat="bloque.{b["id"]}.mediana" data-valor="{b["mediana"]}">'
            f'{escape(b["nombre"])} {b["mediana"]:.0f}</span>'
        )
    lista = " · ".join(partes)
    pesos = ", ".join(
        f"{b['nombre'].lower()} {b['peso'] * 100:.0f} %"
        for b in sorted(d["bloques"], key=lambda x: -x["peso"])
    )
    return (
        "<div><dt>Puntaje y peso</dt><dd>Cada bloque puntúa de 0 a 100 con anclas fijas, no con "
        "el rango de la muestra, para que el puntaje sea comparable entre ediciones. El general "
        f"pondera {escape(pesos)}. El percentil sí se calcula contra la distribución de esta "
        "edición.</dd></div>"
        f"<div><dt>Mediana de cada bloque en esta edición</dt><dd>{lista}</dd></div>"
    )


def _hallazgos(d: dict, parcial: str) -> str:
    partes = []
    for h in d["hallazgos"]:
        if h["publicable"]:
            grafico, tabla = _grafico_y_tabla(h, d["estadisticas"])
        else:
            grafico, tabla = NO_MEDIDO, ""
        nota = (
            f'<p class="h-denominador">{escape(h["nota_denominador"])}</p>'
            if h.get("nota_denominador") else ""
        )
        lede = h["lede"] if h["concluyente"] else (
            h["lede"] + " La comprobación de este hallazgo no pasó con los datos de esta "
            "edición, así que se publica como no concluyente."
        )
        partes.append(plantilla.rellenar(parcial, {
            "id": h["id"],
            "numero": h["numero"],
            "clase_num": "h-contra" if h["contra_hallazgo"] else "",
            "titulo": escape(h["titulo"]),
            "lede": escape(lede),
            "nota_denominador": nota,
            "grafico": grafico,
            "tabla": tabla,
            "no_dice": escape(h["no_dice"]),
        }, origen=f"agregado_hallazgo[{h['id']}]"))
    return "".join(partes)


def _contexto_grid(d: dict) -> str:
    c = d["contexto_demanda"]
    partes = [
        f'<div><div class="k">Búsqueda mensual medida</div>'
        f'<div class="n">{escape(c["volumen_total_texto"])}</div>'
        f'<div class="d">consultas al mes sumadas sobre {c["n_consultas"]} consultas distintas</div></div>',
        f'<div><div class="k">Dificultad de posicionamiento</div>'
        f'<div class="n">{_coma(c["dificultad_mediana"])}</div>'
        f'<div class="d">mediana sobre las consultas medidas</div></div>',
    ]
    for ciudad in c["por_ciudad"][:2]:
        partes.append(
            f'<div><div class="k">{escape(ciudad["nombre"])}</div>'
            f'<div class="n">{escape(ciudad["volumen_texto"])}</div>'
            f'<div class="d">consultas al mes</div></div>'
        )
    return "".join(partes)


def _ficha(d: dict) -> str:
    f, t = d["ficha_tecnica"], d["textos"]
    filas = [
        ("Título", f"{t['estudio']['titulo']}. {t['estudio']['subtitulo']}"),
        ("Edición", t["estudio"]["etiqueta_edicion"]),
        ("Muestra efectiva", f"{f['n_medidos']} consultorios · {f['n_respondio']} respondieron "
                             f"dentro de {f['corte_reloj_horas']} horas"),
        ("Ventana de campo", f"Del {f['campo_inicio']} al {f['campo_fin']}"),
        ("Ciudades", ", ".join(sorted(c["nombre"] for c in f["ciudades"]))),
        ("Versión de la fórmula", d["version_formula"]),
        ("Excluidos", f"{f['excluidos_del_universo']} del universo por estado de registro o "
                      f"alcance; {f['excluidos_del_analisis']} del análisis de campo"),
        ("Errores y correcciones", "Las correcciones posteriores a la publicación se registran "
                                   "al final de esta página, con fecha."),
        ("Uso", "Los datos agregados pueden reproducirse citando la fuente. No se entregan "
                "datos por consultorio a terceros."),
    ]
    return "".join(f"<div><dt>{escape(k)}</dt><dd>{escape(v)}</dd></div>" for k, v in filas)


def _sello(d: dict) -> str:
    huellas = " · ".join(f"{k} {v[:12]}" for k, v in sorted(d["huella_entradas"].items()))
    return escape(
        f"Edición {d['edicion_id']} · fórmula {d['version_formula']} · "
        f"calculado {d['fecha_calculo']} · huella de entradas: {huellas}"
    )


# ═══════════════════════════════════════════════════════════════════════════
# Render
# ═══════════════════════════════════════════════════════════════════════════

def render(d: dict, marca: dict, *, solo_claro: bool = False) -> str:
    base = plantilla.cargar("agregado.html")
    parcial = plantilla.cargar("agregado_hallazgo.html")
    t, c = d["textos"], d["contexto_demanda"]

    return plantilla.rellenar(base, {
        "titulo_pagina": t["estudio"]["titulo"],
        "descripcion": t["estudio"]["subtitulo"],
        "estilo": estilo.css(marca, solo_claro=solo_claro),
        "cintillo": estilo.cintillo(
            marca, datos_sinteticos=bool(d["ficha_tecnica"].get("datos_sinteticos"))
        ),
        "marca": estilo.marca_visible(marca),
        "marca_nombre": escape(marca["nombre"]),
        "etiqueta_edicion": escape(t["estudio"]["etiqueta_edicion"]),
        "titulo": escape(t["estudio"]["titulo"]),
        "subtitulo": escape(t["estudio"]["subtitulo"]),
        "franja_metodo": _franja_metodo(d),
        "indice": _indice(d),
        "cifra": escape(d["titular"]["cifra"]),
        "pie": escape(d["titular"]["pie"]),
        "apoyo": _apoyo(d),
        "metodo_intro": escape(t["metodo"]["intro"]),
        "metodo": _metodo(d),
        "hallazgos_intro": "Cada hallazgo va con el gráfico del que sale, con su tabla de datos "
                           "y con una línea que dice qué no permite concluir.",
        "hallazgos": _hallazgos(d, parcial),
        "contexto_intro": escape(c["intro"]),
        "contexto_titulo": "Búsqueda mensual en las ciudades medidas",
        "contexto_etiqueta": escape(c["etiqueta"]),
        "contexto_grid": _contexto_grid(d),
        "contexto_nota": escape(c["nota"]),
        "limites": "".join(f"<li>{escape(x)}</li>" for x in t["limites_informe"]),
        "ficha": _ficha(d),
        "cita": escape(t["estudio"]["como_citar"]),
        "autoria_titulo": escape(t["autoria"]["titulo"]),
        "autoria_texto": escape(t["autoria"]["texto"]),
        "sello": _sello(d),
    }, origen="agregado.html")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Renderiza el informe agregado.")
    ap.add_argument("--edicion", required=True)
    ap.add_argument("--salida", default="./build")
    args = ap.parse_args(argv)

    salida = Path(args.salida)
    d = leer_anonimo(args.edicion, salida)
    html = render(d, estilo.cargar_marca())
    destino = salida / "informe-agregado.html"
    destino.write_text(html, encoding="utf-8")
    print(f"\n{destino} · {len(html) // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
