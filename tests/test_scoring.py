import math

import pytest

from backend.app.config import VARIAVEIS
from backend.app.scoring import avaliar, classificar_ise, nota_por_razao, validar
from backend.app.schemas import Estatistica, Estatisticas, Medidas


@pytest.mark.parametrize(
    ("ise", "esperado"),
    [(0, "Crítico"), (49.99, "Crítico"), (50, "Atenção"), (50.01, "Atenção"),
     (79.99, "Atenção"), (80, "Normal"), (80.01, "Normal"), (100, "Normal")],
)
def test_limites_classificacao(ise, esperado):
    assert classificar_ise(ise) == esperado


@pytest.mark.parametrize("ise", [-1, 101, math.nan, math.inf])
def test_rejeita_ise_invalido(ise):
    with pytest.raises(ValueError):
        classificar_ise(ise)


@pytest.mark.parametrize(("r", "nota"), [(0, 100), (1, 100), (2, 200 / 3), (4, 0), (500, 0)])
def test_fronteiras_da_nota(r, nota):
    assert nota_por_razao(r) == pytest.approx(nota)


@pytest.mark.parametrize(("valor", "qualidade", "codigo"), [
    (None, "ausente", "AUSENTE"), (math.nan, "invalida", "NAO_FINITO"),
    (math.inf, "invalida", "NAO_FINITO"), (-math.inf, "invalida", "NAO_FINITO"),
    (10**500, "invalida", "FORA_DA_FAIXA_NUMERICA"),
    ("45", "invalida", "NAO_NUMERICO"), (True, "invalida", "NAO_NUMERICO"),
])
def test_invalidez_nao_vaza_ao_json(valor, qualidade, codigo):
    medidas, estado, motivos = validar({"temperatura_c": valor, "vibracao_rms_ms2": 1.5,
                                       "corrente_a": 8.0, "pressao_bar": 3.0})
    assert estado == qualidade
    assert [(m.variavel, m.codigo) for m in motivos] == [("temperatura", codigo)]
    assert medidas.temperatura_c is None
    assert medidas.vibracao_rms_ms2 == 1.5


def referencia_constante():
    return Estatisticas(**{
        nome: Estatistica(media=regra.base, desvio_padrao=0)
        for nome, regra in VARIAVEIS.items()
    })


def test_pontuacao_manual_com_dispersao_zero():
    resultado = avaliar(Medidas(temperatura_c=30, vibracao_rms_ms2=1.875, corrente_a=8, pressao_bar=3),
                       referencia_constante())
    assert resultado.pontuacoes.model_dump() == pytest.approx(
        {"temperatura": 100, "vibracao": 50, "corrente": 100, "pressao": 100}
    )
    assert resultado.ise == pytest.approx(85)
    assert resultado.classificacao == "Normal"
    assert resultado.perdas.principais == ("vibracao",)
    assert resultado.perdas.por_variavel.vibracao == pytest.approx(15)


def test_perdas_empatadas_e_sem_desvios():
    ref = referencia_constante()
    empates = avaliar(Medidas(temperatura_c=50, vibracao_rms_ms2=1.5, corrente_a=6, pressao_bar=3), ref)
    normal = avaliar(Medidas(temperatura_c=45, vibracao_rms_ms2=1.5, corrente_a=8, pressao_bar=3), ref)
    assert empates.perdas.principais == ("temperatura", "corrente")
    assert empates.ise == 50
    assert normal.perdas.principais == ()
    assert normal.ise == 100


def test_dado_obrigatorio_ausente_sem_redistribuicao():
    resultado = avaliar(Medidas(temperatura_c=None, vibracao_rms_ms2=1.5, corrente_a=8, pressao_bar=3),
                       referencia_constante())
    assert resultado.pontuacoes.corrente == 100
    assert resultado.pontuacoes.temperatura is None
    assert resultado.ise is resultado.classificacao is resultado.perdas is None
