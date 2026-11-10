# prevLoss — Entrega do backend de Emerson

- **Data** 10 de novembro de 2026
- **Versão do backend** 0.1.0
- **Contrato** v1
- **Branch de entrega** `emerson/backend-v1`

## Estado atual

O backend está implementado e validado localmente em Windows 11. Pedro já pode rodar a API e integrar o dashboard usando o contrato, o OpenAPI, os tipos TypeScript e os exemplos JSON. A aprovação da integração depende de executar o roteiro com a interface real e confirmar os parâmetros didáticos com a equipe.

## Trabalho realizado

| Etapa | Entrega |
| --- | --- |
| E1 · Base e contrato | Partimos do commit `52adfe2`, que continha o README inicial. Criamos a branch de trabalho, o contrato v1 e o ambiente com Python 3.13.15, FastAPI, Pydantic, NumPy e dependências fixadas no `uv.lock`. |
| E2 · Sessão e API | Implementamos um trabalhador de geração no backend, estado com revisão crescente, IDs e datas com fuso, além dos controles de iniciar e pausar. A cadência é de aproximadamente um segundo, e as consultas apenas leem o estado. |
| E3 · Calibração | A referência estatística é congelada após 60 leituras válidas em Normal. O teste usa outra execução e outro fluxo aleatório. Ao concluir a coleta, a API prepara o teste Normal pausado para início explícito. |
| E4 · Avaliação | Implementamos pontuação por variável, ISE ponderado, classificação e contribuição de perda com empates. Dados obrigatórios ausentes ou inválidos deixam o índice e a classificação indisponíveis. |
| E5 · Simulação | Implementamos Normal, Aquecimento, Vibração elevada, Pressão instável e Múltiplos desvios, com temperatura em °C, vibração RMS em m/s², corrente em A e pressão em bar. A seed padrão é 42. |
| E6 · Alertas | Implementamos persistência de três avaliações para desvio individual e oscilação de pressão em janela de dez leituras. Alertas podem coexistir com ISE Normal. A API expõe critério, sequência, valor observado e hipótese de inspeção. |
| E7 · Execuções e erros | Implementamos troca de cenário, reinício, recalibração, eventos e histórico paginado por execução. A revisão reproduziu e a implementação corrigiu três falhas em concorrência, atomicidade da pausa e CORS para respostas 500. |
| E8 · Passagem | Publicamos instruções de instalação, exemplos para as 12 rotas, OpenAPI, tipos TypeScript, 18 fixtures, evidências, matriz de aceitação, respostas para Caíque e roteiro de apresentação. |

O código fica em `backend/app/`, os testes em `tests/` e os roteiros reproduzíveis em `tools/`. As fórmulas, o comportamento dos controles e os parâmetros ficam na documentação do projeto. [Regras](REGRAS.md) · [Cenários](CENARIOS.md) · [Contrato v1](contrato-v1.md)

## Verificação realizada

- **81 testes automatizados aprovados**, incluindo as oito fronteiras de classificação, a coerência entre OpenAPI e API e a validação das 18 fixtures. A suíte também passou numa cópia extraída do ZIP. [Saída dos testes](evidencias/pytest.txt)
- **12 rotas exercitadas via HTTP em Uvicorn**, incluindo calibração com a cadência real, início do Normal em execução separada, pausa, troca de cenário, históricos independentes e respostas 409 e 422. [Registro HTTP](evidencias/ponte-http.json)
- **120 leituras por cenário com seed 42.** No Normal, o ISE ficou em 100 e nenhum alerta abriu. A pressão instável abriu alerta de oscilação aos 14 s simulados com ISE classificado como Normal. Múltiplos desvios entraram em Crítico aos 30 s simulados. [Resultados dos cinco cenários](TESTES.md) · [Evidência JSON](evidencias/cenarios-seed42.json)

O commit de código registrado nas evidências é `83faeed`. O commit `454f834` reuniu o backend, os testes e o pacote de integração que antecedeu este relatório.

## Como iniciar e integrar

Na raiz do repositório, com `uv` instalado:

```powershell
uv python install 3.13.15
uv sync --locked
uv run --locked uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Consulte `GET /api/saude`. Para o primeiro fluxo, chame `POST /api/iniciar` com `{}`, aguarde `calibracao.estado` ficar `concluida` e chame `iniciar` novamente. Depois, confira pausa, troca de cenário e histórico por ID de execução. [Instalação e CORS](INSTALACAO.md) · [Roteiro HTTP](CONTRATO.md)

Para montar o adaptador, use os exemplos completos e os tipos gerados. Na validação conjunta, rode o mesmo fluxo com o dashboard conectado ao backend. [OpenAPI](openapi.json) · [Tipos TypeScript](contrato-v1.d.ts) · [Fixtures](fixtures/)

## Pendências e limites

- **Pedro e Emerson:** executar o roteiro com o dashboard real, conferir o contrato e aprovar os parâmetros didáticos antes de congelar a integração.
- **Caíque:** conferir a matriz com as 12 verificações originais quando `ALTERACAO.pdf` estiver disponível. Os resultados técnicos desta entrega constam em [TESTES.md](TESTES.md).
- **Operação:** o histórico fica em memória durante o processo. A validação executada cobre Windows 11. O protótipo representa uma bomba simulada, e os resultados medem o comportamento do software nos cenários programados. [Limitações](LIMITACOES.md)
