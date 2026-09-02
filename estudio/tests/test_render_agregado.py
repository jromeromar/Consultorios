"""
El informe agregado: público, anónimo, en tercera persona sobre el sector, y sin
una sola cifra proyectada.
"""
import csv
import json
import re
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import estilo  # noqa: E402
import render_agregado  # noqa: E402
from lectura import CAMPOS_IDENTIFICABLES, PermisoAnonimato, leer_anonimo  # noqa: E402


@pytest.fixture(scope="module")
def marca():
    return estilo.cargar_marca()


@pytest.fixture(scope="module")
def agregado(corrida, marca):
    d = leer_anonimo(corrida["edicion"], corrida["salida"])
    return {"html": render_agregado.render(d, marca), "json": corrida["json"]}


@pytest.fixture(scope="module")
def cuerpo(agregado):
    return agregado["html"].split("</style>", 1)[1]


class TestAnonimatoPorConstruccion:
    def test_ningun_nombre_de_consultorio_aparece(self, agregado):
        nombres = {
            f["nombre_comercial"]
            for f in csv.DictReader(open(RAIZ / "datos" / "consultorio_snapshot.csv", encoding="utf-8"))
            if f.get("nombre_comercial")
        }
        filtrados = [n for n in nombres if n in agregado["html"]]
        assert not filtrados, f"nombres en el informe público: {filtrados[:5]}"

    def test_ningun_telefono_dominio_ni_handle_aparece(self, agregado):
        for f in csv.DictReader(open(RAIZ / "datos" / "consultorio_snapshot.csv", encoding="utf-8")):
            for campo in ("telefono_e164", "dominio", "instagram_handle"):
                if f.get(campo):
                    assert f[campo] not in agregado["html"], f"{campo}: {f[campo]}"

    def test_ningun_id_de_consultorio_aparece(self, agregado):
        assert not re.search(r"\bC-\d{4}\b", agregado["html"])

    def test_las_ciudades_si_van_con_nombre(self, agregado):
        # El encargo lo permite explícitamente.
        ciudades = [c["nombre"] for c in agregado["json"]["ficha_tecnica"]["ciudades"]]
        assert all(c in agregado["html"] for c in ciudades)

    def test_el_renderizador_no_puede_llegar_a_un_nombre(self, corrida):
        d = leer_anonimo(corrida["edicion"], corrida["salida"])
        for clave in ("nombre_comercial", "telefono_e164", "consultorio_id"):
            with pytest.raises(PermisoAnonimato):
                d[clave]

    def test_el_renderizador_no_importa_el_lector_identificado(self):
        fuente = (RAIZ / "render_agregado.py").read_text(encoding="utf-8")
        assert "leer_identificado" not in fuente
        assert "reportes" not in fuente

    def test_el_json_agregado_no_trae_claves_identificables(self, agregado):
        crudo = json.dumps(agregado["json"], ensure_ascii=False)
        assert not [c for c in CAMPOS_IDENTIFICABLES if f'"{c}"' in crudo]


class TestEstructura:
    def test_las_secciones_van_en_el_orden_del_encargo(self, agregado):
        orden = re.findall(r'<section id="(\w+)"', agregado["html"])
        assert orden == ["titular", "metodo", "hallazgos", "contexto", "limites", "ficha"]

    def test_el_metodo_va_antes_de_los_hallazgos(self, agregado):
        h = agregado["html"]
        assert h.index('id="metodo"') < h.index('id="hallazgos"')

    def test_la_ficha_de_metodo_se_ve_desde_la_portada(self, agregado):
        h = agregado["html"]
        assert h.index("franja-metodo") < h.index('id="titular"')

    def test_la_autoria_va_al_final_y_separada(self, agregado):
        h = agregado["html"]
        assert h.index('class="autoria"') > h.index('id="ficha"')
        # Y no explica el modelo de negocio en el cuerpo del informe.
        cuerpo_informe = h[h.index('id="titular"'):h.index('class="autoria"')]
        assert "cobra por cada reserva" not in cuerpo_informe

    def test_hay_siete_hallazgos_numerados(self, agregado):
        numeros = re.findall(r'<span class="h-num[^"]*">(\d{2})</span>', agregado["html"])
        assert numeros == ["01", "02", "03", "04", "05", "06", "07"]

    def test_cada_hallazgo_lleva_grafico_tabla_y_que_no_dice(self, agregado):
        for m in re.finditer(r'<article class="tarjeta hallazgo" id="(\w+)">(.*?)</article>',
                             agregado["html"], re.S):
            hid, cuerpo = m.group(1), m.group(2)
            assert "<svg" in cuerpo, hid
            assert "Ver los datos en tabla" in cuerpo, hid
            assert "Qué no dice." in cuerpo, hid

    def test_el_contra_hallazgo_va_del_mismo_tamano_y_no_escondido(self, agregado):
        h = agregado["html"]
        contra = next(x for x in agregado["json"]["hallazgos"] if x["contra_hallazgo"])
        assert f'id="{contra["id"]}"' in h
        # Misma plantilla, misma clase de tarjeta: no hay tratamiento reducido.
        assert h.count('class="tarjeta hallazgo"') == 7


