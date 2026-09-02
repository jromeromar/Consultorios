"""
Geometría de los gráficos. Compartida por los dos renderizadores y probada.

Existe para que **ninguna plantilla convierta un valor en una coordenada**. Las
plantillas reciben cadenas SVG terminadas; toda la aritmética de posición vive
aquí, en un solo lugar, de modo que la misma cifra se dibuja igual en el informe
agregado y en la auditoría individual.

Ningún color literal: todo va por `var(--token)`, que `estilo.py` define desde
marca.json.
"""

from __future__ import annotations

import math
from html import escape
from typing import Sequence


def _n(v: float) -> str:
    """Un decimal fijo: la salida tiene que ser idéntica entre corridas."""
    return f"{v:.1f}".rstrip("0").rstrip(".") if v == v else "0"


def _texto(x: float, y: float, s: str, *, tam: float = 11, peso: int = 500,
           ancla: str = "middle", token: str = "muted", espaciado: str | None = None) -> str:
    esp = f' letter-spacing="{espaciado}"' if espaciado else ""
    return (
        f'<text x="{_n(x)}" y="{_n(y)}" fill="var(--{token})" font-size="{tam}" '
        f'font-weight="{peso}" text-anchor="{ancla}"{esp}>{escape(s)}</text>'
    )


def _linea(x1: float, y1: float, x2: float, y2: float, *, token: str = "hair",
           grosor: float = 1) -> str:
    return (
        f'<line x1="{_n(x1)}" y1="{_n(y1)}" x2="{_n(x2)}" y2="{_n(y2)}" '
        f'stroke="var(--{token})" stroke-width="{grosor}"/>'
    )


# ═══════════════════════════════════════════════════════════════════════════
# Curva de distribución con la marca de un consultorio
# ═══════════════════════════════════════════════════════════════════════════

def curva_distribucion(
    curva: Sequence[dict],
    *,
    mediana: float | None,
    top10: float | None,
    puntaje: float | None,
    etiqueta_puntaje: str = "Este consultorio",
    ancho: float = 620,
    alto: float = 190,
    estampa: str | None = None,
) -> str:
    """
    La curva es la distribución de puntajes de la muestra. La marca vertical es
    este consultorio y el área sombreada es la distancia hasta la mediana.

    `mediana` y `top10` llegan como argumentos y **no se leen de la curva**: son
    los percentiles que el informe agregado publica. Si se derivaran de la
    curva, la suavización los movería y los dos documentos dejarían de decir lo
    mismo.
    """
    # Las cifras dibujadas se estampan en el SVG. Es lo que permite que la
    # prueba de consistencia compare los dos HTML generados, y no el JSON contra
    # sí mismo, que sería una tautología.
    datos = (
        f' data-stat="{estampa}"' if estampa else ""
    ) + "".join(
        # Valor exacto, no el redondeado que usa el dibujo: la prueba de
        # consistencia compara igualdad, no aproximación.
        f' data-{k}="{v}"' for k, v in
        (("mediana", mediana), ("top10", top10), ("puntaje", puntaje)) if v is not None
    )

    if not curva:
        return _sin_dato(ancho, alto, "Sin muestra suficiente para dibujar la distribución", datos)

    izq, der, arriba, abajo = 8, 8, 34, 30
    ancho_plot = ancho - izq - der
    alto_plot = alto - arriba - abajo

    def X(v: float) -> float:
        return izq + (max(0.0, min(100.0, v)) / 100) * ancho_plot

    def Y(d: float) -> float:
        return arriba + alto_plot - d * alto_plot * 0.94

    trazo = "".join(
        f'{"M" if i == 0 else "L"}{_n(X(p["x"]))} {_n(Y(p["d"]))} '
        for i, p in enumerate(curva)
    )
    area = trazo + f'L{_n(X(100))} {_n(arriba + alto_plot)} L{_n(X(0))} {_n(arriba + alto_plot)} Z'

    partes = [
        f'<svg viewBox="0 0 {_n(ancho)} {_n(alto)}" width="100%" height="{_n(alto)}" '
        f'role="img" aria-label="{escape(_aria(puntaje, mediana))}"{datos}>',
        _linea(izq, arriba + alto_plot, ancho - der, arriba + alto_plot, token="hair-strong"),
    ]

    # Área de la distancia hasta la mediana: se dibuja debajo de la curva.
    if puntaje is not None and mediana is not None:
        bajo, alto_ = sorted((puntaje, mediana))
        tramo = [p for p in curva if bajo <= p["x"] <= alto_]
        if tramo:
            d = "".join(
                f'{"M" if i == 0 else "L"}{_n(X(p["x"]))} {_n(Y(p["d"]))} '
                for i, p in enumerate(tramo)
            )
            d += f'L{_n(X(alto_))} {_n(arriba + alto_plot)} L{_n(X(bajo))} {_n(arriba + alto_plot)} Z'
            partes.append(f'<path d="{d}" fill="var(--gap-fill)"/>')

    partes.append(f'<path d="{area}" fill="var(--curve-fill)"/>')
    partes.append(
        f'<path d="{trazo}" fill="none" stroke="var(--curve-line)" stroke-width="1.5" '
        f'stroke-linejoin="round"/>'
    )

    for valor, etiqueta, peso in ((mediana, "mediana", 600), (top10, "décimo superior", 500)):
        if valor is None:
            continue
        partes.append(_linea(X(valor), arriba, X(valor), arriba + alto_plot, token="hair-strong"))
        partes.append(_texto(X(valor), arriba + alto_plot + 16, etiqueta, tam=10.5, peso=peso,
                             espaciado=".04em"))

    if puntaje is not None:
        px = X(puntaje)
        partes.append(_linea(px, arriba - 8, px, arriba + alto_plot, token="accent", grosor=2))
        partes.append(
            f'<circle cx="{_n(px)}" cy="{_n(arriba + alto_plot)}" r="5.5" fill="var(--accent)" '
            f'stroke="var(--surface)" stroke-width="2"/>'
        )
        ancla, lx = "middle", px
        if px < 70:
            ancla, lx = "start", px - 6
        elif px > ancho - 70:
            ancla, lx = "end", px + 6
        partes.append(_texto(lx, arriba - 15, f"{etiqueta_puntaje} · {int(round(puntaje))}",
                             tam=12.5, peso=700, ancla=ancla, token="accent"))
    else:
        partes.append(_texto(ancho / 2, arriba + alto_plot / 2, "No medido en esta edición",
                             tam=12.5, peso=600, token="muted"))

    partes.append("</svg>")
    return "".join(partes)


