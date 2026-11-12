# Validação técnica e passagem para Caíque

| Item | Registro |
| --- | --- |
| Data local | 10/11/2026, América/São Paulo |
| Versão e commit do backend | `0.1.0`, `83faeedd51dd104afb7fa6ad84133046fd7d11a0` |
| Ambiente | Windows 11 x64 build 26200, Python 3.13.15, uv 0.12.6 |
| Dependências do cálculo | NumPy 2.4.2, FastAPI 0.135.1, Pydantic 2.12.5 |
| Testes automáticos | 81 aprovados, 0 falhas na execução final |
| Ponte HTTP com Uvicorn | Aprovada. 12 rotas distintas da API, incluindo casos 409 e 422 |
| Integração com dashboard e execução por Pedro | Pendente de validação com os dois desenvolvedores |

## Comandos executados

```powershell
uv sync --locked
uv run --locked pytest -q
uv run --locked pytest -q tests/test_scoring.py -k limites_classificacao
uv run --locked python -m tools.gerar_entrega
npx --yes openapi-typescript@7.10.1 docs/openapi.json --output docs/contrato-v1.d.ts
npx --yes --package typescript@5.9.3 tsc --noEmit --strict docs/contrato-v1.d.ts
uv run --locked python -m tools.verificar_http --evidencia docs/evidencias/ponte-http.json
```

A [saída do pytest](evidencias/pytest.txt) inclui os oito casos diretos de limites. O [registro HTTP](evidencias/ponte-http.json) conserva sessão, IDs da coleta e dos testes, seed, referência, chamadas e status. O [registro dos cenários](evidencias/cenarios-seed42.json) inclui estatísticas, IDs, tempos observados e alertas. Reexportar fixtures gera novos IDs e horários.

## 120 leituras por cenário, seed 42

Os valores abaixo são tempos simulados de primeira ocorrência. `—` significa que o evento ou a classe não ocorreu no recorte. As cinco execuções usaram a mesma referência congelada e um fluxo de teste separado da calibração.

| Cenário | Primeira perda | Primeira Atenção | Primeiro Crítico | ISE mínimo / final | Aberturas de alerta |
| --- | ---: | ---: | ---: | ---: | --- |
| Normal | — | — | — | 100 / 100 | Nenhuma |
| Aquecimento | 17 s | 32 s | — | 75 / 75 | Temperatura, 22 s |
| Vibração elevada | 17 s | 30 s | — | 70 / 70 | Vibração, 19 s |
| Pressão instável | 11 s | — | — | 80 / 80 | Nível de pressão, 13 s. Oscilação de janela, 14 s |
| Múltiplos desvios | 17 s | 22 s | 30 s | 25 / 25 | Vibração e pressão, 19 s. Temperatura, 22 s |

## Nove respostas

1. **Versão.** Backend `0.1.0`, contrato `1`, commit de código `83faeed`.
2. **Seed e ambiente.** Calibração e teste usaram 42 com domínios RNG 0 e 1. A reprodução usa o Python e o `uv.lock` da entrega.
3. **Cenários.** As cinco fórmulas e parâmetros estão em [CENARIOS.md](CENARIOS.md).
4. **Pesos efetivos.** Temperatura 0,25, vibração 0,30, corrente 0,25 e pressão 0,20.
5. **Referência.** 60 leituras Normais válidas, desvio-padrão populacional. Na evidência da seed 42, as médias foram 44,9466 °C, 1,4995 m/s², 8,0058 A e 2,9984 bar. As médias completas, desvios e o ID estão no [JSON](evidencias/cenarios-seed42.json).
6. **Duração e tempos.** 120 leituras de teste por cenário após a coleta. A tabela registra primeira perda, primeira mudança de classe e abertura por critério, verificadas em testes determinísticos.
7. **Limites.** Rode `uv run --locked pytest -q tests/test_scoring.py -k limites_classificacao`. A função de classificação é testada diretamente em 0, 49,99, 50, 50,01, 79,99, 80, 80,01 e 100.
8. **Histórico.** Em memória, por sessão e execução. Consultas retornam leituras em ordem de sequência e referências antigas permanecem associadas aos registros.
9. **Alertas.** Três avaliações válidas consecutivas abrem ou recuperam. A oscilação usa dez valores consecutivos e o limiar `max(3 × σref, 0,20 bar)`. Invalidade zera contadores e janela e mantém os alertas existentes. A troca de execução encerra com motivo explícito.

## Matriz técnica de aceitação

Os itens abaixo são verificações do guia de Emerson, registradas na entrega original. Atualização da integração de Pedro: a revisão de Caíque está disponível em [ALTERACAO.pdf](referencias/ALTERACAO.pdf), e a correspondência das 12 verificações originais foi conferida em [MATRIZ_CAIQUE.md](MATRIZ_CAIQUE.md). Os resultados do dashboard são registrados separadamente em [ENTREGA_PEDRO.md](ENTREGA_PEDRO.md).

| Nº | Verificação | Resultado observado | Status |
| --- | --- | --- | --- |
| 01 | Inicialização e saúde | Uvicorn iniciou em loopback. GET retornou 200 e a versão | Aprovado |
| 02 | Calibração estatística | Progresso 24/60 na fixture. Entrada inválida não contou. Concluiu com 60 válidas | Aprovado |
| 03 | Fluxos e seed | Reexecução com seed 42 reproduziu os valores. Trechos de calibração e teste diferiram | Aprovado |
| 04 | Cinco cenários | 120 leituras por cenário e resultados da tabela | Aprovado |
| 05 | Fórmula e fronteiras | 8 limites, razões 0/1/2/4 e dispersão zero. Exemplo manual produziu ISE 85 e perda 15 | Aprovado |
| 06 | Dado inadequado | Null, NaN, infinito e extremo produziram ISE indisponível sem redistribuição | Aprovado |
| 07 | Alertas individuais | Abriu na terceira violação. Recuperou na terceira leitura válida dentro do limite. ISE Normal preservou alerta | Aprovado |
| 08 | Oscilação de pressão | Exigiu janela de 10 e três avaliações. Invalidade limpou janela sem fechar alerta | Aprovado |
| 09 | Controles e concorrência | GET não gerou leituras. Pausa e início idempotentes. 100 avanços concorrentes mantiveram a sequência | Aprovado |
| 10 | Histórico, eventos e referência | Paginação preservou ordem. Troca, reinício e recalibração mantiveram o passado | Aprovado |
| 11 | Contrato e erros | OpenAPI exportado igual ao da API. 18 fixtures validadas. Erros 409/422 sem mutação e 500 legível via CORS | Aprovado |
| 12 | Integração com o dashboard real | Ponte HTTP executada localmente. Roteiro de Pedro e conexão com a interface ainda pendentes | Bloqueado |

A revisão independente reproduziu falha de concorrência no tratamento de erro do trabalhador, mutação parcial ao falhar o relógio na pausa e ausência do cabeçalho CORS no erro 500. O commit de backend acima corrige os três casos. Os retestes cobrem as condições reproduzidas.

## Passagem para Pedro

1. Siga o [README](../README.md) e consulte saúde.
2. Execute o [roteiro HTTP](CONTRATO.md) e confirme coleta, início do Normal, troca de cenário, históricos separados e erros.
3. Compare o dashboard com as fixtures e depois conecte à API real. Registre versão, referência e execução usadas. Confirme contrato, pesos e parâmetros com Emerson antes de marcar a integração aprovada.
