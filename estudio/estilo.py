"""
Convierte marca.json en el CSS del documento.

La identidad no está decidida. Todo lo de marca —nombre, colores, tipografías,
logo— vive únicamente en marca.json, y este módulo lo traduce a variables CSS y
a `@font-face` con las tipografías copiadas al repositorio.

Ningún color ni tipografía se escribe a mano en una plantilla: `cumplimiento.py`
falla si encuentra un literal de color fuera del bloque que genera este archivo.
Cuando la identidad se apruebe, cambiar marca.json tiene que bastar.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent


def cargar_marca(ruta: Path | None = None) -> dict:
    return json.load(open(ruta or RAIZ / "marca.json", encoding="utf-8"))


def _fuentes(marca: dict, incrustar: bool) -> str:
    """
    `@font-face` de las tipografías locales. Con `incrustar`, los woff2 van en
    data: URI para que el HTML sea un solo archivo — necesario para que el PDF
    salga idéntico sin depender de rutas relativas.
    """
    reglas = []
    for rol in ("titulos", "prosa"):
        tipo = marca["tipografia"][rol]
        for archivo in tipo["archivos"]:
            ruta = RAIZ / "plantillas" / archivo["ruta"]
            if incrustar and ruta.exists():
                datos = base64.b64encode(ruta.read_bytes()).decode("ascii")
                src = f"url(data:font/woff2;base64,{datos}) format('woff2')"
            else:
                src = f"url('{archivo['ruta']}') format('woff2')"
            reglas.append(
                "@font-face{"
                f"font-family:'{tipo['familia']}';"
                f"font-style:{archivo['estilo']};"
                f"font-weight:{archivo['rango_pesos']};"
                "font-display:block;"
                f"src:{src};"
                "}"
            )
    return "\n".join(reglas)


def _tokens(paleta: dict) -> str:
    return "".join(f"--{k}:{v};" for k, v in sorted(paleta.items()))


def css(marca: dict, *, incrustar_fuentes: bool = True, solo_claro: bool = False) -> str:
    """
    El bloque de estilo completo: tipografías, tokens de color en claro y
    oscuro, y la hoja de maquetación, que solo usa `var(--token)`.

    `solo_claro` es para el PDF: el impreso no tiene modo oscuro y heredar el del
    sistema produciría una hoja negra.
    """
    claro = marca["color"]["claro"]
    oscuro = marca["color"]["oscuro"]
    familia_titulos = f"'{marca['tipografia']['titulos']['familia']}',{marca['tipografia']['titulos']['respaldo']}"
    familia_prosa = f"'{marca['tipografia']['prosa']['familia']}',{marca['tipografia']['prosa']['respaldo']}"

    partes = [
        _fuentes(marca, incrustar_fuentes),
        ":root{color-scheme:light;"
        f"--familia-titulos:{familia_titulos};"
        f"--familia-prosa:{familia_prosa};"
        + _tokens(claro) + "}",
    ]
    if not solo_claro:
        partes.append(
            "@media (prefers-color-scheme:dark){"
            ':root:not([data-theme="light"]){color-scheme:dark;' + _tokens(oscuro) + "}}"
        )
        partes.append(':root[data-theme="dark"]{color-scheme:dark;' + _tokens(oscuro) + "}")

    partes.append((RAIZ / "plantillas" / "estilo.css").read_text(encoding="utf-8"))
    return "\n".join(partes)


AVISO_SINTETICOS = (
    "DATOS SINTÉTICOS DE PRUEBA",
    "Ninguna cifra de este documento proviene de una medición real. Sirve para "
    "decidir la forma del reporte, no su contenido.",
)


def meta_robots(*, datos_sinteticos: bool) -> str:
    """
    Un documento con cifras inventadas no se indexa.

    El cintillo avisa a quien lo abre; esto evita que un buscador lo sirva como
    si fuera investigación de mercado a alguien que nunca vio la portada. Va
    aquí y no en el despliegue porque depende de la edición: una edición de
    campo se publica para ser encontrada.
    """
    return '<meta name="robots" content="noindex,nofollow">' if datos_sinteticos else ''


def cintillo(marca: dict, *, datos_sinteticos: bool = False) -> str:
    """
    Cintillo del documento. Se apaga poniendo `cintillo_provisional` en null.

    El aviso de datos sintéticos NO depende de marca.json: lo decide la edición.
    Si los datos no son de campo, el documento lo dice en la cabecera, porque un
    reporte con cifras inventadas que no se anuncia como tal puede leerse como
    una medición de un consultorio real.
    """
    from html import escape

    partes = []
    if datos_sinteticos:
        titulo, detalle = AVISO_SINTETICOS
        partes.append(
            '<div class="cintillo cintillo-datos">' + escape(titulo)
            + f'<span>{escape(detalle)}</span></div>'
        )
    c = marca.get("cintillo_provisional")
    if c:
        partes.append(
            '<div class="cintillo">' + escape(c["titulo"])
            + f'<span>{escape(c["detalle"])}</span></div>'
        )
    return "".join(partes)


def marca_visible(marca: dict) -> str:
    """El hueco de la marca: recuadro punteado mientras no haya logo aprobado."""
    from html import escape
    logo = marca.get("logo", {})
    if logo.get("tipo") == "archivo" and logo.get("ruta"):
        return f'<img class="logo" src="{escape(logo["ruta"])}" alt="{escape(marca["nombre"])}">'
    return f'<div class="marca-hueco"><b></b>{escape(marca["nombre"])}</div>'
