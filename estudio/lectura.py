"""
Los dos lectores del sistema.

El encargo pide que el renderizador del informe público **no tenga forma de
acceder a un nombre propio aunque quiera**. Eso no se consigue con una
convención ni con una revisión: se consigue con ausencia.

  leer_anonimo(edicion)                -> solo build/edicion_*.json
  leer_identificado(edicion, cons_id)  -> además build/reportes/{id}.json

`render_agregado.py` importa únicamente el primero. El JSON de edición no
contiene ningún campo identificable porque `calcular.py` no lo escribe ahí, y si
una plantilla del agregado pide uno, revienta con un mensaje que explica la
regla en vez de devolver vacío.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# Campos del censo que identifican a un consultorio o a una persona. Ninguno
# entra al JSON de edición ni, por tanto, al informe agregado.
CAMPOS_IDENTIFICABLES = frozenset({
    "nombre_comercial", "nombre_normalizado", "nombre_resultado_crudo",
    "direccion", "codigo_postal", "latitud", "longitud", "plus_code", "h3",
    "telefono_e164", "telefono_original", "telefono_contacto_e164",
    "dominio", "sitio_web_url", "instagram_handle", "facebook_url", "handle",
    "destino_usado", "cid", "place_id", "google_id", "kgmid",
    "nombre_completo", "email", "perfil_linkedin", "perfil_instagram",
    "nombre_consultorio", "consultorio_id",
})


class MapaAnonimo(dict):
    """
    Diccionario que revienta en voz alta si alguien pide un campo identificable.

    Un KeyError silencioso se puede confundir con «ese dato no se midió». Este
    dice qué regla se está rompiendo y cuál es el lector correcto.
    """

    def __missing__(self, clave: str) -> Any:
        if clave in CAMPOS_IDENTIFICABLES:
            raise PermisoAnonimato(
                f"El lector anónimo no expone «{clave}»: el informe agregado se "
                f"publica sin nombres propios. Si el dato hace falta para una "
                f"auditoría individual, úsalo desde leer_identificado()."
            )
        raise KeyError(clave)


class PermisoAnonimato(Exception):
    """Se intentó leer un campo identificable desde el carril anónimo."""


def _anonimizar(valor: Any) -> Any:
    if isinstance(valor, dict):
        return MapaAnonimo({k: _anonimizar(v) for k, v in valor.items()})
    if isinstance(valor, list):
        return [_anonimizar(v) for v in valor]
    return valor


def ruta_edicion(edicion: str, salida: Path | str = "build") -> Path:
    return Path(salida) / f"edicion_{edicion}.json"


def leer_anonimo(edicion: str, salida: Path | str = "build") -> MapaAnonimo:
    """El JSON de edición, envuelto para que un campo identificable reviente."""
    ruta = ruta_edicion(edicion, salida)
    if not ruta.exists():
        raise FileNotFoundError(
            f"No existe {ruta}. Corre primero: python3 calcular.py --edicion {edicion}"
        )
    with open(ruta, encoding="utf-8") as f:
        return _anonimizar(json.load(f))


def leer_identificado(
    edicion: str, consultorio_id: str, salida: Path | str = "build"
) -> tuple[dict, dict]:
    """
    La edición sin envolver más el reporte del consultorio.

    Solo `render_auditoria.py` debe llamar a esto, y su salida solo se entrega al
    consultorio medido.
    """
    ruta_ed = ruta_edicion(edicion, salida)
    ruta_rep = Path(salida) / "reportes" / f"{consultorio_id}.json"
    for ruta in (ruta_ed, ruta_rep):
        if not ruta.exists():
            raise FileNotFoundError(f"No existe {ruta}.")
    with open(ruta_ed, encoding="utf-8") as f:
        edicion_json = json.load(f)
    with open(ruta_rep, encoding="utf-8") as f:
        reporte = json.load(f)
    return edicion_json, reporte


def listar_reportes(salida: Path | str = "build") -> list[str]:
    """Los consultorio_id que tienen reporte, en orden."""
    d = Path(salida) / "reportes"
    return sorted(p.stem for p in d.glob("*.json")) if d.exists() else []
