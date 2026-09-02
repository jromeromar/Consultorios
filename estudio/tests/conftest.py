import json
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))


@pytest.fixture(scope="session")
def formula():
    return yaml.safe_load(open(RAIZ / "formula.yaml", encoding="utf-8"))


@pytest.fixture(scope="session")
def textos():
    return yaml.safe_load(open(RAIZ / "textos.yaml", encoding="utf-8"))


@pytest.fixture(scope="session")
def indicadores(formula):
    return {i["id"]: i for i in formula["indicadores"]}


def _correr(datos: Path, salida: Path, edicion: str = "prueba") -> dict:
    r = subprocess.run(
        [sys.executable, str(RAIZ / "calcular.py"), "--edicion", edicion,
         "--datos", str(datos), "--salida", str(salida)],
        capture_output=True, text=True, cwd=RAIZ,
    )
    assert r.returncode == 0, r.stdout + r.stderr
    return json.load(open(salida / f"edicion_{edicion}.json", encoding="utf-8"))


@pytest.fixture(scope="session")
def corrida(tmp_path_factory):
    """La edición completa, calculada una vez para toda la sesión de pruebas."""
    salida = tmp_path_factory.mktemp("build")
    edicion = _correr(RAIZ / "datos", salida)
    return {"json": edicion, "salida": salida, "edicion": "prueba"}


@pytest.fixture(scope="session")
def corrida_minima(tmp_path_factory):
    """Treinta consultorios: casi nada llega al mínimo."""
    salida = tmp_path_factory.mktemp("build_min")
    edicion = _correr(RAIZ / "tests" / "fixtures" / "minimo", salida, "minima")
    return {"json": edicion, "salida": salida, "edicion": "minima"}


@pytest.fixture(scope="session")
def reportes(corrida):
    d = corrida["salida"] / "reportes"
    return {p.stem: json.load(open(p, encoding="utf-8")) for p in sorted(d.glob("*.json"))}
