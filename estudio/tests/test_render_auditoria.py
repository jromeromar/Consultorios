"""
La auditoría individual: que dibuje lo que el JSON dice, que no calcule, y que
no lleve marca ni color escritos a mano.
"""
import json
import re
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import estilo  # noqa: E402
import plantilla  # noqa: E402
import render_auditoria  # noqa: E402
from lectura import leer_identificado  # noqa: E402


@pytest.fixture(scope="module")
def marca():
    return estilo.cargar_marca()


@pytest.fixture(scope="module")
def paginas(corrida, marca):
    """Tres auditorías con perfiles distintos: completa, con bloque sin medir y control."""
    salida = corrida["salida"]
    elegidos = ["C-0001", "C-0002"]
    sin_medir = [
        p.stem for p in sorted((salida / "reportes").glob("*.json"))
        if json.load(open(p, encoding="utf-8"))["bloques_no_medidos"]
    ]
    if sin_medir:
        elegidos.append(sin_medir[0])
    out = {}
    for cid in elegidos:
        ed, rep = leer_identificado(corrida["edicion"], cid, salida)
        out[cid] = {"html": render_auditoria.render_uno(ed, rep, marca), "ed": ed, "rep": rep}
    return out


class TestPlantillaSinLogica:
    def test_un_hueco_sin_valor_revienta(self):
        with pytest.raises(plantilla.HuecoSinValor, match="huecos sin valor"):
            plantilla.rellenar("<p>{{falta}}</p>", {}, origen="prueba")

    def test_el_error_explica_que_hacer(self):
        try:
            plantilla.rellenar("{{x}}", {})
        except plantilla.HuecoSinValor as e:
            assert "no medido" in str(e)

    def test_las_plantillas_no_traen_scripts_ni_aritmetica(self):
        for f in (RAIZ / "plantillas").glob("*.html"):
            texto = f.read_text(encoding="utf-8")
            assert "<script" not in texto, f.name
            assert not re.search(r"\{\{[^}]*[-+*/][^}]*\}\}", texto), f.name

    def test_la_pagina_generada_no_lleva_scripts(self, paginas):
        for cid, p in paginas.items():
            assert "<script" not in p["html"], cid


class TestMarcaYColor:
    def test_ningun_color_literal_fuera_del_bloque_generado(self, paginas):
        for cid, p in paginas.items():
            cuerpo = p["html"].split("</style>", 1)[1]
            literales = re.findall(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)", cuerpo)
            assert not literales, f"{cid}: {literales[:5]}"

    def test_la_hoja_de_maquetacion_solo_usa_tokens(self):
        hoja = (RAIZ / "plantillas" / "estilo.css").read_text(encoding="utf-8")
        assert not re.findall(r"#[0-9a-fA-F]{3,8}\b|rgba?\(", hoja)

    def test_el_nombre_de_marca_sale_de_marca_json(self, paginas, marca):
        html = next(iter(paginas.values()))["html"]
        assert marca["nombre"] in html
        for f in list((RAIZ / "plantillas").glob("*.html")) + [RAIZ / "plantillas" / "estilo.css"]:
            assert marca["nombre"] not in f.read_text(encoding="utf-8"), f.name

    def test_cambiar_marca_json_cambia_el_documento_sin_tocar_codigo(self, corrida, marca):
        otra = json.loads(json.dumps(marca))
        otra["nombre"] = "Marca Aprobada S.A.S."
        otra["color"]["claro"]["accent"] = "#7a1f3d"
        ed, rep = leer_identificado(corrida["edicion"], "C-0001", corrida["salida"])
        html = render_auditoria.render_uno(ed, rep, otra)
        assert "Marca Aprobada S.A.S." in html
        assert "--accent:#7a1f3d" in html


class TestLoQueDibuja:
    def test_la_mediana_dibujada_es_la_del_json(self, paginas):
        for cid, p in paginas.items():
            medianas = dict(
                (m.group(1).split(".")[1], float(m.group(2)))
                for m in re.finditer(r'data-stat="([^"]+)"[^>]*?data-mediana="([^"]+)"', p["html"])
            )
            for b in p["ed"]["bloques"]:
                if b["mediana"] is None:
                    continue
                assert medianas[b["id"]] == b["mediana"], f"{cid}/{b['id']}"

    def test_el_puntaje_dibujado_es_el_del_reporte(self, paginas):
        for cid, p in paginas.items():
            dibujados = dict(
                (m.group(1).split(".")[1], float(m.group(2)))
                for m in re.finditer(r'data-stat="([^"]+)"[^>]*?data-puntaje="([^"]+)"', p["html"])
            )
            for bid, b in p["rep"]["bloques"].items():
                if b["puntaje"] is None:
                    assert bid not in dibujados, f"{cid}: se dibujó un puntaje que no existe"
                else:
                    assert dibujados[bid] == b["puntaje"], f"{cid}/{bid}"

    def test_un_bloque_sin_medir_dice_no_medido_y_no_cero(self, paginas):
        con_faltantes = [p for p in paginas.values() if p["rep"]["bloques_no_medidos"]]
        assert con_faltantes, "hace falta un caso con bloque sin medir"
        p = con_faltantes[0]
        assert "No medido en esta edición" in p["html"]
        for bid in p["rep"]["bloques_no_medidos"]:
            assert p["rep"]["bloques"][bid]["puntaje"] is None

    def test_los_cinco_bloques_van_en_el_orden_del_recorrido(self, paginas):
        html = next(iter(paginas.values()))["html"]
        pasos = re.findall(r'<span class="paso">(\d)</span>', html)
        assert pasos == ["1", "2", "3", "4", "5"]


class TestDeclarados:
    def test_van_marcados_y_con_su_nota(self, paginas):
        html = next(iter(paginas.values()))["html"]
        assert 'class="marca-declarado">declarado' in html
        assert "los aportó el consultorio" in html

    def test_los_observados_no_llevan_marca(self, paginas, corrida):
        html = next(iter(paginas.values()))["html"]
        filas = re.findall(r"<tr><td>([^<]*)(<span class=\"marca-declarado\")?", html)
        marcadas = sum(1 for _n, marca in filas if marca)
        assert marcadas == 3, "solo los tres declarados llevan marca"

    def test_un_declarado_no_mueve_el_puntaje(self, formula):
        for i in formula["indicadores"]:
            if not i.get("puntua", True):
                assert i["peso"] == 0


class TestEstampaYNombres:
    def test_cada_pagina_lleva_su_estampa(self, paginas):
        for cid, p in paginas.items():
            html = p["html"]
            assert p["ed"]["edicion_id"] in html
            assert p["ed"]["version_formula"] in html
            assert p["ed"]["fecha_calculo"] in html
            assert "huella de entradas" in html

    def test_la_auditoria_si_identifica_al_consultorio(self, paginas):
        p = paginas["C-0001"]
        assert p["rep"]["nombre_comercial"] in p["html"]
        assert p["rep"]["municipio"] in p["html"]

    def test_los_archivos_se_nombran_por_id_y_no_por_nombre(self, corrida, tmp_path, marca):
        salida = corrida["salida"]
        r = render_auditoria.main([
            "--edicion", corrida["edicion"], "--consultorio", "C-0001",
            "--salida", str(salida), "--sin-pdf",
        ])
        assert r == 0
        generados = list((salida / "auditorias").glob("*.html"))
        assert generados and all(re.fullmatch(r"C-\d+", p.stem) for p in generados)
