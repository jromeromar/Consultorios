"""
Anonimato por construcción, no por disciplina.

El JSON de edición es lo único que lee el informe agregado, así que no puede
contener un nombre propio de consultorio. Y el lector anónimo revienta si alguien
pide uno.
"""
import csv
import json
from pathlib import Path

import pytest

from lectura import CAMPOS_IDENTIFICABLES, MapaAnonimo, PermisoAnonimato, leer_anonimo

RAIZ = Path(__file__).resolve().parent.parent


class TestLectorAnonimo:
    def test_revienta_al_pedir_un_campo_identificable(self):
        m = MapaAnonimo({"puntaje": 41})
        for clave in ("nombre_comercial", "telefono_e164", "dominio", "consultorio_id"):
            with pytest.raises(PermisoAnonimato, match="lector anónimo"):
                m[clave]

    def test_una_clave_normal_ausente_es_un_keyerror_corriente(self):
        with pytest.raises(KeyError):
            MapaAnonimo({})["no_existe"]

    def test_el_error_dice_cual_es_el_lector_correcto(self):
        try:
            MapaAnonimo({})["nombre_comercial"]
        except PermisoAnonimato as e:
            assert "leer_identificado" in str(e)

    def test_envuelve_hacia_dentro(self, corrida):
        d = leer_anonimo(corrida["edicion"], corrida["salida"])
        with pytest.raises(PermisoAnonimato):
            d["ficha_tecnica"]["nombre_comercial"]


class TestElJsonAgregadoNoTieneNombres:
    def test_ninguna_clave_identificable_aparece_en_el_json(self, corrida):
        crudo = json.dumps(corrida["json"], ensure_ascii=False)
        encontradas = [c for c in CAMPOS_IDENTIFICABLES if f'"{c}"' in crudo]
        assert not encontradas, f"el JSON agregado trae claves identificables: {encontradas}"

    def test_ningun_nombre_de_consultorio_aparece_en_el_json(self, corrida):
        nombres = {
            f["nombre_comercial"]
            for f in csv.DictReader(open(RAIZ / "datos" / "consultorio_snapshot.csv", encoding="utf-8"))
            if f.get("nombre_comercial")
        }
        crudo = json.dumps(corrida["json"], ensure_ascii=False)
        filtrados = [n for n in nombres if n in crudo]
        assert not filtrados, f"nombres filtrados al agregado: {filtrados[:5]}"

    def test_ningun_telefono_ni_dominio_aparece_en_el_json(self, corrida):
        crudo = json.dumps(corrida["json"], ensure_ascii=False)
        for f in csv.DictReader(open(RAIZ / "datos" / "consultorio_snapshot.csv", encoding="utf-8")):
            for campo in ("telefono_e164", "dominio", "instagram_handle"):
                v = f.get(campo)
                if v:
                    assert v not in crudo, f"{campo} filtrado: {v}"

    def test_ningun_consultorio_id_aparece_en_el_json(self, corrida):
        crudo = json.dumps(corrida["json"], ensure_ascii=False)
        assert "C-0001" not in crudo and "C-0002" not in crudo

    def test_las_ciudades_si_van_con_nombre(self, corrida):
        # El encargo lo permite explícitamente: consultorios nunca, ciudades sí.
        ciudades = corrida["json"]["ficha_tecnica"]["ciudades"]
        assert any(c["nombre"] for c in ciudades)


class TestLosReportesSiEstanIdentificados:
    def test_el_reporte_individual_lleva_nombre_y_municipio(self, reportes):
        r = reportes["C-0001"]
        assert r["nombre_comercial"]
        assert r["municipio"]
        assert r["consultorio_id"] == "C-0001"

    def test_hay_un_reporte_por_consultorio_medido(self, corrida, reportes):
        assert len(reportes) == corrida["json"]["poblaciones"]["medidos"]
