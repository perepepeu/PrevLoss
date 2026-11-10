"""Executa a ponte de integração em um Uvicorn real no loopback."""

import argparse
import json
import platform
import socket
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def porta_livre():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def verificar(porta, processo):
    base = f"http://127.0.0.1:{porta}"
    registros = []

    def enviar(rota, *, corpo=None, esperado=200, registrar=True):
        pedido = Request(base + rota)
        if corpo is not None:
            pedido.data = json.dumps(corpo).encode()
            pedido.add_header("Content-Type", "application/json")
        try:
            resposta = urlopen(pedido, timeout=4)
        except HTTPError as exc:
            resposta = exc
        with resposta:
            status = resposta.status
            assert status == esperado, (rota, status, esperado, resposta.read())
            dados = resposta.read()
        if registrar:
            registros.append({"metodo": pedido.get_method(), "rota": rota, "status": status})
        return dados if rota == "/docs" else json.loads(dados)

    fim = time.monotonic() + 15
    while True:
        if processo.poll() is not None:
            raise RuntimeError(f"Uvicorn encerrou com código {processo.returncode}.")
        try:
            saude = enviar("/api/saude")
            break
        except URLError:
            if time.monotonic() > fim:
                raise
            time.sleep(0.1)

    assert b"SwaggerUIBundle" in enviar("/docs")
    assert len(enviar("/openapi.json")["paths"]) == 12
    assert len(enviar("/api/cenarios")) == 5
    assert enviar("/api/configuracao")["referencia"] is None
    inicial = enviar("/api/estado")
    assert inicial["estado_simulacao"] == "parada"
    erro = enviar("/api/reiniciar", corpo={"seed": 42}, esperado=409)
    assert erro["erro"]["codigo"] == "REFERENCIA_AUSENTE"
    assert enviar("/api/estado") == inicial

    coleta = enviar("/api/iniciar", corpo={})["execucao_atual_id"]
    fim = time.monotonic() + 90
    while True:
        estado = enviar("/api/estado", registrar=False)
        if estado["calibracao"]["estado"] == "concluida":
            break
        assert time.monotonic() < fim, estado
        time.sleep(0.25)

    assert estado["calibracao"]["coletadas"] == 60
    assert estado["estado_simulacao"] == "pausada"
    normal = enviar("/api/iniciar", corpo={})["execucao_atual_id"]
    assert normal != coleta
    fim = time.monotonic() + 10
    while enviar("/api/estado", registrar=False)["ultima_leitura"] is None:
        assert time.monotonic() < fim
        time.sleep(0.1)

    pausa = enviar("/api/pausar", corpo={})
    time.sleep(1.1)
    assert enviar("/api/estado") == pausa
    aquecimento = enviar("/api/cenario", corpo={"cenario": "aquecimento"})["execucao_atual_id"]
    assert enviar(f"/api/historico?execucao_id={aquecimento}")["itens"] == []
    assert len(enviar(f"/api/historico?execucao_id={coleta}")["itens"]) == 60
    leitura = enviar(f"/api/historico?execucao_id={normal}&limite=1")["itens"][0]
    assert leitura["ise"] == 100 and leitura["classificacao"] == "Normal"
    assert leitura["referencia_id"] == pausa["calibracao"]["referencia_id"]
    reiniciada = enviar("/api/reiniciar", corpo={"seed": 42})["execucao_atual_id"]
    assert reiniciada != aquecimento
    assert enviar("/api/execucoes")["execucoes"][-1]["seed"] == 42
    assert enviar(f"/api/eventos?execucao_id={normal}")["itens"]
    enviar("/api/cenario", corpo={"cenario": "normal"})
    recalibrada = enviar("/api/recalibrar", corpo={"seed": 42})
    assert recalibrada["calibracao"]["referencia_id"] is None
    assert enviar(f"/api/historico?execucao_id={normal}&limite=1")["itens"][0] == leitura
    invalida = enviar("/api/cenario", corpo={"cenario": "x"}, esperado=422)
    assert invalida["erro"]["codigo"] == "ENTRADA_INVALIDA"

    return {
        "resultado": "aprovado", "data_hora": datetime.now(UTC).isoformat(),
        "ambiente": platform.platform(), "python": platform.python_version(),
        "versao_software": saude["versao_software"], "porta_loopback": porta,
        "sessao_id": pausa["sessao_id"], "referencia_id": leitura["referencia_id"],
        "seed": 42, "execucao_calibracao_id": coleta, "execucao_normal_id": normal,
        "execucao_aquecimento_id": aquecimento, "calibracao_coletadas": 60, "normal_primeiro_ise": leitura["ise"],
        "chamadas_verificadas": registros,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidencia", type=Path, help="Arquivo JSON para registrar a execução.")
    args = parser.parse_args()
    porta = porta_livre()
    comando = [
        sys.executable, "-m", "uvicorn", "backend.app.main:app",
        "--host", "127.0.0.1", "--port", str(porta), "--workers", "1", "--no-access-log",
    ]
    flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
    with subprocess.Popen(comando, creationflags=flags) as processo:
        try:
            relatorio = verificar(porta, processo)
        finally:
            if processo.poll() is None:
                processo.terminate()
                try:
                    processo.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    processo.kill()
                    processo.wait(timeout=5)
    texto = json.dumps(relatorio, ensure_ascii=False, indent=2) + "\n"
    if args.evidencia:
        args.evidencia.write_text(texto, encoding="utf-8", newline="\n")
    print(texto, end="")


if __name__ == "__main__":
    main()
