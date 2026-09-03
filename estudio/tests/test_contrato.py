"""
El contrato entre textos.yaml y el motor, y la coherencia de formula.yaml.

Si un hallazgo declara una estadística que el motor no emite, la corrida falla:
es mejor que imprimir un hueco vacío en un documento que se va a imprenta.
"""
import re

import pytest


class TestFormula:
    def test_los_pesos_de_bloque_suman_uno(self, formula):
        assert sum(b["peso"] for b in formula["bloques"]) == pytest.approx(1.0)

    def test_los_pesos_de_cada_bloque_suman_uno(self, formula):
        for b in formula["bloques"]:
            ind = [i for i in formula["indicadores"]
                   if i["bloque"] == b["id"] and i.get("puntua", True)]
            assert sum(i["peso"] for i in ind) == pytest.approx(1.0), b["id"]

    def test_los_bloques_van_en_el_orden_del_recorrido(self, formula):
        assert [b["paso"] for b in formula["bloques"]] == [1, 2, 3, 4, 5]
        assert [b["id"] for b in formula["bloques"]] == [
            "visibilidad", "reputacion", "contenido", "respuesta", "reservabilidad"
        ]

    def test_todo_indicador_declara_un_denominador_admitido(self, formula):
        admitidos = set(formula["denominadores"])
        for i in formula["indicadores"]:
            assert i["denominador"] in admitidos, i["id"]

    def test_los_declarados_no_puntuan(self, formula):
        declarados = [i for i in formula["indicadores"] if not i.get("puntua", True)]
        assert len(declarados) == 3, "precio de lista, cobro de primera cita y consultas al mes"
        for i in declarados:
            assert i["peso"] == 0
            assert i["transformacion"] == "ninguna"

    def test_las_anclas_estan_completas_donde_hacen_falta(self, formula):
        for i in formula["indicadores"]:
            if i["transformacion"] in ("lineal", "log"):
                assert "a0" in i and "a100" in i, i["id"]
                assert i["a0"] != i["a100"], i["id"]
            if i["transformacion"] == "mapa":
                assert i.get("mapa"), i["id"]


class TestTextos:
    def test_hay_siete_hallazgos(self, textos):
        assert len(textos["hallazgos"]) == 7

    def test_cada_hallazgo_lleva_su_linea_de_que_no_dice(self, textos):
        for h in textos["hallazgos"]:
            assert h.get("no_dice", "").strip(), h["id"]

    def test_hay_exactamente_un_contra_hallazgo(self, textos):
        contra = [h for h in textos["hallazgos"] if h.get("contra_hallazgo")]
        assert len(contra) == 1

    def test_los_cinco_bloques_aparecen_en_los_hallazgos(self, textos, formula):
        bloques = {h["bloque"] for h in textos["hallazgos"]}
        assert bloques == {b["id"] for b in formula["bloques"]}

    def test_ningun_numero_vive_en_los_textos(self, textos):
        """
        Los títulos llevan huecos, no cifras. Un número escrito a mano en
        textos.yaml sería una cifra que el motor no puede desmentir.
        """
        for h in textos["hallazgos"]:
            for campo in ("titulo", "lede"):
                texto = h[campo]
                sin_huecos = re.sub(r"\{\w+\}", "", texto)
                numeros = re.findall(r"\b\d[\d.,]*\b", sin_huecos)
                assert not numeros, f"{h['id']}.{campo} trae cifras a mano: {numeros}"

    def test_los_huecos_de_los_textos_se_resuelven(self, corrida):
        for h in corrida["json"]["hallazgos"]:
            for campo in ("titulo", "lede"):
                assert "«sin dato»" not in h[campo], f"{h['id']}.{campo}"
                assert not re.search(r"\{\w+\}", h[campo]), f"{h['id']}.{campo}"


class TestContratoMotorTextos:
    @staticmethod
    def _declaradas(textos: dict) -> set[str]:
        """
        Toda superficie que publica cifras declara las que usa: los hallazgos,
        las de apoyo del titular y la ficha de método, que publica el corte por
        tipo de ciudad con el tamaño de cada grupo.
        """
        usadas = {e for h in textos["hallazgos"] for e in h["estadisticas"]}
        usadas |= {a["estadistica"] for a in textos["titular"]["apoyo"]}
        usadas |= set(textos["metodo"].get("estadisticas", []))
        return usadas

    def test_toda_estadistica_declarada_existe_en_el_json(self, textos, corrida):
        emitidas = set(corrida["json"]["estadisticas"])
        faltan = self._declaradas(textos) - emitidas
        assert not faltan, f"el motor no emite: {sorted(faltan)}"

    def test_toda_estadistica_emitida_se_usa(self, textos, corrida):
        # Una estadística que nadie publica es peso muerto que puede quedar
        # desactualizada sin que nada falle.
        emitidas = set(corrida["json"]["estadisticas"])
        assert not (emitidas - self._declaradas(textos)), \
            f"nadie usa: {sorted(emitidas - self._declaradas(textos))}"

    def test_las_comprobaciones_pasan_con_este_fixture(self, corrida):
        no_concluyentes = [h["id"] for h in corrida["json"]["hallazgos"] if not h["concluyente"]]
        assert not no_concluyentes, f"comprobación fallida en {no_concluyentes}"

    def test_el_contra_hallazgo_se_sostiene(self, corrida):
        contra = [h for h in corrida["json"]["hallazgos"] if h["contra_hallazgo"]]
        assert len(contra) == 1
        assert contra[0]["publicable"] and contra[0]["concluyente"]

    def test_el_json_lleva_su_estampa(self, corrida):
        d = corrida["json"]
        for clave in ("edicion_id", "version_formula", "fecha_calculo", "huella_entradas"):
            assert d.get(clave), clave
        # 15 = las 12 originales más las tres de directorios. El número va a
        # mano a propósito: si una entrada nueva no se estampa, la estampa deja
        # de describir la corrida y la reproducibilidad se rompe en silencio.
        assert len(d["huella_entradas"]) == 15
        assert all(len(v) == 64 for v in d["huella_entradas"].values())

    def test_la_ficha_tecnica_sale_de_edicion_estudio(self, corrida):
        f = corrida["json"]["ficha_tecnica"]
        for clave in ("nombre", "campo_inicio", "campo_fin", "corte_reloj_horas",
                      "n_universo", "n_medidos", "n_respondio", "n_ciudades"):
            assert f.get(clave) is not None, clave
