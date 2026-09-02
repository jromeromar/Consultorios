"""
La compuerta previa a publicar, y la prueba de que puede fallar.

Una revisión que no falla nunca no revisa nada, así que cada control se prueba
inyectando la infracción que debe cazar.
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import cumplimiento  # noqa: E402
import estilo  # noqa: E402
import render_agregado  # noqa: E402
import render_auditoria  # noqa: E402
from lectura import leer_anonimo, leer_identificado, listar_reportes  # noqa: E402


@pytest.fixture(scope="module")
def entorno(corrida, tmp_path_factory):
    """Los tres documentos generados en un directorio propio, listos para revisar."""
    salida = tmp_path_factory.mktemp("cumplimiento")
    shutil.copytree(corrida["salida"], salida, dirs_exist_ok=True)
    marca = estilo.cargar_marca()

    d = leer_anonimo(corrida["edicion"], salida)
    (salida / "informe-agregado.html").write_text(
        render_agregado.render(d, marca), encoding="utf-8"
    )
    aud = salida / "auditorias"
    aud.mkdir(exist_ok=True)
    for cid in listar_reportes(salida)[:4]:
        ed, rep = leer_identificado(corrida["edicion"], cid, salida)
        (aud / f"{cid}.html").write_text(
            render_auditoria.render_uno(ed, rep, marca), encoding="utf-8"
        )
    return {"salida": salida, "edicion": corrida["edicion"]}


def revisar(entorno, auditorias: int = 4) -> int:
    return cumplimiento.main([
        "--edicion", entorno["edicion"], "--salida", str(entorno["salida"]),
        "--auditorias", str(auditorias),
    ])


class TestLaCompuertaPasaConDocumentosLimpios:
    def test_los_documentos_generados_pasan(self, entorno, capsys):
        assert revisar(entorno) == 0
        assert "Listo para publicar" in capsys.readouterr().out

    def test_informa_los_cortes_que_no_se_publican(self, entorno, capsys):
        revisar(entorno)
        salida = capsys.readouterr().out
        assert "municipio" in salida and "prohibido" in salida


class TestLaCompuertaFalla:
    """Cada control con su infracción inyectada."""

    def _romper(self, entorno, buscar: str, reemplazo: str, archivo="informe-agregado.html"):
        ruta = entorno["salida"] / archivo
        original = ruta.read_text(encoding="utf-8")
        assert buscar in original, f"la infracción no se pudo inyectar: {buscar[:40]}"
        ruta.write_text(original.replace(buscar, reemplazo, 1), encoding="utf-8")
        return ruta, original

    def test_caza_un_nombre_de_consultorio_en_el_agregado(self, entorno, capsys):
        reportes = sorted((entorno["salida"] / "reportes").glob("*.json"))
        nombre = json.load(open(reportes[0], encoding="utf-8"))["nombre_comercial"]
        assert nombre, "el fixture debe traer nombres o este control pasa de vacío"
        ruta, original = self._romper(entorno, "<footer>", f"<footer><span>{nombre}</span>")
        try:
            assert revisar(entorno) == 1
            assert "no nombra ningún consultorio" in capsys.readouterr().out
        finally:
            ruta.write_text(original, encoding="utf-8")

    @pytest.mark.parametrize("frase", [
        "podría captar 40 pacientes más al mes",
        "está dejando 12 millones sobre la mesa",
        "mejorar esto aumentaría 30 % las reservas",
        "el retorno de inversión es de tres meses",
    ])
    def test_caza_lenguaje_de_proyeccion(self, entorno, frase, capsys):
        ruta, original = self._romper(entorno, "<footer>", f"<p>{frase}</p><footer>")
        try:
            assert revisar(entorno) == 1, f"no cazó: {frase}"
            assert "Ninguna cifra proyectada" in capsys.readouterr().out
        finally:
            ruta.write_text(original, encoding="utf-8")

    def test_caza_segunda_persona_en_el_agregado(self, entorno, capsys):
        ruta, original = self._romper(
            entorno, "<footer>", "<p>su consultorio quedó por debajo</p><footer>"
        )
        try:
            assert revisar(entorno) == 1
            assert "tercera persona" in capsys.readouterr().out
        finally:
            ruta.write_text(original, encoding="utf-8")

    def test_caza_un_color_escrito_a_mano(self, entorno, capsys):
        ruta, original = self._romper(
            entorno, "<footer>", '<p style="color:#c0392b">rojo</p><footer>'
        )
        try:
            assert revisar(entorno) == 1
            assert "Ningún color escrito a mano" in capsys.readouterr().out
        finally:
            ruta.write_text(original, encoding="utf-8")

    def test_caza_una_estadistica_sin_n_visible(self, entorno, capsys):
        ruta = entorno["salida"] / "informe-agregado.html"
        original = ruta.read_text(encoding="utf-8")
        ruta.write_text(re.sub(r"n = \d+", "sin decir", original), encoding="utf-8")
        try:
            assert revisar(entorno) == 1
            assert "muestra su n" in capsys.readouterr().out
        finally:
            ruta.write_text(original, encoding="utf-8")

    def test_caza_una_mediana_que_discrepa_entre_documentos(self, entorno, capsys):
        aud = sorted((entorno["salida"] / "auditorias").glob("*.html"))[0]
        original = aud.read_text(encoding="utf-8")
        roto = re.sub(r'data-mediana="[\d.]+"', 'data-mediana="99.99"', original, count=1)
        assert roto != original
        aud.write_text(roto, encoding="utf-8")
        try:
            assert revisar(entorno) == 1
            assert "idéntica en los dos documentos" in capsys.readouterr().out
        finally:
            aud.write_text(original, encoding="utf-8")

    def test_caza_un_documento_viejo_que_no_viene_de_esta_corrida(self, entorno, capsys):
        # Es lo que la compuerta detectó de verdad al escribirla: los HTML en
        # disco no venían del último cálculo.
        aud = sorted((entorno["salida"] / "auditorias").glob("*.html"))[0]
        original = aud.read_text(encoding="utf-8")
        d = json.load(open(entorno["salida"] / f"edicion_{entorno['edicion']}.json", encoding="utf-8"))
        aud.write_text(original.replace(d["fecha_calculo"], "2020-01-01T00:00:00-05:00"),
                       encoding="utf-8")
        try:
            assert revisar(entorno) == 1
            assert "estampa completa" in capsys.readouterr().out
        finally:
            aud.write_text(original, encoding="utf-8")

    def test_caza_la_falta_del_aviso_de_datos_sinteticos(self, entorno, capsys):
        aud = sorted((entorno["salida"] / "auditorias").glob("*.html"))[0]
        original = aud.read_text(encoding="utf-8")
        aud.write_text(original.replace(estilo.AVISO_SINTETICOS[0], "PIEZA FINAL"), encoding="utf-8")
        try:
            assert revisar(entorno) == 1
            assert "datos sintéticos lo declara" in capsys.readouterr().out
        finally:
            aud.write_text(original, encoding="utf-8")

    def test_falta_un_documento_y_no_revisa_a_medias(self, entorno, tmp_path):
        assert cumplimiento.main(["--edicion", entorno["edicion"], "--salida", str(tmp_path)]) == 2


class TestComoCLI:
    def test_corre_como_comando_y_devuelve_cero(self, entorno):
        r = subprocess.run(
            [sys.executable, str(RAIZ / "cumplimiento.py"), "--edicion", entorno["edicion"],
             "--salida", str(entorno["salida"]), "--auditorias", "3"],
            capture_output=True, text=True, cwd=RAIZ,
        )
        assert r.returncode == 0, r.stdout + r.stderr
        assert "controles pasan" in r.stdout