def _aria(puntaje: float | None, mediana: float | None) -> str:
    if puntaje is None:
        return "Distribución de puntajes de la muestra. Este bloque no se midió para este consultorio."
    m = "" if mediana is None else f" La mediana de la muestra es {int(round(mediana))}."
    return (
        f"Distribución de puntajes de la muestra. Este consultorio obtuvo "
        f"{int(round(puntaje))} puntos.{m}"
    )


def _sin_dato(ancho: float, alto: float, mensaje: str) -> str:
    return (
        f'<svg viewBox="0 0 {_n(ancho)} {_n(alto)}" width="100%" height="{_n(alto)}" role="img" '
        f'aria-label="{escape(mensaje)}">'
        f'<rect x="0.5" y="0.5" width="{_n(ancho - 1)}" height="{_n(alto - 1)}" fill="none" '
        f'stroke="var(--hair)" stroke-dasharray="4 4"/>'
        + _texto(ancho / 2, alto / 2 + 4, mensaje, tam=12.5, peso=600, token="muted")
        + "</svg>"
    )


# ═══════════════════════════════════════════════════════════════════════════
# Tira de los cinco bloques sobre un mismo eje de percentil
# ═══════════════════════════════════════════════════════════════════════════

def tira_percentiles(filas: Sequence[dict], *, ancho: float = 560) -> str:
    """
    Un renglón por bloque, todos sobre el mismo eje de percentil, para que se
    vean comparables de un vistazo.

    Cada fila: {paso, nombre, percentil, token_color, texto}. Un percentil nulo
    imprime «no medido» en lugar de un punto en el cero.
    """
    alto_fila, arriba, abajo = 30, 8, 22
    ancho_etiqueta, ancho_valor = 158, 40
    alto = arriba + alto_fila * len(filas) + abajo
    izq = ancho_etiqueta + 12
    ancho_pista = ancho - izq - ancho_valor - 8

    def X(p: float) -> float:
        return izq + (max(0.0, min(100.0, p)) / 100) * ancho_pista

    partes = [
        f'<svg viewBox="0 0 {_n(ancho)} {_n(alto)}" width="100%" height="{_n(alto)}" '
        f'role="img" aria-label="Percentil de este consultorio en los cinco bloques">'
    ]
    for i, f in enumerate(filas):
        y = arriba + alto_fila * i + alto_fila / 2
        if i:
            partes.append(_linea(izq, y - alto_fila / 2, ancho - 8, y - alto_fila / 2))
        partes.append(_texto(0, y - 4, f"PASO {f['paso']}", tam=9.5, peso=600, ancla="start",
                             token="muted", espaciado=".09em"))
        partes.append(_texto(0, y + 9, f["nombre"], tam=13, peso=500, ancla="start", token="ink"))
        partes.append(_linea(izq, y, izq + ancho_pista, y, token="hair-strong"))
        partes.append(_linea(X(50), y - 7, X(50), y + 7, token="muted"))

        if f.get("percentil") is None:
            partes.append(_texto(izq + ancho_pista / 2, y + 4, "no medido en esta edición",
                                 tam=10.5, peso=600, token="muted"))
            partes.append(_texto(ancho - 8, y + 4, "—", tam=13, peso=600, ancla="end", token="muted"))
            continue

        p = float(f["percentil"])
        partes.append(
            f'<circle cx="{_n(X(p))}" cy="{_n(y)}" r="7" fill="var(--{f["token_color"]})" '
            f'stroke="var(--surface)" stroke-width="2"/>'
        )
        partes.append(_texto(ancho - 8, y + 5, str(int(round(p))), tam=15, peso=600, ancla="end",
                             token="ink"))

    base = arriba + alto_fila * len(filas)
    for p, etiqueta, ancla in ((0, "percentil 0", "start"), (50, "50", "middle"), (100, "100", "end")):
        partes.append(_texto(X(p), base + 15, etiqueta, tam=10, peso=600, ancla=ancla,
                             espaciado=".06em"))
    partes.append("</svg>")
    return "".join(partes)


