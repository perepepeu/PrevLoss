import json
from pathlib import Path

import pytest
from pydantic import TypeAdapter

from backend.app.main import criar_app
from backend.app.schemas import (
    Configuracao, EnvelopeErro, Estado, Eventos, Execucoes, InfoCenario, PaginaHistorico, Saude,
)

DOCS = Path(__file__).resolve().parents[1] / "docs"


def ler(caminho):
    return json.loads((DOCS / caminho).read_text(encoding="utf-8"))


def test_openapi_exportado_corresponde_a_api():
    assert ler("openapi.json") == criar_app(gerar=False).openapi()


@pytest.mark.parametrize(("nome", "modelo"), [
    ("estado-inicial", Estado), ("calibracao-24-de-60", Estado), ("normal", Estado),
    ("atencao", Estado), ("critico", Estado), ("normal-com-alerta-individual", Estado),
    ("dado-ausente", Estado), ("dado-invalido", Estado), ("pausa", Estado),
    ("execucao-nova-pausada", Estado), ("historico", PaginaHistorico),
    ("historico-vazio", PaginaHistorico), ("erro", EnvelopeErro), ("configuracao", Configuracao),
    ("execucoes", Execucoes), ("eventos", Eventos), ("cenarios", list[InfoCenario]), ("saude", Saude),
])
def test_fixture_usa_modelo_da_resposta(nome, modelo):
    TypeAdapter(modelo).validate_python(ler(f"fixtures/{nome}.json"))


def test_exemplos_preservam_semantica_de_qualidade_e_alertas():
    calibrando = ler("fixtures/calibracao-24-de-60.json")
    assert calibrando["calibracao"]["coletadas"] == 24
    assert calibrando["ultima_leitura"]["ise"] is None
    com_alerta = ler("fixtures/normal-com-alerta-individual.json")
    assert com_alerta["ultima_leitura"]["ise"] == 85
    assert com_alerta["alertas_ativos"][0]["variavel"] == "vibracao"
    for nome, qualidade in [("dado-ausente", "ausente"), ("dado-invalido", "invalida")]:
        leitura = ler(f"fixtures/{nome}.json")["ultima_leitura"]
        assert leitura["qualidade_dados"] == qualidade
        assert leitura["ise"] is leitura["classificacao"] is None
