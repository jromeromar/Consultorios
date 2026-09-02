"""
Aritmética del puntaje y de los percentiles, contra valores conocidos.

`C-0001` tiene los 23 indicadores puntuables en la ancla de 100 y `C-0002` en la
de 0. Esa segunda fila prueba además la regla más delicada: no respondió, así
que sus cuatro indicadores de conversación van nulos y no en cero, y el bloque
de respuesta queda en 0 por su único indicador medido.
"""
import pytest

from calcular import percentil, rango_percentil, spearman


class TestPercentil:
    def test_interpola_linealmente(self):
        xs = list(range(1, 11))
        assert percentil(xs, 50) == 5.5
        assert percentil(xs, 10) == pytest.approx(1.9)
        assert percentil(xs, 90) == pytest.approx(9.1)

    def test_un_solo_valor(self):
        assert percentil([7], 50) == 7

    def test_lista_vacia_no_inventa(self):
        assert percentil([], 50) is None


class TestRangoPercentil:
    def test_rango_medio_con_empates_masivos(self):
        # Un indicador booleano produce dos montones. Cualquier método que no
        # sea el rango medio le regala el percentil 100 a todo el grupo alto.
        poblacion = [0] * 60 + [100] * 40
        assert rango_percentil(0, poblacion) == 30
        assert rango_percentil(100, poblacion) == 80

    def test_el_maximo_no_llega_a_cien(self):
        assert rango_percentil(10, list(range(1, 11))) == 95

    def test_poblacion_vacia_no_inventa(self):
        assert rango_percentil(5, []) is None


class TestSpearman:
    def test_monotona_perfecta(self):
        assert spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]) == pytest.approx(1.0)
        assert spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]) == pytest.approx(-1.0)

    def test_promedia_los_rangos_empatados(self):
        assert spearman([1, 1, 2, 3], [1, 1, 2, 3]) == pytest.approx(1.0)

    def test_muestra_muy_chica_no_devuelve_nada(self):
        assert spearman([1, 2], [2, 1]) is None


class TestControles:
    def test_el_control_de_arriba_puntua_cien_en_todo(self, reportes):
        r = reportes["C-0001"]
        assert r["general"]["puntaje"] == 100
        for bloque, d in r["bloques"].items():
            assert d["puntaje"] == 100, bloque
        assert r["bloques_no_medidos"] == []

    def test_el_control_de_abajo_puntua_cero_donde_midio(self, reportes):
        r = reportes["C-0002"]
        for bloque in ("visibilidad", "reputacion", "contenido", "reservabilidad"):
            assert r["bloques"][bloque]["puntaje"] == 0, bloque

    def test_el_control_de_abajo_no_responde_y_eso_deja_nulos(self, reportes):
        r = reportes["C-0002"]
        ind = r["indicadores"]
        assert ind["hubo_respuesta"]["puntaje"] == 0
        for clave in ("minutos_primera_respuesta", "ofrecio_agendar", "dio_precio",
                      "seguimiento_espontaneo"):
            assert ind[clave]["puntaje"] is None, clave
        # El bloque puntúa 0 por el único indicador que sí se midió, no por los nulos.
        assert r["bloques"]["respuesta"]["puntaje"] == 0

    def test_el_cero_medido_y_el_no_medido_se_distinguen(self, reportes):
        ind = reportes["C-0002"]["indicadores"]
        # No apareció en el paquete local: cero legítimo, su municipio se midió.
        assert ind["presencia_paquete_local"]["puntaje"] == 0
        # Y por eso mismo no tiene posición: eso es no medido, no cero.
        assert ind["posicion_paquete_local"]["puntaje"] is None

    def test_el_control_de_arriba_queda_en_el_decimo_superior(self, reportes):
        assert reportes["C-0001"]["general"]["percentil"] >= 90
        assert reportes["C-0001"]["general"]["banda"]["nombre"] == "décimo superior"

    def test_las_bandas_se_nombran_por_cuartil(self, reportes):
        nombres = {r["general"]["banda"]["nombre"] for r in reportes.values() if r["general"]["banda"]}
        assert nombres <= {"cuartil inferior", "segundo cuartil", "tercer cuartil",
                           "cuarto cuartil", "décimo superior"}


class TestBloquesYGeneral:
    def test_el_general_pondera_con_los_pesos_de_la_formula(self, reportes, formula):
        pesos = {b["id"]: b["peso"] for b in formula["bloques"]}
        for cid, r in reportes.items():
            items = [(r["bloques"][b]["puntaje"], pesos[b]) for b in pesos
                     if r["bloques"][b]["puntaje"] is not None]
            if not items:
                assert r["general"]["puntaje"] is None
                continue
            total = sum(p for _v, p in items)
            esperado = sum(v * p for v, p in items) / total
            assert r["general"]["puntaje"] == pytest.approx(esperado, abs=0.02), cid

    def test_un_bloque_sin_datos_no_hunde_el_general(self, reportes):
        # Los que no tienen Instagram no tienen bloque de contenido, y su general
        # se calcula sobre los cuatro bloques que sí se midieron.
        sin_contenido = [r for r in reportes.values() if "contenido" in r["bloques_no_medidos"]]
        assert sin_contenido
        for r in sin_contenido:
            assert r["bloques"]["contenido"]["puntaje"] is None
            assert r["general"]["puntaje"] is not None

    def test_el_percentil_sale_de_la_distribucion_de_la_edicion(self, corrida, reportes):
        # El puntaje es absoluto; el percentil es lo relativo. Se comprueba que
        # el percentil de un puntaje conocido es el que la distribución implica.
        general = corrida["json"]["distribucion_general"]
        assert general["n"] == corrida["json"]["poblaciones"]["universo"]
        puntajes = sorted(r["general"]["puntaje"] for r in reportes.values()
                          if r["general"]["puntaje"] is not None)
        alguno = reportes["C-0001"]
        esperado = rango_percentil(alguno["general"]["puntaje"], puntajes)
        # El percentil publicado se calcula sobre el universo entero, que incluye
        # a los no medidos con puntaje; el de los reportes es un subconjunto.
        assert alguno["general"]["percentil"] >= esperado - 5
