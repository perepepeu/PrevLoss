import math

import pytest

from backend.app.session_service import Sessao
from backend.app.simulator import Simulador


@pytest.mark.parametrize(("cenario", "campo", "efeito"), [
    ("aquecimento", "temperatura_c", 0.15),
    ("vibracao_elevada", "vibracao_rms_ms2", 0.025),
    ("pressao_instavel", "pressao_bar", 0.6 * math.sin(math.pi / 4)),
    ("multiplos_desvios", "pressao_bar", -0.02),
])
def test_cenarios_iniciam_desvio_depois_de_dez_segundos(cenario, campo, efeito):
    normal = Simulador(42, "teste")
    desvio = Simulador(42, "teste")
    for t in range(1, 11):
        assert desvio(cenario, t) == normal("normal", t)
    assert desvio(cenario, 11)[campo] - normal("normal", 11)[campo] == pytest.approx(efeito)


@pytest.mark.parametrize(("cenario", "classe", "alerta"), [
    ("normal", "Normal", None),
    ("aquecimento", "Atenção", ("DESVIO_INDIVIDUAL", "temperatura")),
    ("vibracao_elevada", "Atenção", ("DESVIO_INDIVIDUAL", "vibracao")),
    ("pressao_instavel", "Normal", ("PRESSAO_INSTAVEL", "pressao")),
    ("multiplos_desvios", "Crítico", ("DESVIO_INDIVIDUAL", "vibracao")),
])
def test_cenario_em_120_leituras(cenario, classe, alerta):
    sessao = Sessao()
    sessao.iniciar()
    for _ in range(60):
        sessao.avancar()
    sessao.selecionar(cenario)
    execucao = sessao.iniciar().execucao_atual_id
    leituras = [sessao.avancar() for _ in range(120)]
    assert len(leituras) == 120
    assert leituras[-1].classificacao == classe
    assert all(0 <= leitura.ise <= 100 for leitura in leituras)
    aberturas = [(e.alerta.codigo, e.alerta.variavel) for e in sessao.eventos(execucao).itens
                 if e.tipo == "alerta_aberto"]
    if alerta is None:
        assert aberturas == []
    else:
        assert alerta in aberturas