# ═══════════════════════════════════════════════════════════════════════════
# Formas del informe agregado
# ═══════════════════════════════════════════════════════════════════════════
#
# Una serie, un color. La longitud de la barra ya codifica la magnitud, así que
# el color no vuelve a decirlo: no hay rampas por valor sobre categorías. Marcas
# finas, rejilla de un pelo, y etiqueta directa donde informa.

def _rejilla(izq: float, der: float, arriba: float, alto_plot: float, maximo: float,
            *, sufijo: str = "", pasos: int = 5) -> tuple[str, float]:
    partes = []
    for i in range(pasos + 1):
        y = arriba + alto_plot - (i / pasos) * alto_plot
        partes.append(_linea(izq, y, der, y, token="hair" if i else "hair-strong"))
        valor = maximo * i / pasos
        etiqueta = f"{valor:.0f}{sufijo}"
        partes.append(_texto(izq - 8, y + 3.5, etiqueta, tam=10.5, ancla="end"))
    return "".join(partes), alto_plot


def _techo(maximo: float, redondeo: float = 5) -> float:
    if maximo <= 0:
        return redondeo
    return math.ceil(maximo / redondeo) * redondeo


def barras(datos: Sequence[dict], *, unidad: str, ancho: float = 660,
           estampa: str | None = None) -> str:
    """
    Barras verticales para una distribución por categorías.

    Una categoría marcada `alterno` —«Sin respuesta»— se dibuja hueca: no es una
    segunda serie, es una categoría de otra naturaleza, y el contorno lo dice sin
    gastar un color de serie.
    """
    if not datos:
        return _sin_dato(ancho, 240, "No medido en esta edición")

    alto, arriba, abajo, izq, der = 268, 22, 74, 38, 10
    ancho_plot, alto_plot = ancho - izq - der, alto - arriba - abajo
    maximo = _techo(max(d["n"] for d in datos))
    ranura = ancho_plot / len(datos)
    ancho_barra = min(58.0, ranura - 16)

    partes = [
        f'<svg viewBox="0 0 {_n(ancho)} {_n(alto)}" width="100%" height="{_n(alto)}" role="img" '
        f'aria-label="{escape(unidad)}"' + (f' data-stat="{estampa}"' if estampa else "") + ">",
    ]
    rejilla, _ = _rejilla(izq, ancho - der, arriba, alto_plot, maximo)
    partes.append(rejilla)

    for i, d in enumerate(datos):
        x = izq + ranura * i + (ranura - ancho_barra) / 2
        h = (d["n"] / maximo) * alto_plot if maximo else 0
        y = arriba + alto_plot - h
        hueca = d.get("alterno")
        relleno = "none" if hueca else "var(--serie-1)"
        borde = ' stroke="var(--serie-1)" stroke-width="1.5" stroke-dasharray="3 3"' if hueca else ""
        partes.append(
            f'<rect x="{_n(x)}" y="{_n(y)}" width="{_n(ancho_barra)}" '
            f'height="{_n(max(2.0, h))}" rx="4" fill="{relleno}"{borde}/>'
        )
        partes.append(_texto(x + ancho_barra / 2, y - 8, str(d["n"]), tam=13, peso=700, token="ink"))
        for k, linea in enumerate(_partir(d["etiqueta"], 13)):
            partes.append(_texto(x + ancho_barra / 2, arriba + alto_plot + 18 + k * 13,
                                 linea, tam=11, token="ink-2"))

    partes.append(_texto(izq, alto - 8, unidad, tam=10.5, ancla="start", espaciado=".05em"))
    partes.append("</svg>")
    return "".join(partes)


