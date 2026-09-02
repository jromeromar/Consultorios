"""
La prueba que sostiene el encargo entero.

El percentil que un profesional ve en su auditoría tiene que salir exactamente de
la distribución que el informe agregado publica. Se comprueba sobre **los dos
HTML generados**, no sobre el JSON contra sí mismo: comparar el JSON con el JSON
sería una tautología y no detectaría que un renderizador dibuje otra cosa.
"""
import re
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import estilo  # noqa: E402
import render_agregado  # noqa: E402
import render_auditoria  # noqa: E402
from lectura import leer_anonimo, leer_identificado, listar_reportes  # noqa: E402

# El agregado publica `data-valor`; la auditoría dibuja `data-mediana`.
EN_AGREGADO = re.compile(r'data-stat="bloque\.(\w+)\.mediana" data-valor="([^"]+)"')
EN_AUDITORIA = re.compile(r'data-stat="bloque\.(\w+)\.mediana"[^>]*?data-mediana="([^"]+)"')


@pytest.fixture(scope="module")
def documentos(corrida):
    marca = estilo.cargar_marca()
    d = leer_anonimo(corrida["edicion"], corrida["salida"])
    agregado = render_agregado.render(d, marca)

    # Tres auditorías de perfiles distintos: no basta una.
    ids = listar_reportes(corrida["salida"])
    elegidas = {}
    for cid in ["C-0001", "C-0002", ids[len(ids) // 2], ids[-1]]:
        ed, rep = leer_identificado(corrida["edicion"], cid, corrida["salida"])
        elegidas[cid] = render_auditoria.render_uno(ed, rep, marca)
    return {"agregado": agregado, "auditorias": elegidas, "json": corrida["json"]}


class TestConsistencia:
    def test_el_agregado_publica_la_mediana_de_los_cinco_bloques(self, documentos):
        publicadas = dict(EN_AGREGADO.findall(documentos["agregado"]))
        bloques = {b["id"] for b in documentos["json"]["bloques"] if b["publicable"]}
        assert bloques <= set(publicadas), (
            "el agregado tiene que publicar la mediana de cada bloque, o la auditoría "
            "dibujaría una cifra que el informe no respalda"
        )

    def test_la_mediana_dibujada_en_cada_auditoria_es_la_publicada(self, documentos):
        publicadas = dict(EN_AGREGADO.findall(documentos["agregado"]))
        for cid, html in documentos["auditorias"].items():
            dibujadas = dict(EN_AUDITORIA.findall(html))
            for bloque, valor in dibujadas.items():
                assert bloque in publicadas, f"{cid}: {bloque} se dibuja y no se publica"
                assert valor == publicadas[bloque], (
                    f"{cid}/{bloque}: la auditoría dibuja {valor} y el informe publica "
                    f"{publicadas[bloque]}. Si difieren, son dos cálculos y un día "
                    f"discreparán en público."
                )

    def test_la_comparacion_es_de_cadenas_exactas_no_aproximada(self, documentos):
        publicadas = dict(EN_AGREGADO.findall(documentos["agregado"]))
        alguna = next(iter(documentos["auditorias"].values()))
        dibujadas = dict(EN_AUDITORIA.findall(alguna))
        comunes = set(publicadas) & set(dibujadas)
        assert comunes
        for b in comunes:
            assert publicadas[b] == dibujadas[b]

    def test_las_dos_estampas_salen_del_mismo_campo_del_json(self, documentos):
        publicadas = dict(EN_AGREGADO.findall(documentos["agregado"]))
        for b in documentos["json"]["bloques"]:
            if b["publicable"] and b["mediana"] is not None:
                assert publicadas[b["id"]] == str(b["mediana"])

    def test_los_dos_documentos_declaran_la_misma_edicion_y_formula(self, documentos):
        d = documentos["json"]
        for cid, html in documentos["auditorias"].items():
            for campo in (d["edicion_id"], d["version_formula"], d["fecha_calculo"]):
                assert campo in html, cid
                assert campo in documentos["agregado"]

    def test_los_dos_documentos_declaran_la_misma_muestra(self, documentos):
        f = documentos["json"]["ficha_tecnica"]
        for cid, html in documentos["auditorias"].items():
            assert str(f["n_medidos"]) in html, cid
        assert str(f["n_medidos"]) in documentos["agregado"]


class TestLaPruebaDetectaUnaDiscrepancia:
    """
    Una prueba de consistencia que no puede fallar no prueba nada. Se altera un
    documento a propósito y se comprueba que la comparación lo caza.
    """

    def test_una_mediana_alterada_en_la_auditoria_se_detecta(self, documentos):
        publicadas = dict(EN_AGREGADO.findall(documentos["agregado"]))
        bloque = next(iter(publicadas))
        original = publicadas[bloque]
        alterado = documentos["auditorias"]["C-0001"].replace(
            f'data-mediana="{original}"', 'data-mediana="99.99"', 1
        )
        assert alterado != documentos["auditorias"]["C-0001"], "la alteración debía aplicarse"
        dibujadas = dict(EN_AUDITORIA.findall(alterado))
        discrepan = [b for b, v in dibujadas.items() if v != publicadas.get(b)]
        assert discrepan, "la comparación no detectó una mediana alterada"

    def test_una_mediana_alterada_en_el_agregado_se_detecta(self, documentos):
        publicadas = dict(EN_AGREGADO.findall(documentos["agregado"]))
        bloque, original = next(iter(publicadas.items()))
        alterado = documentos["agregado"].replace(
            f'data-stat="bloque.{bloque}.mediana" data-valor="{original}"',
            f'data-stat="bloque.{bloque}.mediana" data-valor="77.77"', 1
        )
        nuevas = dict(EN_AGREGADO.findall(alterado))
        dibujadas = dict(EN_AUDITORIA.findall(documentos["auditorias"]["C-0001"]))
        assert nuevas[bloque] != dibujadas.get(bloque)