class TestReglasDuras:
    PROYECCION = re.compile(
        r"podr[íi]a captar|dejando .{0,20}sobre la mesa|aumentar[íi]a|ganar[íi]a "
        r"|pacientes m[áa]s|retorno de inversi[óo]n|\bROI\b|si mejora",
        re.I,
    )

    def test_ninguna_cifra_proyectada(self, cuerpo):
        assert not self.PROYECCION.findall(cuerpo)

    def test_tercera_persona_sobre_el_sector(self, cuerpo):
        # La segunda persona sobre un atributo personal hace que los cortes de
        # este informe se rechacen como pieza publicitaria.
        assert not re.findall(r"\busted\b|\bsu consultorio\b|\btu consultorio\b", cuerpo, re.I)

    def test_toda_estadistica_publicada_muestra_su_n(self, agregado):
        h = agregado["html"]
        f = agregado["json"]["ficha_tecnica"]
        # Los dos denominadores aparecen explícitos en el documento.
        assert str(f["n_medidos"]) in h and str(f["n_respondio"]) in h
        assert "denominadores" in h.lower()

    def test_los_cortes_que_no_se_publican_se_declaran(self, agregado):
        h = agregado["html"]
        assert "no se publica" in h.lower() or "prohibido" in h.lower()
        assert "identificar" in h

    def test_el_contexto_de_demanda_va_etiquetado_aparte(self, agregado):
        h = agregado["html"]
        assert "marca-verificado" in h
        assert agregado["json"]["contexto_demanda"]["etiqueta"] in h

    def test_ningun_color_literal_fuera_del_bloque_generado(self, cuerpo):
        assert not re.findall(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)", cuerpo)

    def test_sin_scripts(self, agregado):
        assert "<script" not in agregado["html"]

    def test_lleva_su_estampa(self, agregado):
        h, d = agregado["html"], agregado["json"]
        assert d["edicion_id"] in h and d["version_formula"] in h and d["fecha_calculo"] in h
        assert "huella de entradas" in h

    def test_declara_que_los_datos_son_sinteticos(self, agregado):
        assert estilo.AVISO_SINTETICOS[0] in agregado["html"]


class TestNoMedido:
    def test_un_hallazgo_no_publicable_dice_no_medido_y_conserva_su_numero(
        self, corrida_minima, marca
    ):
        d = leer_anonimo(corrida_minima["edicion"], corrida_minima["salida"])
        html = render_agregado.render(d, marca)
        no_publicables = [h for h in corrida_minima["json"]["hallazgos"] if not h["publicable"]]
        assert no_publicables, "el fixture mínimo debe traer hallazgos no publicables"
        assert "No medido en esta edición" in html
        # Siguen los siete: no se omite la sección.
        numeros = re.findall(r'<span class="h-num[^"]*">(\d{2})</span>', html)
        assert numeros == ["01", "02", "03", "04", "05", "06", "07"]

    def test_no_se_estima_ni_se_interpola(self, corrida_minima, marca):
        d = leer_anonimo(corrida_minima["edicion"], corrida_minima["salida"])
        html = render_agregado.render(d, marca)
        assert "estimad" not in html.lower()
        assert "aproximad" not in html.lower()
