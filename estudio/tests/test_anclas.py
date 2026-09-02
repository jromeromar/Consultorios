"""Las anclas son fijas y encodifican la dirección. Nada aquí depende de la muestra."""
import math

import pytest

from calcular import a_escala


def ind(**kw):
    base = {"transformacion": "lineal", "a0": 0, "a100": 100}
    base.update(kw)
    return base


class TestEscala:
    def test_lineal_interpola_entre_las_anclas(self):
        i = ind(a0=0, a100=100)
        assert a_escala(0, i) == 0
        assert a_escala(50, i) == 50
        assert a_escala(100, i) == 100

    def test_las_anclas_encodifican_la_direccion(self):
        # a100 menor que a0: el indicador mejora al bajar. No hace falta un
        # campo de dirección aparte, así que no puede desincronizarse.
        i = ind(transformacion="log", a0=1440, a100=5)
        assert a_escala(5, i) == 100
        assert a_escala(1440, i) == 0
        assert a_escala(60, i) == pytest.approx(57.7, abs=0.1)

    def test_el_ejemplo_del_encargo(self):
        # «100 puntos a los 5 minutos y 0 a las 24 horas, interpolando en medio»
        i = ind(transformacion="log", a0=1440, a100=5)
        assert a_escala(5, i) == 100
        assert a_escala(1440, i) == 0
        assert 0 < a_escala(120, i) < 100

    def test_recorta_fuera_de_las_anclas(self):
        i = ind(transformacion="log", a0=1440, a100=5)
        assert a_escala(1, i) == 100          # más rápido que la ancla
        assert a_escala(100_000, i) == 0      # más lento que la ancla

    def test_log_da_resolucion_donde_la_lineal_la_aplasta(self):
        log = ind(transformacion="log", a0=1440, a100=5)
        lin = ind(transformacion="lineal", a0=1440, a100=5)
        # Contestar en 5 o en 30 minutos son mundos distintos para el paciente.
        # En escala lineal sobre [5, 1440] esa diferencia es de menos de dos
        # puntos; en logarítmica es un orden de magnitud mayor.
        salto_log = a_escala(5, log) - a_escala(30, log)
        salto_lin = a_escala(5, lin) - a_escala(30, lin)
        assert salto_lin < 2
        assert salto_log > 10 * salto_lin

    def test_booleano_de_tres_estados(self):
        i = ind(transformacion="booleano")
        assert a_escala(True, i) == 100
        assert a_escala("si", i) == 100
        assert a_escala(False, i) == 0
        assert a_escala("no", i) == 0
        assert a_escala("no_observado", i) is None
        assert a_escala("", i) is None

    def test_mapa_puntua_por_valor(self):
        i = ind(transformacion="mapa", mapa={"reserva": 100, "whatsapp": 70, "ninguno": 0})
        assert a_escala("reserva", i) == 100
        assert a_escala("whatsapp", i) == 70
        assert a_escala("ninguno", i) == 0
        assert a_escala("desconocido", i) is None

    def test_declarado_no_puntua(self):
        assert a_escala(4_200_000, ind(transformacion="ninguna")) is None


class TestAusenciaNoEsCero:
    @pytest.mark.parametrize("vacio", [None, "", "n/a", "nd", "-", "no_observado", "no_dice"])
    def test_un_ausente_devuelve_none_y_no_cero(self, vacio):
        assert a_escala(vacio, ind(transformacion="lineal", a0=0, a100=100)) is None
        assert a_escala(vacio, ind(transformacion="booleano")) is None

    def test_el_cero_de_verdad_si_puntua_cero(self):
        # Distinguir «cero medido» de «sin medir» es la regla, en los dos sentidos.
        assert a_escala(0, ind(a0=0, a100=100)) == 0
