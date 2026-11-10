import time

import pytest
from fastapi.testclient import TestClient

from backend.app.main import criar_app
from backend.app.session_service import Sessao


@pytest.fixture
def api():
    sessao = Sessao()
    with TestClient(criar_app(sessao, gerar=False)) as client:
        yield client, sessao


def test_ponte_roteiro_api_e_openapi(api):
    client, sessao = api
    assert client.get("/api/saude").json() == {"status": "ok", "versao_software": "0.1.0"}
    assert client.get("/api/estado").json()["ultima_leitura"] is None
    assert len(client.get("/api/cenarios").json()) == 5
    config = client.get("/api/configuracao").json()
    assert config["pesos"] == {"temperatura": .25, "vibracao": .30, "corrente": .25, "pressao": .20}
    assert config["referencia"] is None
    assert client.get("/api/execucoes").json() == {"execucoes": [], "referencias": []}
    assert client.get("/api/eventos").json()["itens"] == []
    coleta = client.post("/api/iniciar", json={}).json()["execucao_atual_id"]
    for _ in range(60):
        sessao.avancar()
    normal = client.post("/api/iniciar", json={}).json()["execucao_atual_id"]
    assert normal != coleta
    sessao.avancar()
    assert client.post("/api/pausar", json={}).json()["estado_simulacao"] == "pausada"
    troca = client.post("/api/cenario", json={"cenario": "aquecimento"}).json()
    assert troca["cenario_selecionado"] == "aquecimento"
    assert client.get("/api/historico", params={"execucao_id": normal}).json()["itens"][0]["ise"] == 100
    assert client.get("/api/historico", params={"execucao_id": troca["execucao_atual_id"]}).json()["itens"] == []
    nova = client.post("/api/reiniciar", json={"seed": 7}).json()["execucao_atual_id"]
    assert nova != troca["execucao_atual_id"]
    assert client.get("/api/execucoes").json()["execucoes"][-1]["seed"] == 7
    client.post("/api/cenario", json={"cenario": "normal"})
    assert client.post("/api/recalibrar", json={"seed": 17}).json()["calibracao"]["estado"] == "em_andamento"
    contrato = client.get("/openapi.json").json()
    assert len(contrato["paths"]) == 12
    assert contrato["paths"]["/api/reiniciar"]["post"]["responses"]["422"]["content"][
        "application/json"]["schema"]["$ref"].endswith("/EnvelopeErro")


@pytest.mark.parametrize(("method", "route", "payload", "status", "codigo"), [
    ("POST", "/api/reiniciar", {"seed": 42}, 409, "REFERENCIA_AUSENTE"),
    ("POST", "/api/cenario", {"cenario": "falha"}, 422, "ENTRADA_INVALIDA"),
    ("POST", "/api/iniciar", {"extra": True}, 422, "ENTRADA_INVALIDA"),
    ("POST", "/api/recalibrar", {"seed": -1}, 422, "ENTRADA_INVALIDA"),
    ("POST", "/api/recalibrar", {"seed": 2**32}, 422, "ENTRADA_INVALIDA"),
    ("POST", "/api/recalibrar", {"seed": True}, 422, "ENTRADA_INVALIDA"),
    ("GET", "/api/historico?execucao_id=x&limite=1001", None, 422, "ENTRADA_INVALIDA"),
    ("GET", "/api/historico?execucao_id=x", None, 404, "EXECUCAO_INEXISTENTE"),
    ("GET", "/api/iniciar", None, 405, "METODO_INCORRETO"),
])
def test_erros_padronizados_sem_mutacao(api, method, route, payload, status, codigo):
    client, _ = api
    estado = client.get("/api/estado").json()
    response = client.request(method, route, json=payload)
    assert response.status_code == status
    assert set(response.json()) == {"erro"}
    assert response.json()["erro"]["codigo"] == codigo
    assert client.get("/api/estado").json() == estado


def test_cors_loopback(api):
    client, _ = api
    response = client.options("/api/iniciar", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"
    })
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_lifespan_gera_sem_get_e_respeita_pausa():
    sessao = Sessao()
    with TestClient(criar_app(sessao, intervalo_s=.01)) as client:
        client.post("/api/iniciar", json={})
        limite = time.monotonic() + 2
        while sessao.estado().calibracao.coletadas < 3 and time.monotonic() < limite:
            time.sleep(.01)
        assert sessao.estado().calibracao.coletadas >= 3
        pausa = client.post("/api/pausar", json={}).json()
        time.sleep(.06)
        assert client.get("/api/estado").json() == pausa
