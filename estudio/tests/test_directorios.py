"""
Los directorios médicos, y la regla que más fácil se rompe al añadirlos.

Un directorio puede rechazar la lectura. Cuando eso pasa no se sabe nada del
perfil, y el error de convertir ese silencio en un cero le pondría al
consultorio una falta que no se observó. La misma regla que rige todo el censo,
en el sitio donde es más tentador saltársela.
"""

import csv
import shutil

import pytest

from calcular import Censo, valores_crudos
from tests.conftest import RAIZ, _correr


@pytest.fixture(scope="module")
def censo():
    return Censo(RAIZ / "datos", "prueba")


@pytest.fixture(scope="module")
def crudos(censo):
    return {cid: valores_crudos(censo, cid) for cid in censo.ids}


class TestCatalogo:
    def test_ningun_directorio_sin_base_de_observacion_revisada(self, censo):
        """No hay forma de registrar un directorio sin decir con qué derecho se lee."""
        assert censo.directorios, "el catálogo está vacío"
        for did, d in censo.directorios.items():
            assert d["base_observacion"] in (
                "pagina_publica", "api_autorizada", "acuerdo_escrito",
            ), did
            assert d["fecha_revision_terminos"], did


class TestBloqueadoNoEsCero:
    def test_una_lectura_bloqueada_no_deja_fila(self, censo):
        """
        Los perfiles indexados son solo los leídos. Un bloqueado no entra, así
        que no puede bajarle la proporción a nadie.
        """
        filas = list(csv.DictReader(open(RAIZ / "datos" / "directorio_perfil_snapshot.csv")))
        bloqueados = {
            (f["consultorio_id"], f["directorio_id"])
            for f in filas if f["estado_perfil"] not in ("ok", "sin_perfil")
        }
        assert bloqueados, "los datos de prueba no traen ninguna lectura bloqueada"
        for cid, did in bloqueados:
            assert did not in censo.dir_perfil.get(cid, {}), f"{cid}/{did} entró bloqueado"

    def test_quien_no_tiene_ninguna_lectura_va_nulo_y_no_cero(self, censo, crudos):
        for cid in censo.ids:
            if not censo.dir_perfil.get(cid):
                assert crudos[cid]["perfil_directorio_completo"] is None, cid

    def test_sin_perfil_si_es_un_cero_medido(self, censo, crudos):
        """
        Buscar y no encontrar perfil es una observación: cuenta y vale cero. Es
        el caso que distingue esta tabla de un fallo de captura.
        """
        cero = [
            cid for cid in censo.ids
            if censo.dir_perfil.get(cid)
            and all(
                p["estado_perfil"] == "sin_perfil" for p in censo.dir_perfil[cid].values()
            )
        ]
        assert cero, "los datos de prueba no traen a nadie sin perfil en ningún directorio"
        for cid in cero:
            assert crudos[cid]["perfil_directorio_completo"] == 0, cid


class TestUnPerfilQueNoExisteNoTieneCalificacionMala:
    def test_no_tener_perfil_deja_la_calificacion_nula(self, censo, crudos):
        for cid in censo.ids:
            perfiles = censo.dir_perfil.get(cid, {})
            if perfiles and not any(
                (p.get("existe") or "").lower() == "true" for p in perfiles.values()
            ):
                assert crudos[cid]["calificacion_directorio"] is None, cid

    def test_no_salir_en_el_buscador_no_es_la_ultima_posicion(self, censo, crudos):
        for cid in censo.ids:
            if not censo.dir_ranking.get(cid):
                assert crudos[cid]["posicion_directorio"] is None, cid


class TestDenominadores:
    def test_el_denominador_de_perfiles_son_los_leidos(self, censo):
        from calcular import Poblaciones
        pob = Poblaciones(censo, {})
        assert set(pob.con_directorio_leido) == set(censo.dir_perfil)

    def test_ninguna_cifra_de_directorio_sale_sin_su_denominador(self, corrida):
        ind = corrida["json"]["indicadores"]
        for clave in ("perfil_directorio_completo", "posicion_directorio",
                      "calificacion_directorio"):
            assert clave in ind, clave
            assert ind[clave]["denominador"], clave
            assert ind[clave]["n"] is not None, clave


class TestPosicionLlevaSuTotal:
    def test_toda_fila_de_orden_declara_cuantos_resultados_hubo(self):
        """
        La posición 8 de 9 y la 8 de 200 no son el mismo hecho. La columna es
        obligatoria en el esquema y aquí se comprueba que los datos la traen.
        """
        filas = list(csv.DictReader(open(RAIZ / "datos" / "directorio_ranking.csv")))
        assert filas
        for f in filas:
            total = int(f["resultados_total"])
            assert total > 0
            assert int(f["posicion"]) <= total, f


class TestSinDatosDeDirectorio:
    def test_la_corrida_no_se_cae_si_no_hay_directorios(self, tmp_path):
        """
        Una edición anterior a los directorios tiene que seguir calculando: los
        indicadores salen no medidos, no en cero.
        """
        datos = tmp_path / "datos"
        shutil.copytree(RAIZ / "datos", datos)
        for t in ("directorio", "directorio_perfil_snapshot", "directorio_ranking"):
            (datos / f"{t}.csv").unlink()
        d = _correr(datos, tmp_path / "sal")
        for clave in ("perfil_directorio_completo", "calificacion_directorio",
                      "posicion_directorio"):
            assert d["indicadores"][clave]["n"] == 0, clave
            assert d["indicadores"][clave]["mediana"] is None, clave
