#!/usr/bin/env python3
"""
El único archivo del sistema que hace aritmética.

    python3 calcular.py --edicion 2026-09 --datos ./datos

Lee los CSV del censo, calcula cinco puntajes por consultorio con las anclas
fijas de formula.yaml, saca los percentiles contra la muestra de la edición, y
escribe:

    build/edicion_{edicion}.json      estadísticas agregadas, SIN nombres
    build/reportes/{id}.json          un reporte por consultorio medido
    build/corrida_{edicion}.json      qué entró, qué quedó fuera y por qué

Los dos documentos leen de aquí y nada más calcula. Si una plantilla necesita un
número que no está en el JSON, el número falta en este archivo.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Iterable

import yaml

RAIZ = Path(__file__).resolve().parent
BOGOTA = timezone(timedelta(hours=-5))

TABLAS = [
    "consultorio", "consultorio_snapshot", "sitio_snapshot", "resena",
    "serp_local", "instagram_snapshot", "contacto_campo", "dato_declarado",
    "municipio", "indicador_geografico", "volumen_busqueda", "edicion_estudio",
]

NULOS = {"", "n/a", "na", "nd", "-", "null", "none"}


# ═══════════════════════════════════════════════════════════════════════════
# Entrada
# ═══════════════════════════════════════════════════════════════════════════

def huella(ruta: Path) -> str:
    h = hashlib.sha256()
    h.update(ruta.read_bytes())
    return h.hexdigest()


def leer_csv(directorio: Path, tabla: str) -> list[dict[str, str]]:
    ruta = directorio / f"{tabla}.csv"
    if not ruta.exists():
        return []
    with open(ruta, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def num(v: Any) -> float | None:
    """Número, o None si no hay dato. Nunca cero por ausencia."""
    if v is None:
        return None
    s = str(v).strip().lower()
    if s in NULOS or s == "no_observado" or s == "no_dice":
        return None
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return None


def ent(v: Any) -> int | None:
    n = num(v)
    return None if n is None else int(round(n))


def bol(v: Any) -> bool | None:
    """Booleano de tres estados: True, False, o None por no observado."""
    if v is None:
        return None
    s = str(v).strip().lower()
    if s in NULOS or s in {"no_observado", "no_dice"}:
        return None
    if s in {"true", "si", "sí", "1", "t", "yes"}:
        return True
    if s in {"false", "no", "0", "f"}:
        return False
    return None


def texto(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return None if s.lower() in NULOS else s


def dias_entre(desde: str | None, hasta: str | None) -> int | None:
    d, h = texto(desde), texto(hasta)
    if not d or not h:
        return None
    fmt = "%Y-%m-%d"
    try:
        return max(0, (datetime.strptime(h, fmt) - datetime.strptime(d, fmt)).days)
    except ValueError:
        return None


# ═══════════════════════════════════════════════════════════════════════════
# Estadística
# ═══════════════════════════════════════════════════════════════════════════

def percentil(ordenados: list[float], p: float) -> float | None:
    """Interpolación lineal. La lista tiene que venir ordenada."""
    if not ordenados:
        return None
    if len(ordenados) == 1:
        return ordenados[0]
    i = (p / 100) * (len(ordenados) - 1)
    bajo, alto = math.floor(i), math.ceil(i)
    if bajo == alto:
        return ordenados[bajo]
    return ordenados[bajo] + (i - bajo) * (ordenados[alto] - ordenados[bajo])


def rango_percentil(valor: float, poblacion: list[float]) -> float | None:
    """
    Rango medio: menores más la mitad de los empates.

    Con empates masivos —y un indicador booleano los produce— cualquier otro
    método regala el percentil 100 a todo el grupo alto.
    """
    if not poblacion:
        return None
    menores = sum(1 for v in poblacion if v < valor)
    iguales = sum(1 for v in poblacion if v == valor)
    return ((menores + iguales / 2) / len(poblacion)) * 100


def spearman(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 3 or len(xs) != len(ys):
        return None

    def rangos(v: list[float]) -> list[float]:
        orden = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(orden):
            j = i
            while j + 1 < len(orden) and v[orden[j + 1]] == v[orden[i]]:
                j += 1
            medio = (i + j) / 2 + 1
            for k in range(i, j + 1):
                r[orden[k]] = medio
            i = j + 1
        return r

    a, b = rangos(xs), rangos(ys)
    n = len(a)
    ma, mb = sum(a) / n, sum(b) / n
    num_ = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    den = math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))
    return None if den == 0 else num_ / den


def curva_densidad(valores: list[float], puntos: int = 101) -> list[dict[str, float]]:
    """
    Densidad por núcleo gaussiano sobre 0–100, SOLO para la forma de la curva.

    Ni la mediana ni el décimo superior se leen de aquí: salen de los
    percentiles de la muestra, que son los que el informe agregado publica. Si
    se leyeran de la curva, la suavización movería la cifra y los dos documentos
    dejarían de coincidir.
    """
    if len(valores) < 2:
        return []
    n = len(valores)
    media = sum(valores) / n
    var = sum((v - media) ** 2 for v in valores) / (n - 1)
    sd = math.sqrt(var) if var > 0 else 1.0
    ordenados = sorted(valores)
    iqr = (percentil(ordenados, 75) or 0) - (percentil(ordenados, 25) or 0)
    escala = min(sd, iqr / 1.349) if iqr > 0 else sd
    h = max(2.0, 0.9 * escala * n ** (-1 / 5))  # Silverman, con piso

    salida = []
    for i in range(puntos):
        x = i * (100 / (puntos - 1))
        d = sum(math.exp(-0.5 * ((x - v) / h) ** 2) for v in valores) / (n * h * math.sqrt(2 * math.pi))
        salida.append({"x": round(x, 2), "d": round(d, 6)})
    maximo = max((p["d"] for p in salida), default=0.0)
    if maximo > 0:
        for p in salida:
            p["d"] = round(p["d"] / maximo, 4)  # normalizada: la escala no informa
    return salida


# ═══════════════════════════════════════════════════════════════════════════
# El sobre de cada estadística publicable
# ═══════════════════════════════════════════════════════════════════════════

class Motor:
    def __init__(self, formula: dict, textos: dict):
        self.formula = formula
        self.textos = textos
        self.minimo = int(formula["minimos"]["publicable"])
        self.minimo_grupo = int(formula["minimos"]["grupo_corte"])
        self.denominadores = set(formula["denominadores"])
        self.avisos: list[str] = []

    def est(
        self,
        valor: Any,
        unidad: str,
        n: int,
        denominador: str,
        no_observado_n: int = 0,
        corte: str = "nacional",
        **extra: Any,
    ) -> dict:
        """
        Ninguna estadística se emite sin n y sin denominador declarado.

        Confundir los medidos con los que respondieron es el error más fácil de
        cometer y el más difícil de detectar después, así que el denominador es
        obligatorio y se valida contra el enum de formula.yaml.
        """
        if denominador not in self.denominadores:
            raise ValueError(
                f"Denominador «{denominador}» no está declarado en formula.yaml. "
                f"Admitidos: {', '.join(sorted(self.denominadores))}"
            )
        publicable = valor is not None and n >= self.minimo
        return {
            "valor": valor,
            "unidad": unidad,
            "n": n,
            "denominador": denominador,
            "no_observado_n": no_observado_n,
            "publicable": publicable,
            "corte": corte,
            **extra,
        }


# ═══════════════════════════════════════════════════════════════════════════
# Anclas: de un valor crudo a 0–100
# ═══════════════════════════════════════════════════════════════════════════

def a_escala(valor: Any, ind: dict) -> float | None:
    """
    Lleva un valor a 0–100 con las anclas fijas del indicador.

    Las anclas encodifican la dirección: si `a100` es menor que `a0`, el
    indicador mejora al bajar. No hace falta un campo de dirección aparte y no
    puede desincronizarse de las anclas.

    Devuelve None cuando no hay dato. Un ausente no es un cero: sale del
    promedio del bloque, no lo hunde.
    """
    t = ind["transformacion"]

    if t == "ninguna":
        return None  # declarado: se muestra y se compara, no puntúa

    if t == "booleano":
        b = bol(valor)
        return None if b is None else (100.0 if b else 0.0)

    if t == "mapa":
        s = texto(valor)
        if s is None or s in {"no_observado", "no_dice"}:
            return None
        v = ind["mapa"].get(s)
        return None if v is None else float(v)

    x = num(valor)
    if x is None:
        return None
    a0, a100 = float(ind["a0"]), float(ind["a100"])

    if t == "lineal":
        p = (x - a0) / (a100 - a0)
    elif t == "log":
        # log1p admite el cero, que en varios indicadores es un valor legítimo.
        l0, l100, lx = math.log1p(max(0.0, a0)), math.log1p(max(0.0, a100)), math.log1p(max(0.0, x))
        p = (lx - l0) / (l100 - l0)
    else:
        raise ValueError(f"Transformación desconocida: {t}")

    return max(0.0, min(100.0, p * 100))


# ═══════════════════════════════════════════════════════════════════════════
# Lectura del censo
# ═══════════════════════════════════════════════════════════════════════════

class Censo:
    """
    Las tablas del censo ya cruzadas, con la captura más reciente de cada
    fuente por consultorio. Cada fuente tiene su propia fecha y su propio modo
    de fallar, así que se resuelven por separado.
    """

    def __init__(self, datos: Path, edicion_id: str | None = None):
        self.tablas = {t: leer_csv(datos, t) for t in TABLAS}
        self.huellas = {
            f"{t}.csv": huella(datos / f"{t}.csv")
            for t in TABLAS if (datos / f"{t}.csv").exists()
        }

        ediciones = self.tablas["edicion_estudio"]
        if not ediciones:
            raise SystemExit(f"Falta {datos}/edicion_estudio.csv: la ficha técnica sale de ahí.")
        self.edicion = (
            next((e for e in ediciones if e["edicion_id"] == edicion_id), ediciones[0])
            if edicion_id else ediciones[0]
        )
        self.edicion_id = self.edicion["edicion_id"]
        self.campo_fin = texto(self.edicion.get("campo_fin"))

        self.municipios = {m["municipio_id"]: m for m in self.tablas["municipio"]}

        # Universo: decisión del equipo, no de Google.
        self.universo = [
            c for c in self.tablas["consultorio"]
            if bol(c.get("es_ortodoncia")) is True and c.get("estado_registro") == "activo"
        ]
        self.fuera = [c for c in self.tablas["consultorio"] if c not in self.universo]
        self.ids = [c["consultorio_id"] for c in self.universo]
        conjunto = set(self.ids)

        self.ficha = self._ultima("consultorio_snapshot", "fecha_captura", conjunto)
        self.sitio = self._ultima("sitio_snapshot", "fecha_rastreo", conjunto)
        self.ig = self._ultima("instagram_snapshot", "fecha_captura", conjunto)

        self.campo = {
            c["consultorio_id"]: c for c in self.tablas["contacto_campo"]
            if c["consultorio_id"] in conjunto
            and c.get("edicion_id") == self.edicion_id
            and bol(c.get("excluido_del_analisis")) is not True
        }
        self.campo_excluido = [
            c for c in self.tablas["contacto_campo"]
            if c.get("edicion_id") == self.edicion_id and bol(c.get("excluido_del_analisis")) is True
        ]

        # Paquete local: apariciones y posición media, descartando el
        # emparejamiento flojo. Es la unión más frágil del modelo.
        self.serp: dict[str, dict[str, Any]] = {}
        self.municipios_medidos: set[str] = set()
        for fila in self.tablas["serp_local"]:
            if fila.get("bloque") != "paquete_local":
                continue
            self.municipios_medidos.add(fila["municipio_id"])
            cid = fila.get("consultorio_id")
            conf = num(fila.get("confianza_emparejamiento"))
            if not cid or cid not in conjunto or (conf is not None and conf < 0.7):
                continue
            acc = self.serp.setdefault(cid, {"consultas": set(), "posiciones": []})
            acc["consultas"].add(f"{fila['consulta_normalizada']}|{fila['municipio_id']}")
            pos = ent(fila.get("posicion"))
            if pos is not None:
                acc["posiciones"].append(pos)

        # Declarado: el más reciente, y a igualdad de fecha el de más confianza.
        orden_conf = {"alta": 3, "media": 2, "baja": 1}
        self.declarado: dict[str, dict[str, dict]] = {}
        for fila in sorted(
            (d for d in self.tablas["dato_declarado"] if d["consultorio_id"] in conjunto),
            key=lambda d: (texto(d.get("fecha")) or "", orden_conf.get(d.get("confianza", ""), 0)),
        ):
            self.declarado.setdefault(fila["consultorio_id"], {})[fila["campo"]] = fila

    def _ultima(self, tabla: str, campo_fecha: str, conjunto: set[str]) -> dict[str, dict]:
        salida: dict[str, dict] = {}
        for fila in self.tablas[tabla]:
            cid = fila.get("consultorio_id")
            if not cid or cid not in conjunto:
                continue
            previa = salida.get(cid)
            if previa is None or (fila.get(campo_fecha) or "") > (previa.get(campo_fecha) or ""):
                salida[cid] = fila
        return salida

    def categoria_ciudad(self, cid: str) -> str | None:
        f = self.ficha.get(cid)
        if not f:
            return None
        m = self.municipios.get(f.get("municipio_id", ""))
        return m.get("categoria_ciudad") if m else None

    def municipio_nombre(self, cid: str) -> str | None:
        f = self.ficha.get(cid)
        m = self.municipios.get(f.get("municipio_id", "")) if f else None
        return f"{m['nombre_municipio']}, {m['departamento']}" if m else None


RE_ORTODONCIA = ("ortodon",)


def valores_crudos(censo: Censo, cid: str) -> dict[str, Any]:
    """
    ÚNICO lugar donde se decide qué columna del censo alimenta qué indicador.

    Aquí vive la regla más delicada del encargo: **un fallo de captura no es un
    cero**. Si el rastreo del sitio no terminó en `ok`, sus indicadores van
    nulos, no falsos: poner falso afirmaría que el consultorio no tiene reserva
    en línea cuando lo único que se sabe es que el rastreador falló.
    """
    f = censo.ficha.get(cid)
    s = censo.sitio.get(cid)
    g = censo.ig.get(cid)
    c = censo.campo.get(cid)
    sp = censo.serp.get(cid)
    dec = censo.declarado.get(cid, {})

    sitio_util = s if s and s.get("estado_rastreo") == "ok" else None
    cat = texto(f.get("categoria_principal")) if f else None
    en_municipio_medido = bool(f and f.get("municipio_id") in censo.municipios_medidos)

    v: dict[str, Any] = {
        # 1 · Lo encuentran
        "categoria_correcta": (
            None if cat is None
            else any(t in cat.lower() for t in RE_ORTODONCIA)
        ),
        # No aparecer es un cero legítimo, pero solo si su municipio se midió.
        "presencia_paquete_local": (
            len(sp["consultas"]) if sp else (0 if en_municipio_medido else None)
        ),
        "posicion_paquete_local": (
            sum(sp["posiciones"]) / len(sp["posiciones"])
            if sp and sp["posiciones"] else None
        ),
        "direccion_visible": (
            None if not f or bol(f.get("es_area_de_servicio")) is None
            else not bol(f.get("es_area_de_servicio"))
        ),
        # 2 · Lo eligen
        "calificacion": f.get("calificacion") if f else None,
        "resenas_total": f.get("resenas_total") if f else None,
        "recencia_resena": dias_entre(f.get("fecha_resena_mas_reciente"), censo.campo_fin) if f else None,
        "resenas_respondidas_pct": f.get("resenas_respondidas_pct") if f else None,
        # 3 · Lo reconocen
        "publicaciones_30d": g.get("publicaciones_30d") if g else None,
        "interaccion_pct": g.get("interaccion_promedio_pct") if g else None,
        "enlace_bio_destino": g.get("destino_enlace") if g else None,
        "seguidores": g.get("seguidores") if g else None,
        "cuenta_profesional": g.get("es_cuenta_profesional") if g else None,
        # 4 · Contesta
        "hubo_respuesta": c.get("hubo_respuesta") if c else None,
        # Nulo cuando no respondió: no entra al promedio como un tiempo malísimo.
        "minutos_primera_respuesta": c.get("minutos_primera_respuesta") if c else None,
        "ofrecio_agendar": c.get("ofrecio_agendar") if c else None,
        "dio_precio": c.get("dio_precio") if c else None,
        "seguimiento_espontaneo": c.get("hubo_seguimiento_espontaneo") if c else None,
        # 5 · Reservan
        "reserva_online": sitio_util.get("tiene_reserva_online") if sitio_util else None,
        "pago_en_linea": sitio_util.get("tiene_pago_en_linea") if sitio_util else None,
        "horario_publicado": f.get("tiene_horario_publicado") if f else None,
        "movil_responsive": sitio_util.get("es_movil_responsive") if sitio_util else None,
        "plataforma_agenda": sitio_util.get("plataforma_agenda_detectada") if sitio_util else None,
        # Declarados
        "precio_lista": num(dec.get("precio_lista", {}).get("valor_numero")),
        "cobra_primera_cita": bol(dec.get("cobra_primera_cita", {}).get("valor_booleano")),
        "consultas_mes": num(dec.get("consultas_mes", {}).get("valor_numero")),
    }
    return v


# ═══════════════════════════════════════════════════════════════════════════
# Puntajes y percentiles
# ═══════════════════════════════════════════════════════════════════════════

def media_ponderada(items: list[tuple[float, float]]) -> float | None:
    """(puntaje, peso). Los items ausentes no llegan aquí: no hunden el promedio."""
    usables = [(v, p) for v, p in items if p > 0]
    if not usables:
        return None
    total = sum(p for _v, p in usables)
    return sum(v * p for v, p in usables) / total if total else None


def puntuar_consultorio(crudos: dict, formula: dict) -> dict:
    """Puntaje por indicador, por bloque y general. Sin percentiles todavía."""
    indicadores = formula["indicadores"]
    por_indicador: dict[str, dict] = {}

    for ind in indicadores:
        escala = a_escala(crudos.get(ind["id"]), ind)
        por_indicador[ind["id"]] = {
            "crudo": crudos.get(ind["id"]),
            "puntaje": None if escala is None else round(escala, 2),
            "puntua": ind.get("puntua", True),
        }

    bloques: dict[str, float | None] = {}
    no_medidos: list[str] = []
    for b in formula["bloques"]:
        items = [
            (por_indicador[i["id"]]["puntaje"], float(i["peso"]))
            for i in indicadores
            if i["bloque"] == b["id"] and i.get("puntua", True)
            and por_indicador[i["id"]]["puntaje"] is not None
        ]
        valor = media_ponderada(items)
        bloques[b["id"]] = None if valor is None else round(valor, 2)
        if valor is None:
            no_medidos.append(b["id"])

    general = media_ponderada([
        (bloques[b["id"]], float(b["peso"]))
        for b in formula["bloques"] if bloques[b["id"]] is not None
    ])

    return {
        "indicadores": por_indicador,
        "bloques": bloques,
        "general": None if general is None else round(general, 2),
        "bloques_no_medidos": no_medidos,
    }


# ═══════════════════════════════════════════════════════════════════════════
# Cortes
# ═══════════════════════════════════════════════════════════════════════════

def evaluar_cortes(motor: Motor, censo: Censo, grupos_por_corte: dict[str, dict[str, int]]) -> dict:
    """
    Un corte se publica solo si TODOS sus grupos llegan al mínimo. Los cortes
    prohibidos no se publican nunca, sin importar el n: un corte por ciudad
    individual con doce o quince observaciones identificaría a un consultorio.
    """
    prohibidos = set(motor.formula["minimos"].get("cortes_prohibidos", []))
    salida = {}
    for corte in motor.formula["cortes"]:
        cid = corte["id"]
        dims = corte.get("dimensiones", [])
        prohibido = any(d in prohibidos for d in dims)
        grupos = grupos_por_corte.get(cid, {})
        suficiente = bool(grupos) and all(n >= motor.minimo_grupo for n in grupos.values())
        salida[cid] = {
            "dimensiones": dims,
            "grupos": dict(sorted(grupos.items())),
            "minimo_grupo": motor.minimo_grupo,
            "publicable": (not prohibido) and suficiente,
            "motivo": (
                "corte prohibido por regla: identificaría consultorios individuales"
                if prohibido else
                None if suficiente else
                "hay grupos por debajo del mínimo de observaciones"
            ),
        }
    return salida


# ═══════════════════════════════════════════════════════════════════════════
# Formatos para la prosa
# ═══════════════════════════════════════════════════════════════════════════

def fmt_minutos(m: float | None) -> str:
    if m is None:
        return "no medido"
    m = int(round(m))
    if m < 60:
        return f"{m} min"
    horas, mins = divmod(m, 60)
    if horas < 24:
        return f"{horas} h {mins:02d} min" if mins else f"{horas} h"
    dias, h = divmod(horas, 24)
    return f"{dias} d {h} h" if h else f"{dias} d"


def fmt_pct(v: float | None, dec: int = 0) -> str:
    return "no medido" if v is None else f"{v:.{dec}f}".replace(".", ",") + " %"


def fmt_num(v: float | None, dec: int = 0) -> str:
    if v is None:
        return "no medido"
    s = f"{v:,.{dec}f}".replace(",", "·").replace(".", ",").replace("·", ".")
    return s


def fmt_razon(v: float | None) -> str:
    return "no medido" if v is None else f"{v:.1f}".replace(".", ",") + " ×"


def fmt_pesos(v: float | None) -> str:
    return "no medido" if v is None else "$ " + fmt_num(v)


# ═══════════════════════════════════════════════════════════════════════════
# Las estadísticas publicables
# ═══════════════════════════════════════════════════════════════════════════

CUBETAS_MINUTOS = [
    ("Menos de 5 min", 0, 5),
    ("5 – 30 min", 5, 30),
    ("30 min – 2 h", 30, 120),
    ("2 – 8 h", 120, 480),
    ("8 – 24 h", 480, 1440),
    ("Más de 24 h", 1440, math.inf),
]


class Poblaciones:
    """Quién pertenece a cada denominador. Se calcula una vez y se pasa entera."""

    def __init__(self, censo: Censo, crudos: dict[str, dict]):
        self.universo = list(censo.ids)
        self.medidos = sorted(censo.campo)
        self.respondieron = sorted(
            cid for cid in self.medidos if bol(censo.campo[cid].get("hubo_respuesta")) is True
        )
        self.con_ficha = sorted(censo.ficha)
        self.con_sitio_rastreado = sorted(
            cid for cid, s in censo.sitio.items() if s.get("estado_rastreo") == "ok"
        )
        self.con_instagram = sorted(censo.ig)
        self.con_serp_medido = sorted(
            cid for cid, f in censo.ficha.items()
            if f.get("municipio_id") in censo.municipios_medidos
        )
        self.declararon = sorted(censo.declarado)

    def n(self, denominador: str) -> int:
        return len(getattr(self, denominador))


def _mediana(valores: Iterable[float | None]) -> float | None:
    xs = sorted(v for v in valores if v is not None)
    return percentil(xs, 50) if xs else None


def _prop(cuantos: int, de: int) -> float | None:
    return None if de == 0 else (cuantos / de) * 100


def estadisticas(
    motor: Motor, censo: Censo, crudos: dict[str, dict], pob: Poblaciones
) -> tuple[dict, dict]:
    """
    Las 17 estadísticas que textos.yaml declara, cada una con su sobre.

    Devuelve (estadisticas, grupos_por_corte).
    """
    E: dict[str, dict] = {}
    cat = {cid: censo.categoria_ciudad(cid) for cid in pob.universo}

    # ── bloque 4 · respuesta ────────────────────────────────────────────────
    minutos = {
        cid: num(censo.campo[cid].get("minutos_primera_respuesta"))
        for cid in pob.respondieron
    }
    med_min = _mediana(minutos.values())
    E["respuesta.mediana_minutos"] = motor.est(
        None if med_min is None else round(med_min, 1), "minutos",
        n=sum(1 for v in minutos.values() if v is not None),
        denominador="respondieron", texto=fmt_minutos(med_min),
    )

    cubetas = []
    for etiqueta, desde, hasta in CUBETAS_MINUTOS:
        cuantos = sum(1 for v in minutos.values() if v is not None and desde <= v < hasta)
        cubetas.append({"etiqueta": etiqueta, "n": cuantos})
    sin_resp = len(pob.medidos) - len(pob.respondieron)
    cubetas.append({"etiqueta": "Sin respuesta", "n": sin_resp, "alterno": True})
    E["respuesta.distribucion_minutos"] = motor.est(
        cubetas, "consultorios", n=len(pob.medidos), denominador="medidos",
        texto=f"{len(pob.medidos)} consultorios medidos",
    )

    E["respuesta.sin_respuesta_prop"] = motor.est(
        _redondear(_prop(sin_resp, len(pob.medidos))), "porcentaje",
        n=len(pob.medidos), denominador="medidos",
        texto=_uno_de_cada(sin_resp, len(pob.medidos)),
    )
    bajo5 = sum(1 for v in minutos.values() if v is not None and v < 5)
    E["respuesta.bajo_cinco_min_prop"] = motor.est(
        _redondear(_prop(bajo5, len(pob.medidos))), "porcentaje",
        n=len(pob.medidos), denominador="medidos",
        texto=fmt_pct(_prop(bajo5, len(pob.medidos))),
    )

    # Mediana por tipo de ciudad. Grupos separados para que el corte se evalúe.
    por_cat: dict[str, list[float]] = {}
    for cid, v in minutos.items():
        c = cat.get(cid)
        if c and v is not None:
            por_cat.setdefault(c, []).append(v)
    grupos_ciudad = {c: len(v) for c, v in por_cat.items()}
    todos_llegan = bool(grupos_ciudad) and all(n >= motor.minimo_grupo for n in grupos_ciudad.values())
    detalle = {
        c: {"valor": round(_mediana(v) or 0, 1), "n": len(v), "texto": fmt_minutos(_mediana(v))}
        for c, v in sorted(por_cat.items())
    }
    E["respuesta.mediana_minutos_por_ciudad"] = motor.est(
        detalle if todos_llegan else None, "minutos",
        n=sum(grupos_ciudad.values()), denominador="respondieron", corte="tipo_ciudad",
        grupos=grupos_ciudad,
    )

    razon = None
    if todos_llegan and "intermedia" in detalle and "capital_principal" in detalle:
        base = detalle["capital_principal"]["valor"]
        razon = round(detalle["intermedia"]["valor"] / base, 2) if base else None
    E["respuesta.razon_intermedias_grandes"] = motor.est(
        razon, "razon", n=sum(grupos_ciudad.values()), denominador="respondieron",
        corte="tipo_ciudad", texto=fmt_razon(razon),
    )

    # ── bloque 1 · visibilidad ──────────────────────────────────────────────
    cat_ok = {cid: crudos[cid]["categoria_correcta"] for cid in pob.con_ficha}
    medidos_cat = [c for c in cat_ok.values() if c is not None]
    incorrectas = sum(1 for c in medidos_cat if c is False)
    E["visibilidad.categoria_incorrecta_prop"] = motor.est(
        _redondear(_prop(incorrectas, len(medidos_cat))), "porcentaje",
        n=len(medidos_cat), denominador="con_ficha",
        texto=fmt_pct(_prop(incorrectas, len(medidos_cat))),
    )

    # Comparación de PRESENCIA, no de posición. El paquete local muestra tres
    # resultados, así que solo se observa a quien entra: el grupo con la
    # categoría mal asignada puede no aparecer nunca y dejar la comparación de
    # posiciones sin muestra. La presencia sí se observa para los dos grupos y
    # además afirma más: no es que rankeen algo más abajo, es que no salen.
    pres_por_cat: dict[str, dict[str, int]] = {
        "categoria_correcta": {"aparecen": 0, "n": 0},
        "categoria_incorrecta": {"aparecen": 0, "n": 0},
    }
    for cid in pob.con_serp_medido:
        c = crudos[cid]["categoria_correcta"]
        pres = crudos[cid]["presencia_paquete_local"]
        if c is None or pres is None:
            continue
        g = pres_por_cat["categoria_correcta" if c else "categoria_incorrecta"]
        g["n"] += 1
        if pres > 0:
            g["aparecen"] += 1
    grupos_pres = {k: v["n"] for k, v in pres_por_cat.items()}
    E["visibilidad.presencia_por_categoria"] = motor.est(
        {
            k: {
                "valor": _redondear(_prop(v["aparecen"], v["n"])),
                "n": v["n"],
                "aparecen": v["aparecen"],
                "texto": fmt_pct(_prop(v["aparecen"], v["n"])),
            }
            for k, v in sorted(pres_por_cat.items())
        }
        if all(n >= motor.minimo_grupo for n in grupos_pres.values()) else None,
        "porcentaje", n=sum(grupos_pres.values()), denominador="con_serp_medido",
        grupos=grupos_pres,
    )

    # ── bloque 2 · reputación ───────────────────────────────────────────────
    resp_pct = [num(crudos[cid]["resenas_respondidas_pct"]) for cid in pob.con_ficha]
    med_resp = _mediana(resp_pct)
    E["reputacion.resenas_respondidas_mediana"] = motor.est(
        _redondear(med_resp), "porcentaje",
        n=sum(1 for v in resp_pct if v is not None), denominador="con_ficha",
        texto=fmt_pct(med_resp, 1),
    )
    recencias = [crudos[cid]["recencia_resena"] for cid in pob.con_ficha]
    med_rec = _mediana(recencias)
    E["reputacion.recencia_mediana"] = motor.est(
        _redondear(med_rec), "dias",
        n=sum(1 for v in recencias if v is not None), denominador="con_ficha",
        texto="no medido" if med_rec is None else f"{int(round(med_rec))} días",
    )
    cubetas_resp = []
    for etiqueta, desde, hasta in (("0 %", 0, 1), ("1 – 10 %", 1, 10), ("10 – 30 %", 10, 30),
                                   ("30 – 60 %", 30, 60), ("60 % o más", 60, math.inf)):
        cubetas_resp.append({
            "etiqueta": etiqueta,
            "n": sum(1 for v in resp_pct if v is not None and desde <= v < hasta),
        })
    E["reputacion.distribucion_resenas_respondidas"] = motor.est(
        cubetas_resp, "consultorios",
        n=sum(1 for v in resp_pct if v is not None), denominador="con_ficha",
    )

    # ── bloque 3 · contenido ────────────────────────────────────────────────
    destinos = [texto(crudos[cid]["enlace_bio_destino"]) for cid in pob.con_instagram]
    utiles = [d for d in destinos if d is not None]
    con_reserva = sum(1 for d in utiles if d == "reserva")
    E["contenido.enlace_reserva_prop"] = motor.est(
        _redondear(_prop(con_reserva, len(utiles))), "porcentaje",
        n=len(utiles), denominador="con_instagram",
        texto=fmt_pct(_prop(con_reserva, len(utiles))),
    )
    orden_dest = ["reserva", "whatsapp", "sitio", "agregador", "ninguno"]
    E["contenido.distribucion_destino_enlace"] = motor.est(
        [{"etiqueta": d, "n": sum(1 for x in utiles if x == d)} for d in orden_dest],
        "consultorios", n=len(utiles), denominador="con_instagram",
    )

    # ── bloque 5 · reservabilidad ───────────────────────────────────────────
    reserva = [bol(crudos[cid]["reserva_online"]) for cid in pob.con_sitio_rastreado]
    pago = [bol(crudos[cid]["pago_en_linea"]) for cid in pob.con_sitio_rastreado]
    r_ok = [v for v in reserva if v is not None]
    sin_reserva = sum(1 for v in r_ok if v is False)
    E["reservabilidad.sin_reserva_online_prop"] = motor.est(
        _redondear(_prop(sin_reserva, len(r_ok))), "porcentaje",
        n=len(r_ok), denominador="con_sitio_rastreado",
        texto=fmt_pct(_prop(sin_reserva, len(r_ok))),
    )
    p_ok = [v for v in pago if v is not None]
    E["reservabilidad.distribucion_reservabilidad"] = motor.est(
        [
            {"etiqueta": "Reserva en línea", "n": sum(1 for v in r_ok if v)},
            {"etiqueta": "Pago al reservar", "n": sum(1 for v in p_ok if v)},
            {"etiqueta": "Ninguna de las dos", "n": sum(
                1 for cid in pob.con_sitio_rastreado
                if bol(crudos[cid]["reserva_online"]) is False
                and bol(crudos[cid]["pago_en_linea"]) is False
            )},
        ],
        "consultorios", n=len(r_ok), denominador="con_sitio_rastreado",
    )

    # ── contra-hallazgo ─────────────────────────────────────────────────────
    for clave, campo, etiqueta in (
        ("contra.respuesta_vs_reputacion", "resenas_total", "reseñas acumuladas"),
        ("contra.respuesta_vs_visibilidad", "presencia_paquete_local", "apariciones en el paquete local"),
    ):
        pares = [
            (minutos[cid], num(crudos[cid][campo]))
            for cid in pob.respondieron
            if minutos.get(cid) is not None and num(crudos[cid][campo]) is not None
        ]
        rho = spearman([p[0] for p in pares], [p[1] for p in pares]) if pares else None
        E[clave] = motor.est(
            None if rho is None else round(rho, 3), "rho",
            n=len(pares), denominador="respondieron",
            eje_y=etiqueta, puntos=[{"x": int(x), "y": round(y, 2)} for x, y in sorted(pares)],
        )

    grupos_por_corte = {
        "nacional": {"nacional": len(pob.medidos)},
        "tipo_ciudad": grupos_ciudad,
        "franja": _contar(censo.campo[cid].get("franja_horaria") for cid in pob.medidos),
        "franja_x_tipo_ciudad": _contar(
            f"{censo.campo[cid].get('franja_horaria')}|{cat.get(cid)}" for cid in pob.medidos
        ),
        "municipio": _contar(
            censo.ficha[cid].get("municipio_id") for cid in pob.con_ficha
        ),
    }
    return E, grupos_por_corte


def _contar(valores: Iterable[Any]) -> dict[str, int]:
    salida: dict[str, int] = {}
    for v in valores:
        k = texto(v) or "sin dato"
        salida[k] = salida.get(k, 0) + 1
    return dict(sorted(salida.items()))


def _redondear(v: float | None, dec: int = 1) -> float | None:
    return None if v is None else round(v, dec)


def _uno_de_cada(cuantos: int, de: int) -> str:
    if de == 0 or cuantos == 0:
        return "no medido"
    return f"1 de cada {round(de / cuantos)}"


# ═══════════════════════════════════════════════════════════════════════════
# Distribución por indicador, en sus propias unidades
# ═══════════════════════════════════════════════════════════════════════════

FORMATO_UNIDAD = {
    "minutos": lambda v: fmt_minutos(v),
    "porcentaje": lambda v: fmt_pct(v, 1),
    "dias": lambda v: "no medido" if v is None else f"{int(round(v))} días",
    "estrellas": lambda v: "no medido" if v is None else f"{v:.1f}".replace(".", ","),
    "pesos": fmt_pesos,
    "posicion": lambda v: "no medido" if v is None else f"{v:.1f}".replace(".", ",") + "ª",
    "booleano": lambda v: "no medido" if v is None else ("Sí" if v >= 50 else "No"),
    "enum": lambda v: "no medido" if v is None else fmt_pct(v, 0),
}


def formatear(valor: float | None, unidad: str) -> str:
    return FORMATO_UNIDAD.get(unidad, lambda v: fmt_num(v, 1))(valor)


def distribucion_indicadores(
    motor: Motor, formula: dict, crudos: dict[str, dict], pob: Poblaciones
) -> dict[str, dict]:
    """
    Mediana y décimo superior de cada indicador, en sus propias unidades y sobre
    su propio denominador.

    El «décimo superior» es p90 o p10 según la dirección que declaren las
    anclas: para el tiempo de respuesta, el décimo mejor es el más rápido.
    """
    salida: dict[str, dict] = {}
    for ind in formula["indicadores"]:
        den = ind["denominador"]
        poblacion = getattr(pob, den)
        crudo_a_num = []
        for cid in poblacion:
            v = crudos[cid].get(ind["id"])
            if ind["transformacion"] == "booleano":
                b = bol(v)
                if b is not None:
                    crudo_a_num.append(100.0 if b else 0.0)
            elif ind["transformacion"] == "mapa":
                e = a_escala(v, ind)
                if e is not None:
                    crudo_a_num.append(e)
            else:
                n = num(v) if not isinstance(v, (int, float)) else float(v)
                if n is not None:
                    crudo_a_num.append(n)

        crudo_a_num.sort()
        n = len(crudo_a_num)
        menos_es_mejor = (
            ind["transformacion"] in {"lineal", "log"}
            and float(ind["a100"]) < float(ind["a0"])
        )
        mediana = percentil(crudo_a_num, 50)
        top10 = percentil(crudo_a_num, 10 if menos_es_mejor else 90)

        salida[ind["id"]] = {
            "nombre": ind["nombre"],
            "bloque": ind["bloque"],
            "unidad": ind["unidad"],
            "origen": ind["origen"],
            "denominador": den,
            "puntua": ind.get("puntua", True),
            "menos_es_mejor": menos_es_mejor,
            "n": n,
            "publicable": n >= motor.minimo,
            "mediana": _redondear(mediana, 2),
            "mediana_texto": formatear(mediana, ind["unidad"]),
            "top10": _redondear(top10, 2),
            "top10_texto": formatear(top10, ind["unidad"]),
        }
    return salida


# ═══════════════════════════════════════════════════════════════════════════
# Hallazgos: huecos rellenos y comprobaciones
# ═══════════════════════════════════════════════════════════════════════════

def comprobar(comp: dict | None, E: dict[str, dict]) -> tuple[bool, str | None]:
    """
    Salvaguarda contra un título que afirme una dirección que el dato no
    sostiene. Un titular relleno con un hueco lo diría igual de convencido.
    """
    if not comp:
        return True, None
    tipo = comp["tipo"]

    if tipo == "mediana_por_encima_de":
        e = E.get(comp["estadistica"], {})
        v = e.get("valor")
        if v is None or v <= comp["valor"]:
            return False, f"{comp['estadistica']} no supera {comp['valor']}"
        return True, None

    if tipo == "grupo_mayor":
        e = E.get(comp["estadistica"], {})
        detalle = e.get("valor")
        if not isinstance(detalle, dict) or comp["grupo"] not in detalle:
            return False, f"{comp['estadistica']} no publica grupos comparables"
        objetivo = detalle[comp["grupo"]]["valor"]
        otros = [d["valor"] for g, d in detalle.items() if g != comp["grupo"]]
        if not otros or objetivo <= min(otros):
            return False, f"el grupo «{comp['grupo']}» no es el mayor"
        return True, None

    if tipo == "proporcion_entre":
        e = E.get(comp["estadistica"], {})
        v = e.get("valor")
        if v is None or not (comp["minimo"] <= v <= comp["maximo"]):
            return False, f"{comp['estadistica']} fuera del rango declarado"
        return True, None

    if tipo == "sin_relacion":
        rhos = [E.get(c, {}).get("valor") for c in comp["estadisticas"]]
        if any(r is None for r in rhos):
            return False, "faltan correlaciones para sostener el contra-hallazgo"
        peor = max(abs(r) for r in rhos)
        if peor > comp["rho_maximo"]:
            return False, f"hay relación: |rho| máximo {peor:.3f} supera {comp['rho_maximo']}"
        return True, None

    raise ValueError(f"Comprobación desconocida: {tipo}")


def resolver_huecos(E: dict, pob: Poblaciones, censo: Censo) -> dict[str, str]:
    """Los valores con que se rellenan los {huecos} de títulos y ledes."""
    t = lambda clave: E.get(clave, {}).get("texto") or "no medido"
    return {
        "n_medidos": fmt_num(len(pob.medidos)),
        "n_respondieron": fmt_num(len(pob.respondieron)),
        "n_universo": fmt_num(len(pob.universo)),
        "n_ciudades": fmt_num(len(censo.municipios)),
        "mediana_respuesta": t("respuesta.mediana_minutos"),
        "razon_intermedias_grandes": t("respuesta.razon_intermedias_grandes"),
        "categoria_incorrecta_prop": t("visibilidad.categoria_incorrecta_prop"),
        "resenas_respondidas_mediana": t("reputacion.resenas_respondidas_mediana"),
        "recencia_mediana": t("reputacion.recencia_mediana"),
        "enlace_reserva_prop": t("contenido.enlace_reserva_prop"),
        "sin_reserva_online_prop": t("reservabilidad.sin_reserva_online_prop"),
        "campo_inicio": texto(censo.edicion.get("campo_inicio")) or "no declarado",
        "campo_fin": texto(censo.edicion.get("campo_fin")) or "no declarado",
    }


def rellenar(plantilla: str, huecos: dict[str, str], faltantes: list[str]) -> str:
    """Rellena {huecos}. Un hueco sin valor se anota: no se deja vacío."""
    import re

    def sub(m):
        clave = m.group(1)
        if clave not in huecos:
            faltantes.append(clave)
            return "«sin dato»"
        return huecos[clave]

    return re.sub(r"\{(\w+)\}", sub, " ".join(plantilla.split()))


def armar_hallazgos(motor: Motor, E: dict, pob: Poblaciones, censo: Censo) -> tuple[list[dict], list[str]]:
    huecos = resolver_huecos(E, pob, censo)
    avisos: list[str] = []
    salida = []

    for i, h in enumerate(motor.textos["hallazgos"], start=1):
        faltan_est = [c for c in h["estadisticas"] if c not in E]
        if faltan_est:
            raise SystemExit(
                f"El hallazgo {h['id']} declara estadísticas que el motor no emite: "
                f"{', '.join(faltan_est)}. Agrégalas en calcular.py o quítalas de textos.yaml."
            )

        publicables = [E[c]["publicable"] for c in h["estadisticas"]]
        concluyente, motivo = comprobar(h.get("comprobacion"), E)
        faltantes: list[str] = []

        if not all(publicables):
            avisos.append(f"{h['id']}: no publicable, alguna estadística quedó bajo el mínimo")
        if not concluyente:
            avisos.append(f"{h['id']}: la comprobación no pasa ({motivo}); se publica como no concluyente")

        salida.append({
            "id": h["id"],
            "numero": f"{i:02d}",
            "bloque": h["bloque"],
            "forma": h["forma"],
            "contra_hallazgo": bool(h.get("contra_hallazgo")),
            "titulo": rellenar(h["titulo"], huecos, faltantes),
            "lede": rellenar(h["lede"], huecos, faltantes),
            "no_dice": " ".join(h["no_dice"].split()),
            "nota_denominador": " ".join(h.get("nota_denominador", "").split()) or None,
            "estadisticas": h["estadisticas"],
            "publicable": all(publicables),
            "concluyente": concluyente,
            "motivo_no_concluyente": motivo,
        })
        if faltantes:
            avisos.append(f"{h['id']}: huecos sin valor en el texto: {', '.join(sorted(set(faltantes)))}")

    if not any(h["contra_hallazgo"] and h["publicable"] and h["concluyente"] for h in salida):
        avisos.append(
            "NINGÚN CONTRA-HALLAZGO SE SOSTIENE en esta edición. El informe lo dice "
            "en vez de omitir la sección, pero conviene revisarlo antes de publicar."
        )
    return salida, avisos


# ═══════════════════════════════════════════════════════════════════════════
# Bandas por cuartil
# ═══════════════════════════════════════════════════════════════════════════

# Se nombran por cuartil y no con adjetivos de desempeño. Es más defendible y no
# insulta a un prospecto que está parado enfrente.
BANDAS = [
    (25, "cuartil inferior", "cuartil-1"),
    (50, "segundo cuartil", "cuartil-2"),
    (75, "tercer cuartil", "cuartil-3"),
    (90, "cuarto cuartil", "cuartil-4"),
    (101, "décimo superior", "cuartil-5"),
]


def banda(percentil_: float | None) -> dict | None:
    if percentil_ is None:
        return None
    for tope, nombre, token in BANDAS:
        if percentil_ < tope:
            return {"nombre": nombre, "token_color": token}
    return {"nombre": BANDAS[-1][1], "token_color": BANDAS[-1][2]}


# ═══════════════════════════════════════════════════════════════════════════
# Ensamblado y escritura
# ═══════════════════════════════════════════════════════════════════════════

def escribir_json(ruta: Path, datos: dict) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with open(ruta, "w", encoding="utf-8", newline="\n") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Calcula una edición del censo.")
    ap.add_argument("--edicion", required=True, help="Etiqueta de la edición, p. ej. 2026-09")
    ap.add_argument("--datos", default="./datos", help="Directorio con los CSV del censo")
    ap.add_argument("--salida", default="./build")
    ap.add_argument("--edicion-id", default=None, help="edicion_id si el CSV trae varias")
    args = ap.parse_args(argv)

    formula = yaml.safe_load(open(RAIZ / "formula.yaml", encoding="utf-8"))
    textos = yaml.safe_load(open(RAIZ / "textos.yaml", encoding="utf-8"))
    marca = json.load(open(RAIZ / "marca.json", encoding="utf-8"))
    motor = Motor(formula, textos)

    censo = Censo(Path(args.datos), args.edicion_id)
    crudos = {cid: valores_crudos(censo, cid) for cid in censo.ids}
    pob = Poblaciones(censo, crudos)

    puntajes = {cid: puntuar_consultorio(crudos[cid], formula) for cid in censo.ids}

    # ── percentiles sobre el total nacional ────────────────────────────────
    generales = sorted(p["general"] for p in puntajes.values() if p["general"] is not None)
    por_bloque_pob = {
        b["id"]: sorted(
            p["bloques"][b["id"]] for p in puntajes.values() if p["bloques"][b["id"]] is not None
        )
        for b in formula["bloques"]
    }

    for cid, p in puntajes.items():
        p["percentil_general"] = (
            None if p["general"] is None
            else round(rango_percentil(p["general"], generales) or 0, 1)
        )
        p["percentil_bloques"] = {
            b["id"]: (
                None if p["bloques"][b["id"]] is None
                else round(rango_percentil(p["bloques"][b["id"]], por_bloque_pob[b["id"]]) or 0, 1)
            )
            for b in formula["bloques"]
        }

    E, grupos_por_corte = estadisticas(motor, censo, crudos, pob)
    cortes = evaluar_cortes(motor, censo, grupos_por_corte)
    dist_ind = distribucion_indicadores(motor, formula, crudos, pob)
    hallazgos, avisos = armar_hallazgos(motor, E, pob, censo)

    # ── bloques agregados: la distribución que los dos documentos comparten ─
    bloques_json = []
    for b in formula["bloques"]:
        valores = por_bloque_pob[b["id"]]
        n = len(valores)
        sin_medir = len(censo.ids) - n
        bloques_json.append({
            "id": b["id"],
            "paso": b["paso"],
            "nombre": b["nombre"],
            "subtitulo": b["subtitulo"],
            "peso": b["peso"],
            "n": n,
            "no_medidos": sin_medir,
            "publicable": n >= motor.minimo,
            "mediana": _redondear(percentil(valores, 50), 2),
            "p10": _redondear(percentil(valores, 10), 2),
            "p25": _redondear(percentil(valores, 25), 2),
            "p75": _redondear(percentil(valores, 75), 2),
            "p90": _redondear(percentil(valores, 90), 2),
            "curva": curva_densidad(valores),
            "indicadores": [
                i["id"] for i in formula["indicadores"] if i["bloque"] == b["id"]
            ],
        })

    generales_ord = generales
    ficha = {
        "edicion_id": censo.edicion_id,
        "nombre": texto(censo.edicion.get("nombre")),
        "campo_inicio": texto(censo.edicion.get("campo_inicio")),
        "campo_fin": texto(censo.edicion.get("campo_fin")),
        "corte_reloj_horas": ent(censo.edicion.get("corte_reloj_horas")),
        "publicada_en": texto(censo.edicion.get("publicada_en")),
        "notas_metodo": texto(censo.edicion.get("notas_metodo")),
        "n_universo": len(pob.universo),
        "n_medidos": len(pob.medidos),
        "n_respondio": len(pob.respondieron),
        "n_ciudades": len(censo.municipios),
        "ciudades": [
            {"municipio_id": m, "nombre": d["nombre_municipio"],
             "departamento": d["departamento"], "categoria_ciudad": d["categoria_ciudad"]}
            for m, d in sorted(censo.municipios.items())
        ],
        "excluidos_del_universo": len(censo.fuera),
        "excluidos_del_analisis": len(censo.campo_excluido),
    }

    huecos = resolver_huecos(E, pob, censo)
    faltan: list[str] = []
    demanda = _contexto_demanda(motor, censo)

    edicion_json = {
        "edicion": args.edicion,
        "edicion_id": censo.edicion_id,
        "version_formula": formula["version"],
        "fecha_calculo": datetime.now(BOGOTA).isoformat(timespec="seconds"),
        "huella_entradas": censo.huellas,
        "minimos": {
            "publicable": motor.minimo,
            "grupo_corte": motor.minimo_grupo,
            "cortes_prohibidos": formula["minimos"].get("cortes_prohibidos", []),
        },
        "ficha_tecnica": ficha,
        "poblaciones": {
            d: pob.n(d) for d in sorted(formula["denominadores"]) if hasattr(pob, d)
        },
        "denominadores": formula["denominadores"],
        "bloques": bloques_json,
        "indicadores": dist_ind,
        "estadisticas": E,
        "cortes": cortes,
        "hallazgos": hallazgos,
        "titular": {
            "cifra": rellenar(textos["titular"]["cifra"], huecos, faltan),
            "pie": " ".join(textos["titular"]["pie"].split()),
            "apoyo": [
                {
                    "estadistica": a["estadistica"],
                    "cifra": E[a["estadistica"]]["texto"] if a["estadistica"] in E else "no medido",
                    "texto": " ".join(a["texto"].split()),
                    "publicable": E.get(a["estadistica"], {}).get("publicable", False),
                }
                for a in textos["titular"]["apoyo"]
            ],
        },
        "contexto_demanda": demanda,
        "textos": _textos_resueltos(textos, huecos, faltan, marca, ficha),
        "distribucion_general": {
            "n": len(generales_ord),
            "mediana": _redondear(percentil(generales_ord, 50), 2),
            "p10": _redondear(percentil(generales_ord, 10), 2),
            "p25": _redondear(percentil(generales_ord, 25), 2),
            "p75": _redondear(percentil(generales_ord, 75), 2),
            "p90": _redondear(percentil(generales_ord, 90), 2),
            "curva": curva_densidad(generales_ord),
        },
    }

    salida = Path(args.salida)
    escribir_json(salida / f"edicion_{args.edicion}.json", edicion_json)

    # ── un reporte por consultorio medido ──────────────────────────────────
    reportes = 0
    for cid in pob.medidos:
        p = puntajes[cid]
        f = censo.ficha.get(cid, {})
        escribir_json(salida / "reportes" / f"{cid}.json", {
            "edicion": args.edicion,
            "edicion_id": censo.edicion_id,
            "version_formula": formula["version"],
            "fecha_calculo": edicion_json["fecha_calculo"],
            "consultorio_id": cid,
            "nombre_comercial": texto(f.get("nombre_comercial")),
            "municipio": censo.municipio_nombre(cid),
            "categoria_ciudad": censo.categoria_ciudad(cid),
            "general": {
                "puntaje": p["general"],
                "percentil": p["percentil_general"],
                "banda": banda(p["percentil_general"]),
            },
            "bloques": {
                b["id"]: {
                    "puntaje": p["bloques"][b["id"]],
                    "percentil": p["percentil_bloques"][b["id"]],
                    "banda": banda(p["percentil_bloques"][b["id"]]),
                }
                for b in formula["bloques"]
            },
            "bloques_no_medidos": p["bloques_no_medidos"],
            "indicadores": {
                i["id"]: {
                    "puntaje": p["indicadores"][i["id"]]["puntaje"],
                    "crudo": _crudo_serializable(p["indicadores"][i["id"]]["crudo"]),
                    "texto": _texto_crudo(p["indicadores"][i["id"]]["crudo"], i),
                    "declarado": not i.get("puntua", True),
                }
                for i in formula["indicadores"]
            },
        })
        reportes += 1

    corrida = {
        "edicion": args.edicion,
        "fecha_calculo": edicion_json["fecha_calculo"],
        "version_formula": formula["version"],
        "entraron": {"universo": len(pob.universo), "medidos": len(pob.medidos),
                     "respondieron": len(pob.respondieron), "reportes": reportes},
        "quedaron_fuera": _fuera(censo),
        "bloques_no_medidos": {
            b["id"]: sum(1 for p in puntajes.values() if b["id"] in p["bloques_no_medidos"])
            for b in formula["bloques"]
        },
        "cortes": {k: {"publicable": v["publicable"], "motivo": v["motivo"]} for k, v in cortes.items()},
        "estadisticas_no_publicables": sorted(k for k, v in E.items() if not v["publicable"]),
        "avisos": avisos,
    }
    escribir_json(salida / f"corrida_{args.edicion}.json", corrida)

    _imprimir_corrida(corrida, E, cortes)
    return 0


def _crudo_serializable(v: Any) -> Any:
    if isinstance(v, bool) or v is None or isinstance(v, (int, float)):
        return v
    return str(v)


def _texto_crudo(v: Any, ind: dict) -> str:
    if v is None or (isinstance(v, str) and v.strip().lower() in NULOS):
        return "no medido"
    if isinstance(v, str) and v.strip().lower() in {"no_observado", "no_dice"}:
        return "no observado"
    if ind["transformacion"] == "booleano":
        b = bol(v)
        return "no medido" if b is None else ("Sí" if b else "No")
    if ind["transformacion"] == "mapa":
        return str(v)
    n = num(v)
    return formatear(n, ind["unidad"])


def _fuera(censo: Censo) -> dict:
    motivos: dict[str, int] = {}
    for c in censo.fuera:
        if bol(c.get("es_ortodoncia")) is not True:
            k = "no es ortodoncia"
        else:
            k = f"estado_registro = {c.get('estado_registro')}"
        motivos[k] = motivos.get(k, 0) + 1
    motivos_campo: dict[str, int] = {}
    for c in censo.campo_excluido:
        k = texto(c.get("motivo_exclusion")) or "sin motivo declarado"
        motivos_campo[k] = motivos_campo.get(k, 0) + 1
    return {
        "del_universo": dict(sorted(motivos.items())),
        "del_analisis_de_campo": dict(sorted(motivos_campo.items())),
    }


def _contexto_demanda(motor: Motor, censo: Censo) -> dict:
    """
    Investigación de palabras clave, etiquetada aparte. No es trabajo de campo y
    el documento tiene que decirlo para que nadie lo lea como resultado de la
    medición.
    """
    filas = censo.tablas["volumen_busqueda"]
    por_ciudad: dict[str, int] = {}
    dificultades: list[float] = []
    for f in filas:
        v = ent(f.get("volumen_mes"))
        d = num(f.get("dificultad_seo"))
        if v is not None:
            por_ciudad[f["ambito_id"]] = por_ciudad.get(f["ambito_id"], 0) + v
        if d is not None:
            dificultades.append(d)
    total = sum(por_ciudad.values())
    return {
        "etiqueta": motor.textos["contexto_demanda"]["etiqueta"],
        "intro": " ".join(motor.textos["contexto_demanda"]["intro"].split()),
        "nota": " ".join(motor.textos["contexto_demanda"]["nota"].split()),
        "publicable": bool(filas),
        "volumen_total_mes": total,
        "volumen_total_texto": fmt_num(total),
        "n_consultas": len({f["consulta_normalizada"] for f in filas}),
        "por_ciudad": [
            {"municipio_id": m, "nombre": censo.municipios.get(m, {}).get("nombre_municipio", m),
             "volumen_mes": v, "volumen_texto": fmt_num(v)}
            for m, v in sorted(por_ciudad.items(), key=lambda kv: -kv[1])
        ],
        "dificultad_mediana": _redondear(_mediana(dificultades), 1),
    }


def _textos_resueltos(textos: dict, huecos: dict, faltan: list, marca: dict, ficha: dict) -> dict:
    """
    Toda la prosa resuelta aquí, para que los renderizadores lean el JSON y nada
    más. Así no puede pasar que el agregado y la auditoría lean versiones
    distintas del mismo texto.
    """
    h = dict(huecos)
    h["marca"] = marca["nombre"]
    h["anio"] = (ficha.get("publicada_en") or "")[:4] or "s. f."
    h["etiqueta_edicion"] = textos["estudio"]["etiqueta_edicion"]
    return {
        "estudio": {
            "titulo": textos["estudio"]["titulo"],
            "subtitulo": rellenar(textos["estudio"]["subtitulo"], h, faltan),
            "etiqueta_edicion": textos["estudio"]["etiqueta_edicion"],
            "como_citar": rellenar(textos["estudio"]["como_citar"], h, faltan),
        },
        "metodo": {k: " ".join(v.split()) for k, v in textos["metodo"].items()},
        "limites_informe": [" ".join(x.split()) for x in textos["limites_informe"]],
        "limites_auditoria": [" ".join(x.split()) for x in textos["limites_auditoria"]],
        "auditoria": {k: rellenar(v, h, faltan) for k, v in textos["auditoria"].items()},
        "autoria": {
            "titulo": textos["autoria"]["titulo"],
            "texto": rellenar(textos["autoria"]["texto"], h, faltan),
            "cta": textos["autoria"]["cta"],
        },
    }


def _imprimir_corrida(corrida: dict, E: dict, cortes: dict) -> None:
    print(f"\nEdición {corrida['edicion']} · fórmula {corrida['version_formula']}")
    e = corrida["entraron"]
    print(f"  universo {e['universo']} · medidos {e['medidos']} · respondieron {e['respondieron']}"
          f" · reportes {e['reportes']}")
    print("\n  quedaron fuera del universo:")
    for k, v in corrida["quedaron_fuera"]["del_universo"].items():
        print(f"    {v:>3}  {k}")
    if corrida["quedaron_fuera"]["del_analisis_de_campo"]:
        print("  quedaron fuera del análisis de campo:")
        for k, v in corrida["quedaron_fuera"]["del_analisis_de_campo"].items():
            print(f"    {v:>3}  {k}")
    print("\n  bloques no medidos (consultorios):")
    for k, v in corrida["bloques_no_medidos"].items():
        print(f"    {v:>3}  {k}")
    print("\n  cortes:")
    for k, v in corrida["cortes"].items():
        estado = "se publica" if v["publicable"] else f"NO se publica · {v['motivo']}"
        print(f"    {k:24} {estado}")
    if corrida["estadisticas_no_publicables"]:
        print("\n  estadísticas no publicables:")
        for k in corrida["estadisticas_no_publicables"]:
            print(f"    {k}  (n={E[k]['n']}, denominador {E[k]['denominador']})")
    if corrida["avisos"]:
        print("\n  avisos:")
        for a in corrida["avisos"]:
            print(f"    · {a}")
    print()


if __name__ == "__main__":
    sys.exit(main())
