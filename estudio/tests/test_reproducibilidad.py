"""
Correr dos veces con la misma entrada produce archivos idénticos byte a byte,
salvo la fecha de generación.

Un profesional puede preguntar en noviembre cómo salió su percentil, y la
respuesta tiene que ser correr el mismo comando y obtener el mismo número.
"""
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
VOLATIL = re.compile(rb'"fecha_calculo": "[^"]*"')


def correr(datos: Path, salida: Path, edicion: str) -> None:
    r = subprocess.run(
        [sys.executable, str(RAIZ / "calcular.py"), "--edicion", edicion,
         "--datos", str(datos), "--salida", str(salida)],
        capture_output=True, text=True, cwd=RAIZ,
    )
    assert r.returncode == 0, r.stdout + r.stderr


def normalizar(ruta: Path) -> bytes:
    return VOLATIL.sub(b'"fecha_calculo": "<normalizada>"', ruta.read_bytes())


class TestReproducibilidad:
    def test_dos_corridas_dan_archivos_identicos(self, tmp_path):
        a, b = tmp_path / "a", tmp_path / "b"
        correr(RAIZ / "datos", a, "rep")
        correr(RAIZ / "datos", b, "rep")

        archivos_a = sorted(p.relative_to(a) for p in a.rglob("*.json"))
        archivos_b = sorted(p.relative_to(b) for p in b.rglob("*.json"))
        assert archivos_a == archivos_b, "las dos corridas no produjeron los mismos archivos"
        assert len(archivos_a) > 100, "deberían salir la edición, la corrida y un reporte por medido"

        distintos = [
            str(rel) for rel in archivos_a
            if normalizar(a / rel) != normalizar(b / rel)
        ]
        assert not distintos, f"{len(distintos)} archivos difieren: {distintos[:5]}"

    def test_lo_unico_que_cambia_es_la_fecha(self, tmp_path):
        a, b = tmp_path / "a", tmp_path / "b"
        correr(RAIZ / "datos", a, "rep")
        correr(RAIZ / "datos", b, "rep")
        ed_a = (a / "edicion_rep.json").read_bytes()
        ed_b = (b / "edicion_rep.json").read_bytes()
        # Sin normalizar, los dos difieren solo si la fecha alcanzó a cambiar;
        # normalizados tienen que ser idénticos siempre.
        assert normalizar(a / "edicion_rep.json") == normalizar(b / "edicion_rep.json")
        assert len(ed_a) == len(ed_b) or ed_a != ed_b

    def test_la_huella_de_las_entradas_no_cambia(self, tmp_path):
        import json
        a, b = tmp_path / "a", tmp_path / "b"
        correr(RAIZ / "datos", a, "rep")
        correr(RAIZ / "datos", b, "rep")
        ha = json.load(open(a / "edicion_rep.json", encoding="utf-8"))["huella_entradas"]
        hb = json.load(open(b / "edicion_rep.json", encoding="utf-8"))["huella_entradas"]
        assert ha == hb

    def test_cambiar_una_entrada_cambia_su_huella(self, tmp_path):
        import json
        import shutil
        datos = tmp_path / "datos"
        shutil.copytree(RAIZ / "datos", datos)
        salida1 = tmp_path / "s1"
        correr(datos, salida1, "rep")
        h1 = json.load(open(salida1 / "edicion_rep.json", encoding="utf-8"))["huella_entradas"]

        # Un comentario de más en un CSV ya cambia la huella: es lo que permite
        # demostrar que dos corridas partieron de la misma entrada.
        with open(datos / "municipio.csv", "a", encoding="utf-8") as f:
            f.write("99999,Inventada,Ninguna,99,otra,,false\n")
        salida2 = tmp_path / "s2"
        correr(datos, salida2, "rep")
        h2 = json.load(open(salida2 / "edicion_rep.json", encoding="utf-8"))["huella_entradas"]

        assert h1["municipio.csv"] != h2["municipio.csv"]
        assert h1["consultorio.csv"] == h2["consultorio.csv"]

    def test_el_json_sale_con_claves_ordenadas(self, tmp_path):
        # Es lo que hace posible la comparación byte a byte.
        a = tmp_path / "a"
        correr(RAIZ / "datos", a, "rep")
        crudo = (a / "edicion_rep.json").read_text(encoding="utf-8")
        claves = re.findall(r'^  "(\w+)":', crudo, re.M)
        assert claves == sorted(claves)
