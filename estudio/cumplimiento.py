#!/usr/bin/env python3
"""
Revisión de cumplimiento. Se corre ANTES de publicar y falla si encuentra algo.

    python3 cumplimiento.py --edicion 2026-09

Revisa los HTML ya generados, no el código: lo que importa es lo que va a salir
impreso. Cada control corresponde a una regla dura del encargo, y el que falla
dice qué regla rompió y dónde.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent

# Lenguaje de proyección. El negocio no tiene todavía casos firmados que
# autoricen una afirmación de resultado, así que ningún documento puede decir
# qué pasaría si el consultorio cambiara algo.
PROYECCION = [
    (r"podr[íi]a (?:captar|conseguir|ganar|aumentar|generar)", "afirma un resultado hipotético"),
    (r"dejando .{0,25}sobre la mesa", "cuantifica una pérdida no medida"),
    (r"(?:aumentar[íi]a|subir[íi]a|bajar[íi]a|mejorar[íi]a) (?:en |un |el |la )?\d", "proyecta un cambio"),
    (r"\d[\d.,]*\s+pacientes m[áa]s", "proyecta pacientes adicionales"),
    (r"retorno de inversi[óo]n|\bROI\b", "habla de retorno"),
    (r"si (?:mejora|corrige|arregla|sube|baja)\b.{0,60}\d", "condiciona una cifra a un cambio"),
    (r"(?:equivale|equivalente) a \$", "traduce a dinero una cifra no medida"),
    (r"oportunidad de \$|potencial de \$", "cuantifica una oportunidad"),
]

# Segunda persona sobre un atributo personal. Prohibida en el agregado: sus
# cortes se usan como piezas publicitarias y la segunda persona las hace
# rechazar. En la auditoría sí se admite, es para su destinatario.
SEGUNDA_PERSONA = r"\busted\b|\btu\s+consultorio\b|\bsu\s+consultorio\b|\btus\s+pacientes\b"

COLOR_LITERAL = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)")


class Revision:
    def __init__(self) -> None:
        self.fallos: list[tuple[str, str]] = []
        self.avisos: list[str] = []
        self.controles = 0

    def control(self, nombre: str, ok: bool, detalle: str = "") -> None:
        self.controles += 1
        if not ok:
            self.fallos.append((nombre, detalle))

    def aviso(self, texto: str) -> None:
        self.avisos.append(texto)


def cuerpo(html: str) -> str:
    """El documento sin el bloque de estilo generado."""
    return html.split("</style>", 1)[1] if "</style>" in html else html


def _sin_etiquetas(html: str) -> str:
    return re.sub(r"<[^>]+>", " ", html)


# ═══════════════════════════════════════════════════════════════════════════
# Controles
# ═══════════════════════════════════════════════════════════════════════════

def revisar_anonimato(r: Revision, agregado: str, reportes: list[dict]) -> None:
    nombres = [x["nombre_comercial"] for x in reportes if x.get("nombre_comercial")]
    filtrados = sorted({n for n in nombres if n in agregado})
    r.control(
        "El informe agregado no nombra ningún consultorio",
        not filtrados,
        f"{len(filtrados)} nombre(s) en el informe público: {filtrados[:3]}",
    )
    if not nombres:
        r.aviso(
            "Ningún reporte trae nombre de consultorio, así que el control de anonimato "
            "no tiene nada que buscar y pasa de vacío. Revisa que los datos traigan nombres."
        )

    ids = sorted({x["consultorio_id"] for x in reportes if x["consultorio_id"] in agregado})
    r.control("El informe agregado no trae identificadores de consultorio", not ids, str(ids[:3]))


def revisar_proyeccion(r: Revision, documentos: dict[str, str]) -> None:
    encontrados: list[str] = []
    for nombre, html in documentos.items():
        texto = _sin_etiquetas(cuerpo(html))
        for patron, motivo in PROYECCION:
            for m in re.finditer(patron, texto, re.I):
                ctx = " ".join(texto[max(0, m.start() - 40):m.end() + 40].split())
                encontrados.append(f"{nombre}: {motivo} → «…{ctx}…»")
    r.control(
        "Ninguna cifra proyectada en ningún documento",
        not encontrados,
        "\n      ".join(encontrados[:5]),
    )


def revisar_segunda_persona(r: Revision, agregado: str) -> None:
    texto = _sin_etiquetas(cuerpo(agregado))
    hits = sorted({m.group(0).lower() for m in re.finditer(SEGUNDA_PERSONA, texto, re.I)})
    r.control(
        "El informe agregado habla en tercera persona del sector",
        not hits,
        f"segunda persona: {hits}",
    )


def revisar_n_visible(r: Revision, agregado: str, edicion: dict) -> None:
    tarjetas = re.findall(
        r'<article class="tarjeta hallazgo" id="(\w+)">(.*?)</article>', agregado, re.S
    )
    r.control("El informe publica los siete hallazgos", len(tarjetas) == 7, f"encontrados {len(tarjetas)}")

    sin_n = [
        hid for hid, c in tarjetas
        if "n = " not in c and "No medido en esta edición" not in c
    ]
    r.control("Toda estadística publicada muestra su n", not sin_n, f"sin n visible: {sin_n}")

    faltan_denominador = [
        clave for clave, e in edicion["estadisticas"].items()
        if not e.get("denominador") or e.get("n") is None
    ]
    r.control(
        "Ninguna estadística se emite sin n y sin denominador",
        not faltan_denominador,
        str(faltan_denominador[:5]),
    )

    f = edicion["ficha_tecnica"]
    r.control(
        "Los dos denominadores aparecen explícitos en el informe",
        str(f["n_medidos"]) in agregado and str(f["n_respondio"]) in agregado,
        f"medidos {f['n_medidos']} · respondieron {f['n_respondio']}",
    )


def revisar_color(r: Revision, documentos: dict[str, str]) -> None:
    sucios: list[str] = []
    for nombre, html in documentos.items():
        hits = COLOR_LITERAL.findall(cuerpo(html))
        if hits:
            sucios.append(f"{nombre}: {sorted(set(hits))[:4]}")
    r.control(
        "Ningún color escrito a mano fuera de marca.json",
        not sucios,
        "\n      ".join(sucios),
    )

    fuentes = list((RAIZ / "plantillas").glob("*.html")) + [RAIZ / "plantillas" / "estilo.css"]
    en_plantillas = [
        f"{f.name}: {sorted(set(COLOR_LITERAL.findall(f.read_text(encoding='utf-8'))))[:4]}"
        for f in fuentes if COLOR_LITERAL.findall(f.read_text(encoding="utf-8"))
    ]
    r.control(
        "Ninguna plantilla trae colores literales",
        not en_plantillas,
        "\n      ".join(en_plantillas),
    )

    marca = json.load(open(RAIZ / "marca.json", encoding="utf-8"))
    for nombre, html in documentos.items():
        r.control(
            f"La marca de {nombre} sale de marca.json",
            marca["nombre"] in html,
            f"no aparece «{marca['nombre']}»",
        )
        break


def revisar_consistencia(r: Revision, agregado: str, auditorias: dict[str, str]) -> None:
    en_agregado = dict(
        re.findall(r'data-stat="bloque\.(\w+)\.mediana" data-valor="([^"]+)"', agregado)
    )
    r.control(
        "El informe publica la mediana de cada bloque",
        bool(en_agregado),
        "no hay ninguna mediana estampada en el agregado",
    )

    discrepancias: list[str] = []
    for cid, html in auditorias.items():
        dibujadas = dict(
            re.findall(r'data-stat="bloque\.(\w+)\.mediana"[^>]*?data-mediana="([^"]+)"', html)
        )
        for bloque, valor in dibujadas.items():
            publicado = en_agregado.get(bloque)
            if publicado != valor:
                discrepancias.append(
                    f"{cid}/{bloque}: la auditoría dibuja {valor}, el informe publica {publicado}"
                )
    r.control(
        "La mediana de cada bloque es idéntica en los dos documentos",
        not discrepancias,
        "\n      ".join(discrepancias[:5]),
    )


def revisar_no_inventado(r: Revision, agregado: str, edicion: dict) -> None:
    texto = _sin_etiquetas(cuerpo(agregado)).lower()
    for palabra in ("estimad", "aproximad", "extrapolad", "proyectad"):
        r.control(
            f"El informe no dice «{palabra}…»",
            palabra not in texto,
            "una cifra no publicable no se estima: se declara no medida",
        )

    no_publicables = [k for k, e in edicion["estadisticas"].items() if not e["publicable"]]
    if no_publicables:
        r.control(
            "Los hallazgos no publicables dicen «no medido»",
            "No medido en esta edición" in agregado,
            f"{len(no_publicables)} estadísticas no publicables y ningún aviso en el documento",
        )

    for corte, v in edicion["cortes"].items():
        if not v["publicable"]:
            r.aviso(f"corte «{corte}» no se publica: {v['motivo']}")


def revisar_estampa(r: Revision, documentos: dict[str, str], edicion: dict) -> None:
    for nombre, html in documentos.items():
        faltan = [
            campo for campo, valor in (
                ("edicion_id", edicion["edicion_id"]),
                ("version_formula", edicion["version_formula"]),
                ("fecha_calculo", edicion["fecha_calculo"]),
            ) if valor not in html
        ]
        r.control(f"{nombre} lleva su estampa completa", not faltan, f"faltan {faltan}")
        r.control(f"{nombre} lleva la huella de las entradas", "huella de entradas" in html)


def revisar_datos_sinteticos(r: Revision, documentos: dict[str, str], edicion: dict) -> None:
    if not edicion["ficha_tecnica"].get("datos_sinteticos"):
        return
    sin_aviso = [n for n, h in documentos.items() if "DATOS SINTÉTICOS" not in h]
    r.control(
        "Una edición con datos sintéticos lo declara en todos sus documentos",
        not sin_aviso,
        f"sin el aviso: {sin_aviso}",
    )


# ═══════════════════════════════════════════════════════════════════════════

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Revisión de cumplimiento antes de publicar.")
    ap.add_argument("--edicion", required=True)
    ap.add_argument("--salida", default="./build")
    ap.add_argument("--auditorias", type=int, default=8,
                    help="Cuántas auditorías revisar (0 = todas)")
    args = ap.parse_args(argv)

    salida = Path(args.salida)
    ruta_edicion = salida / f"edicion_{args.edicion}.json"
    ruta_agregado = salida / "informe-agregado.html"
    for ruta in (ruta_edicion, ruta_agregado):
        if not ruta.exists():
            print(f"Falta {ruta}. Corre calcular.py y los renderizadores primero.", file=sys.stderr)
            return 2

    edicion = json.load(open(ruta_edicion, encoding="utf-8"))
    agregado = ruta_agregado.read_text(encoding="utf-8")

    rutas_aud = sorted((salida / "auditorias").glob("*.html"))
    if args.auditorias:
        rutas_aud = rutas_aud[: args.auditorias]
    auditorias = {p.stem: p.read_text(encoding="utf-8") for p in rutas_aud}
    reportes = [
        json.load(open(p, encoding="utf-8"))
        for p in sorted((salida / "reportes").glob("*.json"))
    ]

    documentos = {"informe-agregado": agregado}
    documentos.update({f"auditoria {k}": v for k, v in auditorias.items()})

    r = Revision()
    revisar_anonimato(r, agregado, reportes)
    revisar_proyeccion(r, documentos)
    revisar_segunda_persona(r, agregado)
    revisar_n_visible(r, agregado, edicion)
    revisar_color(r, documentos)
    revisar_consistencia(r, agregado, auditorias)
    revisar_no_inventado(r, agregado, edicion)
    revisar_estampa(r, documentos, edicion)
    revisar_datos_sinteticos(r, documentos, edicion)

    print(f"\nRevisión de cumplimiento · edición {args.edicion} · fórmula {edicion['version_formula']}")
    print(f"  {len(documentos)} documentos · {len(reportes)} reportes · {r.controles} controles")
    if r.avisos:
        print("\n  avisos (no bloquean):")
        for a in r.avisos:
            print(f"    · {a}")
    if r.fallos:
        print(f"\n  {len(r.fallos)} CONTROL(ES) FALLIDO(S):")
        for nombre, detalle in r.fallos:
            print(f"    ✗ {nombre}")
            if detalle:
                print(f"      {detalle}")
        print("\n  NO PUBLICAR hasta corregir.\n")
        return 1

    print(f"\n  {r.controles} controles pasan. Listo para publicar.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