def linea(datos: Sequence[dict], *, unidad: str, destacar: str | None = None,
          ancho: float = 660, estampa: str | None = None) -> str:
    """
    Línea para una secuencia ordenada. Se etiquetan los extremos y el punto
    destacado, que es el que sostiene el hallazgo; el resto lo lleva la tabla.
    """
    if not datos:
        return _sin_dato(ancho, 240, "No medido en esta edición")

    alto, arriba, abajo, izq, der = 246, 30, 56, 44, 40
    ancho_plot, alto_plot = ancho - izq - der, alto - arriba - abajo
    maximo = _techo(max(d["valor"] for d in datos), 10)
    paso = ancho_plot / max(1, len(datos) - 1)

    def X(i: int) -> float:
        return izq + paso * i

    def Y(v: float) -> float:
        return arriba + alto_plot - (v / maximo) * alto_plot

    partes = [
        f'<svg viewBox="0 0 {_n(ancho)} {_n(alto)}" width="100%" height="{_n(alto)}" role="img" '
        f'aria-label="{escape(unidad)}"' + (f' data-stat="{estampa}"' if estampa else "") + ">",
    ]
    rejilla, _ = _rejilla(izq, ancho - der, arriba, alto_plot, maximo, sufijo=" %")
    partes.append(rejilla)

    trazo = "".join(
        f'{"M" if i == 0 else "L"}{_n(X(i))} {_n(Y(d["valor"]))} ' for i, d in enumerate(datos)
    )
    partes.append(
        trazo and f'<path d="{trazo}L{_n(X(len(datos) - 1))} {_n(arriba + alto_plot)} '
                  f'L{_n(X(0))} {_n(arriba + alto_plot)} Z" fill="var(--curve-fill)"/>'
    )
    partes.append(f'<path d="{trazo}" fill="none" stroke="var(--serie-1)" stroke-width="2" '
                  f'stroke-linejoin="round"/>')

    for i, d in enumerate(datos):
        es_clave = d["etiqueta"] == destacar or i in (0, len(datos) - 1)
        r = 6 if d["etiqueta"] == destacar else 4.5
        partes.append(
            f'<circle cx="{_n(X(i))}" cy="{_n(Y(d["valor"]))}" r="{r}" fill="var(--serie-1)" '
            f'stroke="var(--surface)" stroke-width="2"/>'
        )
        if es_clave:
            abajo_ = d["etiqueta"] == destacar
            partes.append(_texto(X(i), Y(d["valor"]) + (22 if abajo_ else -13), d["texto"],
                                 tam=12.5, peso=700, token="ink",
                                 ancla="start" if i == 0 else ("end" if i == len(datos) - 1 else "middle")))
        partes.append(_texto(X(i), arriba + alto_plot + 20, d["etiqueta"], tam=11, token="ink-2",
                             ancla="start" if i == 0 else ("end" if i == len(datos) - 1 else "middle")))

    partes.append(_texto(izq, alto - 8, unidad, tam=10.5, ancla="start", espaciado=".05em"))
    partes.append("</svg>")
    return "".join(partes)


