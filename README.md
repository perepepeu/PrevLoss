# prevLoss

Protótipo local de monitoramento simulado de uma bomba. A API gera quatro medidas em cinco cenários, calcula referência estatística e ISE e mantém alertas e histórico da sessão. O dashboard React em `frontend/` permite operar a simulação, acompanhar gráficos e consultar execuções anteriores.

## Dashboard de Pedro

Siga [o guia de instalação, operação e apresentação](docs/DASHBOARD.md). A interface usa `http://127.0.0.1:5173` tanto em desenvolvimento quanto na apresentação, e a API usa `http://127.0.0.1:8000`.

Depois de preparar as dependências, mantenha o backend aberto pelo comando abaixo e, em outro terminal na pasta `frontend`, execute `npm run build` e `npm run preview`. Para desenvolver, use `npm run dev` no lugar do preview.

- [Matriz das 12 verificações originais de Caíque](docs/MATRIZ_CAIQUE.md)
- [Revisão original disponibilizada localmente](docs/referencias/ALTERACAO.pdf)
- [Entrega, verificações e evidências do frontend](docs/ENTREGA_PEDRO.md)

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

- [Relatório da entrega de Emerson e estado atual](docs/ENTREGA_EMERSON.md)
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
