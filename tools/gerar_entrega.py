"""Exporta OpenAPI, fixtures de integração e resultados medidos dos cenários."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.config import CENARIOS, LEITURAS_CALIBRACAO, LEITURAS_ROTEIRO, SEED_PADRAO, VERSAO_SOFTWARE
from backend.app.main import criar_app
from backend.app.session_service import Sessao

ROOT = Path(__file__).resolve().parents[1]
BASE = dict(temperatura_c=45.0, vibracao_rms_ms2=1.5, corrente_a=8.0, pressao_bar=3.0)


def salvar(destino, valor):
    arquivo = ROOT / "docs" / destino
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    conteudo = json.dumps(valor, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    arquivo.write_text(conteudo, encoding="utf-8", newline="\n")


def fixture(nome, valor):
    salvar(f"fixtures/{nome}.json", valor)


def corpo(resposta, status=200):
    assert resposta.status_code == status, resposta.text
    return resposta.json()


def gerar_cenarios():
    sessao = Sessao()
    resultados = []
    with TestClient(criar_app(sessao, gerar=False)) as client:
        salvar("openapi.json", corpo(client.get("/openapi.json")))
        for nome in ("saude", "cenarios"):
            fixture(nome, corpo(client.get(f"/api/{nome}")))
        fixture("estado-inicial", corpo(client.get("/api/estado")))
        fixture("erro", corpo(client.post("/api/reiniciar", json={"seed": SEED_PADRAO}), 409))
        coleta = corpo(client.post("/api/iniciar", json={}))["execucao_atual_id"]
        for _ in range(24):
            sessao.avancar()
        fixture("calibracao-24-de-60", corpo(client.get("/api/estado")))
        for _ in range(LEITURAS_CALIBRACAO - 24):
            sessao.avancar()

        configuracao = corpo(client.get("/api/configuracao"))
        fixture("configuracao", configuracao)
        for cenario in CENARIOS:
            selecionada = corpo(client.post("/api/cenario", json={"cenario": cenario.id}))
            execucao_id = selecionada["execucao_atual_id"]
            if cenario.id == "aquecimento":
                fixture("execucao-nova-pausada", selecionada)
            if cenario.id == "normal":
                fixture("historico-vazio", corpo(client.get("/api/historico", params={"execucao_id": execucao_id})))
            corpo(client.post("/api/iniciar", json={}))

            primeira_classe = {}
            primeira_perda = None
            menor = 100.0
            for _ in range(LEITURAS_ROTEIRO):
                leitura = sessao.avancar()
                assert leitura is not None and leitura.ise is not None
                menor = min(menor, leitura.ise)
                if leitura.ise < 100 and primeira_perda is None:
                    primeira_perda = leitura.tempo_simulado_s
                if leitura.classificacao not in primeira_classe:
                    primeira_classe[leitura.classificacao] = leitura.tempo_simulado_s
                    if leitura.classificacao == "Atenção" and cenario.id == "aquecimento":
                        fixture("atencao", corpo(client.get("/api/estado")))
                    if leitura.classificacao == "Crítico" and cenario.id == "multiplos_desvios":
                        fixture("critico", corpo(client.get("/api/estado")))
                if leitura.sequencia == 1 and cenario.id == "normal":
                    fixture("normal", corpo(client.get("/api/estado")))

            pausa = corpo(client.post("/api/pausar", json={}))
            eventos = corpo(client.get("/api/eventos", params={"execucao_id": execucao_id}))
            if cenario.id == "normal":
                fixture("pausa", pausa)
                fixture("historico", corpo(client.get("/api/historico", params={
                    "execucao_id": execucao_id, "limite": 2,
                })))
            if cenario.id == "multiplos_desvios":
                fixture("eventos", eventos)
            resultados.append({
                "cenario": cenario.id, "execucao_id": execucao_id, "seed": SEED_PADRAO,
                "leituras": LEITURAS_ROTEIRO, "ise_minimo": menor, "ise_final": leitura.ise,
                "classificacao_final": leitura.classificacao, "primeira_perda_s": primeira_perda,
                "primeira_classificacao_s": primeira_classe,
                "aberturas": [
                    {"codigo": e["alerta"]["codigo"], "variavel": e["alerta"]["variavel"],
                     "tempo_simulado_s": e["sequencia"], "data_hora": e["data_hora"]}
                    for e in eventos["itens"] if e["tipo"] == "alerta_aberto"
                ],
            })

        fixture("execucoes", corpo(client.get("/api/execucoes")))
        return {
            "versao_software": VERSAO_SOFTWARE,
            "sessao_id": sessao.estado().sessao_id,
            "calibracao_id": coleta, "referencia": configuracao["referencia"], "resultados": resultados,
        }


def gerar_dados_controlados():
    valores = BASE.copy()
    sessao = Sessao(fabrica=lambda seed, tipo: lambda cenario, tempo: valores.copy())
    with TestClient(criar_app(sessao, gerar=False)) as client:
        corpo(client.post("/api/iniciar", json={}))
        for _ in range(LEITURAS_CALIBRACAO):
            sessao.avancar()
        corpo(client.post("/api/iniciar", json={}))
        valores["vibracao_rms_ms2"] = 1.875
        for _ in range(3):
            sessao.avancar()
        fixture("normal-com-alerta-individual", corpo(client.get("/api/estado")))
        valores["corrente_a"] = None
        sessao.avancar()
        fixture("dado-ausente", corpo(client.get("/api/estado")))
        valores["corrente_a"] = float("nan")
        sessao.avancar()
        fixture("dado-invalido", corpo(client.get("/api/estado")))


def main():
    relatorio = gerar_cenarios()
    gerar_dados_controlados()
    salvar("evidencias/cenarios-seed42.json", relatorio)
    print("OpenAPI, fixtures e evidência de 5 × 120 leituras exportados.")
    for c in relatorio["resultados"]:
        print(c["cenario"], c["primeira_classificacao_s"], c["primeira_perda_s"],
              [(a["codigo"], a["variavel"], a["tempo_simulado_s"]) for a in c["aberturas"]][:8])


if __name__ == "__main__":
    main()
