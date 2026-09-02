#!/usr/bin/env python3
"""
Una página por consultorio medido, más su PDF tamaño carta.

    python3 render_auditoria.py --edicion 2026-09 --consultorio TODOS
    python3 render_auditoria.py --edicion 2026-09 --consultorio C-0005

Lee `build/edicion_*.json` y `build/reportes/{id}.json` por el lector
identificado, y **no calcula nada**: si aquí hiciera falta un número que el JSON
no trae, el número falta en calcular.py.

La salida se entrega solo al consultorio medido. Los archivos se nombran por
`consultorio_id`, nunca por el nombre del establecimiento.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from html import escape
from pathlib import Path

import estilo
import plantilla
import svg
from lectura import listar_reportes, leer_identificado

RAIZ = Path(__file__).resolve().parent

CHROMIUM_CANDIDATOS = [
    "chromium", "chromium-browser", "google-chrome", "google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
]


# ═══════════════════════════════════════════════════════════════════════════
# Fragmentos
# ═══════════════════════════════════════════════════════════════════════════

def _meta(ed: dict, rep: dict) -> str:
    f = ed["ficha_tecnica"]
    filas = [
        ("Consultorio", rep["nombre_comercial"] or "sin nombre en la ficha"),
        ("Municipio", rep["municipio"] or "no resuelto"),
        ("Medición", f"{f['campo_inicio']} a {f['campo_fin']}"),
        ("Muestra", f"{f['n_medidos']} consultorios"),
        ("Ciudades", str(f["n_ciudades"])),
    ]
    return "".join(
        f"<div><dt>{escape(k)}</dt><dd>{escape(str(v))}</dd></div>" for k, v in filas
    )


def _declarados(ed: dict, rep: dict) -> str:
    """
    Los tres datos declarados, en un bloque visualmente distinto porque son los
    únicos que no se observaron. No puntúan.
    """
    campos = [
        ("precio_lista", "Precio de lista · tratamiento principal"),
        ("cobra_primera_cita", "Cobro de la primera cita"),
        ("consultas_mes", "Consultas nuevas al mes"),
    ]
    partes = []
    for clave, etiqueta in campos:
        ind = rep["indicadores"][clave]
        nota = (
            "Aportado por el consultorio" if ind["texto"] != "no medido"
            else "No lo aportó: no se observa desde afuera"
        )
        partes.append(
            f'<div><div class="k">{escape(etiqueta)}</div>'
            f'<div class="v">{escape(ind["texto"])}</div>'
            f'<div class="n">{escape(nota)}</div></div>'
        )
    return "".join(partes)


def _tabla_bloque(ed: dict, rep: dict, bloque_id: str) -> str:
    """
    Los indicadores del bloque con su valor, la mediana y el décimo superior.
    Los declarados van marcados; los observados no llevan marca.
    """
    filas, hay_declarado = [], False
    for ind_id in next(b for b in ed["bloques"] if b["id"] == bloque_id)["indicadores"]:
        agregado = ed["indicadores"][ind_id]
        propio = rep["indicadores"][ind_id]
        marca = ""
        if propio["declarado"]:
            hay_declarado = True
            marca = '<span class="marca-declarado">declarado</span>'
        clase = "suyo" if propio["texto"] != "no medido" else "suyo nomedido"
        filas.append(
            f"<tr><td>{escape(agregado['nombre'])}{marca}</td>"
            f'<td class="{clase}">{escape(propio["texto"])}</td>'
            f'<td>{escape(agregado["mediana_texto"] if agregado["publicable"] else "no medido")}</td>'
            f'<td>{escape(agregado["top10_texto"] if agregado["publicable"] else "no medido")}</td></tr>'
        )
    nota = (
        f'<p class="nota-tabla">{escape(ed["textos"]["auditoria"]["nota_declarados"])}</p>'
        if hay_declarado else ""
    )
    return (
        "<table><thead><tr><th>Indicador</th><th>Este consultorio</th>"
        "<th>Mediana</th><th>Décimo superior</th></tr></thead>"
        f"<tbody>{''.join(filas)}</tbody></table>{nota}"
    )


def _distancia(b: dict) -> str:
    """Texto de la distancia. Los números vienen restados del motor."""
    if b["puntaje"] is None:
        return "Este bloque no se midió en esta edición."
    dm, dt = b["distancia_mediana"], b["distancia_top10"]
    if dm is None:
        return "Sin muestra suficiente para situar este bloque."
    if b["por_encima_de_la_mediana"]:
        arriba = f'<span class="arriba">Por encima de la mediana en <b>{abs(dm):.0f} puntos</b>.</span>'
        return f"{arriba} Hasta el décimo superior: <b>{dt:.0f} puntos</b>."
    return (
        f"Distancia hasta la mediana de la muestra: <b>{abs(dm):.0f} puntos</b>. "
        f"Hasta el décimo superior: <b>{dt:.0f} puntos</b>."
    )


def _bloques(ed: dict, rep: dict, parcial: str) -> str:
    partes = []
    for i, agregado in enumerate(sorted(ed["bloques"], key=lambda b: b["paso"])):
        bid = agregado["id"]
        propio = rep["bloques"][bid]
        prosa = ed["textos"]["bloques"][bid]
        grafico = svg.curva_distribucion(
            agregado["curva"] if agregado["publicable"] else [],
            mediana=agregado["mediana"],
            top10=agregado["p90"],
            puntaje=propio["puntaje"],
            estampa=f"bloque.{bid}.mediana",
        )
        pie = (
            '<div class="pie-grafico">La curva es la distribución de puntajes de la muestra. '
            "La marca azul es este consultorio y el área sombreada es la distancia hasta la "
            "mediana.</div>" if i == 0 else ""
        )
        partes.append(plantilla.rellenar(parcial, {
            "paso": agregado["paso"],
            "nombre": escape(agregado["nombre"]),
            "subtitulo": escape(agregado["subtitulo"]),
            "descripcion": escape(prosa["descripcion"]),
            "percentil": "—" if propio["percentil"] is None else int(round(propio["percentil"])),
            "puntaje_texto": (
                "no medido" if propio["puntaje"] is None
                else f"puntaje {propio['puntaje']:.0f} / 100"
            ),
            "grafico": grafico,
            "pie_grafico": pie,
            "distancia": _distancia(propio),
            "tabla": _tabla_bloque(ed, rep, bid),
            "mecanismo": escape(prosa["mecanismo"]),
        }, origen=f"auditoria_bloque[{bid}]"))
    return "".join(partes)


def _tira(ed: dict, rep: dict) -> str:
    filas = []
    for agregado in sorted(ed["bloques"], key=lambda b: b["paso"]):
        propio = rep["bloques"][agregado["id"]]
        filas.append({
            "paso": agregado["paso"],
            "nombre": agregado["nombre"],
            "percentil": propio["percentil"],
            "token_color": (propio["banda"] or {}).get("token_color", "cuartil-1"),
        })
    return svg.tira_percentiles(filas)


def _metodo(ed: dict) -> str:
    f, m = ed["ficha_tecnica"], ed["textos"]["metodo"]
    ciudades = ", ".join(sorted(c["nombre"] for c in f["ciudades"]))
    filas = [
        ("Universo y muestra",
         f"{f['n_universo']} consultorios en el universo del censo; "
         f"{f['n_medidos']} recibieron el instrumento de campo y {f['n_respondio']} "
         f"respondieron dentro del corte de reloj. Ciudades: {ciudades}."),
        ("Ventana de campo", f"Del {f['campo_inicio']} al {f['campo_fin']}."),
        ("Corte del reloj", f"{f['corte_reloj_horas']} horas. Lo que llegó después se "
                            "registra como sin respuesta y no entra en el cálculo de la mediana."),
        ("Consulta enviada", m["instrumento"]),
        ("Qué se registró", m["que_se_registro"]),
        ("Los dos denominadores", m["denominadores"]),
        ("Observación ausente", m["no_observado"]),
        ("Puntaje y peso", _pesos(ed)),
        ("Anonimato", m["anonimato"]),
        ("Qué no se midió", m["que_no_se_midio"]),
    ]
    if ed["ficha_tecnica"].get("notas_metodo"):
        filas.insert(0, ("Datos de esta edición", ed["ficha_tecnica"]["notas_metodo"]))
    return "".join(f"<div><dt>{escape(k)}</dt><dd>{escape(v)}</dd></div>" for k, v in filas)


def _pesos(ed: dict) -> str:
    partes = [
        f"{b['nombre'].lower()} {b['peso'] * 100:.0f} %"
        for b in sorted(ed["bloques"], key=lambda b: -b["peso"])
    ]
    return (
        "Cada bloque puntúa de 0 a 100 con anclas fijas, no con el rango de la muestra, "
        "para que el puntaje sea comparable entre ediciones. El general pondera "
        + ", ".join(partes) + ". El percentil sí se calcula contra la distribución de esta edición."
    )


def _sello(ed: dict) -> str:
    huellas = " · ".join(f"{k} {v[:12]}" for k, v in sorted(ed["huella_entradas"].items()))
    return escape(
        f"Edición {ed['edicion_id']} · fórmula {ed['version_formula']} · "
        f"calculado {ed['fecha_calculo']} · huella de entradas: {huellas}"
    )


# ═══════════════════════════════════════════════════════════════════════════
# Render
# ═══════════════════════════════════════════════════════════════════════════

def render_uno(ed: dict, rep: dict, marca: dict, *, solo_claro: bool = False) -> str:
    base = plantilla.cargar("auditoria.html")
    parcial = plantilla.cargar("auditoria_bloque.html")
    t = ed["textos"]
    general = rep["general"]
    banda = general["banda"] or {"nombre": "no medido", "token_color": "cuartil-1"}

    pie = (
        "percentil general. No se pudo calcular en esta edición."
        if general["percentil"] is None else
        f"percentil general. {int(round(general['percentil']))} de cada cien consultorios "
        f"medidos quedaron por debajo de este puntaje ({general['puntaje']:.0f} / 100)."
    )

    return plantilla.rellenar(base, {
        "titulo_pagina": f"{t['auditoria']['titulo']} · {rep['consultorio_id']}",
        "estilo": estilo.css(marca, solo_claro=solo_claro),
        "cintillo": estilo.cintillo(
            marca, datos_sinteticos=bool(ed["ficha_tecnica"].get("datos_sinteticos"))
        ),
        "marca": estilo.marca_visible(marca),
        "marca_nombre": escape(marca["nombre"]),
        "titulo": escape(t["auditoria"]["titulo"]),
        "deck": escape(t["auditoria"]["deck"]),
        "meta": _meta(ed, rep),
        "percentil_general": "—" if general["percentil"] is None else int(round(general["percentil"])),
        "pie_percentil": escape(pie),
        "banda_nombre": escape(banda["nombre"]),
        "banda_token": banda["token_color"],
        "tira": _tira(ed, rep),
        "intro_declarados": escape(t["auditoria"]["intro_declarados"]),
        "declarados": _declarados(ed, rep),
        "intro_bloques": escape(t["auditoria"]["intro_bloques"]),
        "bloques": _bloques(ed, rep, parcial),
        "limites": "".join(f"<li>{escape(x)}</li>" for x in t["limites_auditoria"]),
        "metodo_intro": escape(t["metodo"]["intro"]),
        "metodo": _metodo(ed),
        "territorio_titulo": escape(t["territorio"]["titulo"]),
        "territorio_texto": escape(t["territorio"]["texto"]),
        "edicion_nombre": escape(ed["ficha_tecnica"]["nombre"] or ed["edicion_id"]),
        "sello": _sello(ed),
    }, origen="auditoria.html")


def buscar_chromium(explicito: str | None) -> str | None:
    for c in ([explicito] if explicito else []) + CHROMIUM_CANDIDATOS:
        if not c:
            continue
        ruta = shutil.which(c) or (c if Path(c).exists() else None)
        if ruta:
            return ruta
    return None


def a_pdf(html: str, destino: Path, chromium: str) -> None:
    """
    PDF por Chromium imprimiendo el mismo HTML, para que el impreso sea idéntico
    a la pantalla. El HTML del PDF se genera en modo claro: un impreso no tiene
    modo oscuro y heredar el del sistema daría una hoja negra.
    """
    with tempfile.TemporaryDirectory() as tmp:
        fuente = Path(tmp) / "pagina.html"
        fuente.write_text(html, encoding="utf-8")
        r = subprocess.run(
            [chromium, "--headless=new", "--disable-gpu", "--no-sandbox",
             "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw",
             "--virtual-time-budget=4000",
             f"--print-to-pdf={destino}", fuente.as_uri()],
            capture_output=True, text=True, timeout=180,
        )
        if not destino.exists():
            raise RuntimeError(f"Chromium no produjo el PDF:\n{r.stdout}\n{r.stderr}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Renderiza las auditorías individuales.")
    ap.add_argument("--edicion", required=True)
    ap.add_argument("--consultorio", default="TODOS")
    ap.add_argument("--salida", default="./build")
    ap.add_argument("--chromium", default=None, help="Ruta al navegador para el PDF")
    ap.add_argument("--sin-pdf", action="store_true", help="Solo HTML")
    args = ap.parse_args(argv)

    marca = estilo.cargar_marca()
    salida = Path(args.salida)
    destino = salida / "auditorias"
    destino.mkdir(parents=True, exist_ok=True)

    ids = listar_reportes(salida) if args.consultorio == "TODOS" else [args.consultorio]
    if not ids:
        print("No hay reportes. Corre primero calcular.py.", file=sys.stderr)
        return 1

    chromium = None if args.sin_pdf else buscar_chromium(args.chromium)
    if not args.sin_pdf and not chromium:
        print("No encontré Chromium; se generará solo HTML. Pasa --chromium RUTA "
              "o usa --sin-pdf para no volver a verlo.", file=sys.stderr)

    for i, cid in enumerate(ids, start=1):
        ed, rep = leer_identificado(args.edicion, cid, salida)
        html = render_uno(ed, rep, marca)
        (destino / f"{cid}.html").write_text(html, encoding="utf-8")
        if chromium:
            a_pdf(render_uno(ed, rep, marca, solo_claro=True),
                  destino / f"{cid}.pdf", chromium)
        if i % 25 == 0 or i == len(ids):
            print(f"  {i}/{len(ids)}")

    print(f"\n{len(ids)} auditorías en {destino}"
          f"{' · con PDF' if chromium else ' · solo HTML'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