def barras_grupo(datos: Sequence[dict], *, unidad: str, ancho: float = 660,
                 estampa: str | None = None) -> str:
    """Barras horizontales para comparar pocos grupos. Etiqueta directa al final."""
    if not datos:
        return _sin_dato(ancho, 160, "No medido en esta edición")

    alto_fila, arriba, abajo, izq = 62, 10, 30, 8
    alto = arriba + alto_fila * len(datos) + abajo
    ancho_etiqueta = min(260.0, ancho * 0.40)
    inicio = izq + ancho_etiqueta + 14
    ancho_pista = ancho - inicio - 74
    maximo = _techo(max(d["valor"] for d in datos), 10)

    partes = [
        f'<svg viewBox="0 0 {_n(ancho)} {_n(alto)}" width="100%" height="{_n(alto)}" role="img" '
        f'aria-label="{escape(unidad)}"' + (f' data-stat="{estampa}"' if estampa else "") + ">",
    ]
    for i, d in enumerate(datos):
        y = arriba + alto_fila * i
        if i:
            partes.append(_linea(izq, y - 6, ancho - 8, y - 6))
        for k, l in enumerate(_partir(d["etiqueta"], 30)):
            partes.append(_texto(izq, y + 22 + k * 15, l, tam=12.5, peso=600, ancla="start",
                                 token="ink"))
        largo = (d["valor"] / maximo) * ancho_pista if maximo else 0
        partes.append(
            f'<rect x="{_n(inicio)}" y="{_n(y + 14)}" width="{_n(max(2.0, largo))}" height="18" '
            f'rx="4" fill="var(--serie-1)"/>'
        )
        partes.append(_texto(inicio + largo + 9, y + 28, d["texto"], tam=12.5, peso=600,
                             ancla="start", token="ink"))
        if d.get("nota"):
            partes.append(_texto(inicio, y + 48, d["nota"], tam=10.5, ancla="start"))
    partes.append(_texto(izq, alto - 8, unidad, tam=10.5, ancla="start", espaciado=".05em"))
    partes.append("</svg>")
    return "".join(partes)


def dispersion(puntos: Sequence[dict], *, unidad: str, eje_y: str, rho_texto: str,
               mediana_y: float | None, ancho: float = 660, estampa: str | None = None) -> str:
    """
    Nube para el contra-hallazgo.

    NO se ajusta una recta. Una recta de pendiente casi nula sobre una nube sin
    relación sugiere una tendencia que no existe; la referencia honesta es la
    mediana del eje Y, que muestra que la nube no se inclina.
    """
    if not puntos:
        return _sin_dato(ancho, 280, "No medido en esta edición")

    alto, arriba, abajo, izq, der = 300, 26, 56, 46, 14
    ancho_plot, alto_plot = ancho - izq - der, alto - arriba - abajo
    max_x = _techo(max(p["x"] for p in puntos), 240)
    max_y = _techo(max(p["y"] for p in puntos), 10)

    def X(v: float) -> float:
        return izq + (min(v, max_x) / max_x) * ancho_plot

    def Y(v: float) -> float:
        return arriba + alto_plot - (min(v, max_y) / max_y) * alto_plot

    partes = [
        f'<svg viewBox="0 0 {_n(ancho)} {_n(alto)}" width="100%" height="{_n(alto)}" role="img" '
        f'aria-label="{escape(unidad)}"' + (f' data-stat="{estampa}"' if estampa else "") + ">",
    ]
    rejilla, _ = _rejilla(izq, ancho - der, arriba, alto_plot, max_y)
    partes.append(rejilla)

    horas = max(1, int(max_x // 240))
    for i in range(horas + 1):
        x = X(i * 240)
        partes.append(_texto(x, arriba + alto_plot + 18, f"{i * 4} h", tam=10.5))

    if mediana_y is not None:
        partes.append(_linea(izq, Y(mediana_y), ancho - der, Y(mediana_y), token="muted", grosor=2))
        partes.append(_texto(ancho - der - 6, Y(mediana_y) - 8, f"mediana · {mediana_y:.0f}",
                             tam=11, peso=600, ancla="end"))

    for p in puntos:
        partes.append(
            f'<circle cx="{_n(X(p["x"]))}" cy="{_n(Y(p["y"]))}" r="4.5" fill="var(--serie-1)" '
            f'fill-opacity="0.5" stroke="var(--surface)" stroke-width="1.5"/>'
        )

    partes.append(_texto(izq - 34, arriba - 9, eje_y, tam=10.5, ancla="start"))
    partes.append(_texto(ancho - der, alto - 8, rho_texto, tam=11, peso=600, ancla="end", token="ink-2"))
    partes.append(_texto(izq, alto - 8, unidad, tam=10.5, ancla="start", espaciado=".05em"))
    partes.append("</svg>")
    return "".join(partes)


def _partir(texto_: str, ancho_max: int) -> list[str]:
    """Parte una etiqueta en líneas sin cortar palabras. Una etiqueta recortada es un error."""
    palabras, lineas, actual = texto_.split(), [], ""
    for w in palabras:
        if actual and len(actual) + 1 + len(w) > ancho_max:
            lineas.append(actual)
            actual = w
        else:
            actual = f"{actual} {w}".strip()
    if actual:
        lineas.append(actual)
    return lineas[:3]
