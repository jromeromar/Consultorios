"""
El sistema maneja varios denominadores y confundirlos es el error más fácil de
cometer y el más difícil de detectar después. Estas pruebas fijan las tres
reglas: denominador obligatorio y declarado, mínimo mecánico, y no_observado
fuera del numerador y del denominador.
"""
import pytest

from calcular import Motor


@pytest.fixture
def motor(formula, textos):
    return Motor(formula, textos)


class TestSobreObligatorio:
    def test_rechaza_un_denominador_no_declarado(self, motor):
        with pytest.raises(ValueError, match="no está declarado"):
            motor.est(10, "minutos", n=100, denominador="los_que_me_caen_bien")

    def test_todo_sobre_lleva_n_y_denominador(self, motor):
        e = motor.est(221, "minutos", n=89, denominador="respondieron")
        assert e["n"] == 89
        assert e["denominador"] == "respondieron"
        assert "publicable" in e and "no_observado_n" in e

    def test_la_forma_del_sobre_es_la_del_encargo(self, motor):
        e = motor.est(221, "minutos", n=89, denominador="respondieron", no_observado_n=23)
        for clave in ("valor", "unidad", "n", "denominador", "no_observado_n", "publicable"):
            assert clave in e


class TestMinimoMecanico:
    def test_bajo_el_minimo_no_es_publicable(self, motor):
        assert motor.est(5, "dias", n=motor.minimo - 1, denominador="medidos")["publicable"] is False

    def test_en_el_minimo_si_es_publicable(self, motor):
        assert motor.est(5, "dias", n=motor.minimo, denominador="medidos")["publicable"] is True

    def test_un_valor_nulo_nunca_es_publicable(self, motor):
        # Aunque el n alcance: no hay nada que publicar y no se estima.
        assert motor.est(None, "dias", n=500, denominador="medidos")["publicable"] is False


class TestDosDenominadoresDistintos:
    def test_medidos_y_respondieron_no_son_lo_mismo(self, corrida):
        p = corrida["json"]["poblaciones"]
        assert p["medidos"] > p["respondieron"], "quien no contestó no puede contar como que contestó"

    def test_cada_estadistica_declara_cual_usa(self, corrida):
        E = corrida["json"]["estadisticas"]
        declarados = set(corrida["json"]["denominadores"])
        for clave, e in E.items():
            assert e["denominador"] in declarados, clave
            assert isinstance(e["n"], int), clave

    def test_la_mediana_de_respuesta_va_sobre_los_que_respondieron(self, corrida):
        d = corrida["json"]
        e = d["estadisticas"]["respuesta.mediana_minutos"]
        assert e["denominador"] == "respondieron"
        assert e["n"] == d["poblaciones"]["respondieron"]

    def test_la_distribucion_de_tiempos_va_sobre_los_medidos(self, corrida):
        # El total del gráfico son los medidos, porque incluye la cubeta de los
        # que no respondieron. La mediana del mismo hallazgo va sobre otro
        # denominador, y el documento lo dice.
        d = corrida["json"]
        e = d["estadisticas"]["respuesta.distribucion_minutos"]
        assert e["denominador"] == "medidos"
        assert sum(c["n"] for c in e["valor"]) == d["poblaciones"]["medidos"]

    def test_la_cubeta_sin_respuesta_cuadra_con_la_diferencia(self, corrida):
        d = corrida["json"]
        cubetas = {c["etiqueta"]: c["n"] for c in d["estadisticas"]["respuesta.distribucion_minutos"]["valor"]}
        assert cubetas["Sin respuesta"] == d["poblaciones"]["medidos"] - d["poblaciones"]["respondieron"]


class TestNoObservado:
    def test_sale_del_numerador_y_del_denominador(self, corrida, reportes):
        """
        Un consultorio con `ofrecio_agendar = no_observado` no puede contar como
        uno que no ofreció agendar. Se comprueba sobre los reportes: su puntaje
        de ese indicador tiene que ser nulo, no cero.
        """
        no_observados = [
            r for r in reportes.values()
            if r["indicadores"]["ofrecio_agendar"]["crudo"] == "no_observado"
        ]
        assert no_observados, "el fixture debe traer casos de no_observado"
        for r in no_observados:
            assert r["indicadores"]["ofrecio_agendar"]["puntaje"] is None
            assert r["indicadores"]["ofrecio_agendar"]["texto"] == "no observado"

    def test_no_responder_deja_nulos_los_indicadores_de_conversacion(self, reportes):
        sin_respuesta = [
            r for r in reportes.values()
            if r["indicadores"]["hubo_respuesta"]["puntaje"] == 0
        ]
        assert sin_respuesta
        for r in sin_respuesta:
            for clave in ("minutos_primera_respuesta", "ofrecio_agendar", "dio_precio"):
                assert r["indicadores"][clave]["puntaje"] is None, (
                    "quien no respondió no puede puntuar cero en una conducta que "
                    "solo se observa dentro de una conversación"
                )

    def test_un_error_de_rastreo_no_es_un_no_tiene(self, corrida, reportes):
        # Los indicadores de sitio se calculan sobre los rastreos con estado ok.
        d = corrida["json"]
        assert d["poblaciones"]["con_sitio_rastreado"] < d["poblaciones"]["universo"]
        e = d["estadisticas"]["reservabilidad.sin_reserva_online_prop"]
        assert e["denominador"] == "con_sitio_rastreado"
        assert e["n"] <= d["poblaciones"]["con_sitio_rastreado"]
