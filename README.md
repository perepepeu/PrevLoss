# prevLoss

Backend do protótipo local de monitoramento simulado de uma bomba. A API gera quatro medidas em cinco cenários, calcula referência estatística e ISE e mantém alertas e histórico da sessão.

## Iniciar

Com [uv](https://docs.astral.sh/uv/getting-started/installation/) instalado, execute na raiz:

```powershell
uv python install 3.13.15
uv sync --locked
uv run --locked uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Abra [a documentação da API](http://127.0.0.1:8000/docs) ou consulte `GET /api/saude` em `http://127.0.0.1:8000`.

1. Envie `{}` para `POST /api/iniciar`. A referência coleta 60 leituras válidas de Normal, em cerca de um minuto.
2. Consulte `GET /api/estado`. Com a calibração concluída, chame `POST /api/iniciar` novamente para iniciar o teste Normal em outra execução.
3. Pause com `POST /api/pausar` e selecione um cenário com `POST /api/cenario`. A seleção prepara uma execução pausada. Chame `POST /api/iniciar` para rodá-la.

## Integração e testes

- [Instalação, CORS e importação da branch](docs/INSTALACAO.md)
- [Roteiro HTTP, respostas e integração para Pedro](docs/CONTRATO.md)
- [Contrato v1](docs/contrato-v1.md), [OpenAPI](docs/openapi.json), [tipos TypeScript](docs/contrato-v1.d.ts) e [fixtures](docs/fixtures/)
- [Regras de cálculo](docs/REGRAS.md), [cenários](docs/CENARIOS.md) e [limitações](docs/LIMITACOES.md)
- [Evidências e respostas para Caíque](docs/TESTES.md) e [roteiro de apresentação](docs/APRESENTACAO.md)

```powershell
uv run --locked pytest -q
uv run --locked python -m tools.verificar_http
```

O segundo comando inicia um servidor em loopback e verifica o fluxo real, incluindo a coleta de cerca de um minuto. A integração com o dashboard fica sujeita à validação de Emerson e Pedro.
