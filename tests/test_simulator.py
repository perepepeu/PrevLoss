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


@pytest.mark.parametrize(("cenario", "classe", "perda", "atencao", "critico", "aberturas"), [
    ("normal", "Normal", None, None, None, []),
    ("aquecimento", "Atenção", 17, 32, None, [("DESVIO_INDIVIDUAL", "temperatura", 22)]),
    ("vibracao_elevada", "Atenção", 17, 30, None, [("DESVIO_INDIVIDUAL", "vibracao", 19)]),
    ("pressao_instavel", "Normal", 11, None, None, [
        ("DESVIO_INDIVIDUAL", "pressao", 13), ("PRESSAO_INSTAVEL", "pressao", 14),
    ]),
    ("multiplos_desvios", "Crítico", 17, 22, 30, [
        ("DESVIO_INDIVIDUAL", "vibracao", 19), ("DESVIO_INDIVIDUAL", "pressao", 19),
        ("DESVIO_INDIVIDUAL", "temperatura", 22),
    ]),
])
def test_cenario_em_120_leituras(cenario, classe, perda, atencao, critico, aberturas):
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
    assert next((r.sequencia for r in leituras if r.ise < 100), None) == perda
    assert next((r.sequencia for r in leituras if r.classificacao == "Atenção"), None) == atencao
    assert next((r.sequencia for r in leituras if r.classificacao == "Crítico"), None) == critico
    assert [(e.alerta.codigo, e.alerta.variavel, e.sequencia) for e in sessao.eventos(execucao).itens
            if e.tipo == "alerta_aberto"] == aberturas
