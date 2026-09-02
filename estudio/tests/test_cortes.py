"""
Un corte se publica solo si todos sus grupos llegan al mínimo. Un corte por
ciudad individual no se publica nunca. Una estadística no publicable no se
renderiza: el documento imprime «no medido en esta edición» y sigue.
"""


class TestCortes:
    def test_el_corte_nacional_se_publica(self, corrida):
        assert corrida["json"]["cortes"]["nacional"]["publicable"] is True

    def test_el_corte_por_tipo_de_ciudad_se_publica_con_esta_muestra(self, corrida):
        c = corrida["json"]["cortes"]["tipo_ciudad"]
        assert c["publicable"] is True
        assert all(n >= c["minimo_grupo"] for n in c["grupos"].values())

    def test_el_corte_por_municipio_no_se_publica_nunca(self, corrida):
        c = corrida["json"]["cortes"]["municipio"]
        assert c["publicable"] is False
        assert "prohibido" in c["motivo"]

    def test_el_corte_por_municipio_sigue_prohibido_aunque_hubiera_muestra(self, corrida):
        # La regla no depende del n: es de identificabilidad.
        c = corrida["json"]["cortes"]["municipio"]
        assert "identificar" in c["motivo"]

    def test_el_cruce_de_segundo_nivel_no_alcanza(self, corrida):
        c = corrida["json"]["cortes"]["franja_x_tipo_ciudad"]
        assert c["publicable"] is False
        assert "mínimo" in c["motivo"]
        assert min(c["grupos"].values()) < c["minimo_grupo"]

    def test_cada_dimension_por_separado_si_alcanza(self, corrida):
        # Es lo que hace informativo al cruce que falla: no es que falten datos
        # en general, es que un cruce de segundo nivel pide mucho más.
        cortes = corrida["json"]["cortes"]
        assert cortes["franja"]["publicable"] is True
        assert cortes["tipo_ciudad"]["publicable"] is True
        assert cortes["franja_x_tipo_ciudad"]["publicable"] is False


class TestFixtureMinimo:
    def test_con_treinta_consultorios_casi_nada_alcanza(self, corrida_minima):
        d = corrida_minima["json"]
        no_publicables = [k for k, v in d["estadisticas"].items() if not v["publicable"]]
        assert len(no_publicables) >= 5, "el fixture mínimo existe para ejercitar este camino"

    def test_el_corte_por_tipo_de_ciudad_no_alcanza(self, corrida_minima):
        assert corrida_minima["json"]["cortes"]["tipo_ciudad"]["publicable"] is False

    def test_los_hallazgos_afectados_quedan_no_publicables(self, corrida_minima):
        hallazgos = corrida_minima["json"]["hallazgos"]
        assert any(not h["publicable"] for h in hallazgos)
        # Y siguen estando: no se omite la sección, se imprime que no se midió.
        assert len(hallazgos) == 7

    def test_ninguna_estadistica_no_publicable_trae_un_valor_estimado(self, corrida_minima):
        for k, v in corrida_minima["json"]["estadisticas"].items():
            if not v["publicable"] and v["corte"] != "nacional":
                assert v["valor"] is None, f"{k} no es publicable pero trae un valor"
