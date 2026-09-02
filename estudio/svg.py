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

from html import escape
from typing import Iterable, Sequence


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
