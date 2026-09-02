"""
Relleno de plantillas. Compartido por los dos renderizadores.

Una plantilla es HTML con huecos `{{clave}}` y nada más: ni bucles ni
condicionales ni aritmética. Lo que se repite —los cinco bloques, las filas de
una tabla— lo arma el renderizador con una plantilla parcial y lo inyecta ya
hecho.

Un hueco sin valor **revienta**. Un documento que se va a imprenta no puede
llevar un espacio en blanco donde debía ir una cifra, y un `.get(clave, "")`
silencioso es exactamente cómo eso ocurre.
"""

from __future__ import annotations

import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
HUECO = re.compile(r"\{\{(\w+)\}\}")


class HuecoSinValor(KeyError):
    """La plantilla pide un hueco que el renderizador no llenó."""


def cargar(nombre: str) -> str:
    return (RAIZ / "plantillas" / nombre).read_text(encoding="utf-8")


def rellenar(plantilla: str, valores: dict[str, object], *, origen: str = "plantilla") -> str:
    faltantes: list[str] = []

    def sub(m: re.Match) -> str:
        clave = m.group(1)
        if clave not in valores:
            faltantes.append(clave)
            return ""
        v = valores[clave]
        return "" if v is None else str(v)

    salida = HUECO.sub(sub, plantilla)
    if faltantes:
        raise HuecoSinValor(
            f"{origen}: huecos sin valor: {', '.join(sorted(set(faltantes)))}. "
            f"Si el dato no se midió, pasa el texto «no medido», no una cadena vacía."
        )
    return salida


def sobran(plantilla: str, valores: dict[str, object]) -> set[str]:
    """Valores que nadie usa. Señal de que la plantilla y el renderizador se separaron."""
    return set(valores) - set(HUECO.findall(plantilla))
