# Contrato prevLoss v1

Proposta para validação de Emerson e Pedro. As rotas usam JSON, retornam o envelope completo nas mutações bem-sucedidas e expõem os modelos em `/openapi.json`. Os exemplos completos em [fixtures](fixtures/) são versionados junto ao contrato. A [referência de integração](CONTRATO.md) documenta chamadas e paginação.

Salvo indicação de `| null`, os campos de resposta são obrigatórios e não nulos. Listas sem itens são `[]`. Número significa valor finito. Identificadores são strings UUID opacas e datas são ISO 8601 com fuso UTC. Segundos simulados são inteiros, começam em 0 e avançam de 1 em 1 por execução. Valores de pontuação e ISE são transmitidos com a precisão do cálculo. A apresentação pode arredondar sem reclassificar.

## Estado e calibração

| Campo | Tipo | Origem, unidade e exemplo |
| --- | --- | --- |
| versao_contrato | string | Contrato, `"1"` |
| versao_software | string | Versão do pacote, `"0.1.0"` |
| sessao_id | string | ID do processo de sessão |
| revisao_estado | inteiro | Contador de mudanças observáveis, `24` |
| estado_simulacao | enum | Serviço, `parada`, `executando` ou `pausada` |
| cenario_selecionado | enum | Escolha, `normal`, `aquecimento`, `vibracao_elevada`, `pressao_instavel` ou `multiplos_desvios` |
| calibracao | objeto | Estado da referência corrente, descrito abaixo |
| execucao_atual_id | string ou null | ID da execução selecionada |
| ultima_leitura | Leitura ou null | Último registro da execução selecionada |
| alertas_ativos | Alerta[] | Alertas ativos da execução selecionada |

`calibracao.estado` é `nao_iniciada`, `em_andamento` ou `concluida`. `coletadas` e `necessarias` são contagens inteiras de leituras válidas (ex. 24 e 60). `referencia_id` é o ID da referência corrente ou null.

## Leitura

| Campo | Tipo | Origem, unidade e exemplo |
| --- | --- | --- |
| sessao_id, execucao_id | string | IDs gerados pelo serviço |
| referencia_id | string ou null | ID da referência usada na avaliação |
| sequencia | inteiro ≥ 1 | Posição na execução, `1` |
| data_hora | string ISO 8601 | Instante real com fuso, `2026-11-10T12:00:01Z` |
| tempo_simulado_s | inteiro ≥ 1 | Relógio em segundos simulados, `1` |
| cenario | enum | Cenário da execução, `normal` |
| temperatura_c | número ou null | Simulador, °C, `45.2` |
| vibracao_rms_ms2 | número ou null | Simulador, m/s² RMS de aceleração, `1.52` |
| corrente_a | número ou null | Simulador, A, `8.1` |
| pressao_bar | número ou null | Simulador, bar, `3.02` |
| qualidade_dados | enum | Validação, `valida`, `ausente` ou `invalida` |
| motivos_qualidade | MotivoQualidade[] | `variavel` identifica a variável. `codigo` é `AUSENTE`, `NAO_NUMERICO`, `NAO_FINITO` ou `FORA_DA_FAIXA_NUMERICA` |
| pontuacoes | Pontos | Notas por variável, `100` ou null |
| ise | número 0–100 ou null | Soma ponderada das quatro notas, `85` |
| classificacao | enum ou null | `Normal`, `Atenção`, `Crítico` |
| motivo_indisponibilidade | enum ou null | `REFERENCIA_AUSENTE`, `DADOS_AUSENTES` ou `DADOS_INVALIDOS` |
| contribuicoes_perda | Perdas ou null | `por_variavel` em pontos de ISE e `principais` com todas as variáveis empatadas no máximo positivo |
| recomendacoes | string[] | Hipóteses de inspeção para desvios e alertas ativos, marcadas como simuladas |

`Pontos` tem os campos `temperatura`, `vibracao`, `corrente` e `pressao`, cada um de 0 a 100 ou null. Esses nomes também formam o enum de variável. A calibração não recebe pontuações. Uma leitura inadequada pode manter notas das variáveis válidas, com ISE, classificação e contribuições nulos.

## Alerta

| Campo | Tipo | Origem, unidade e exemplo |
| --- | --- | --- |
| id, execucao_id | string | IDs do alerta e da execução |
| codigo | enum | `DESVIO_INDIVIDUAL` ou `PRESSAO_INSTAVEL` |
| variavel | enum | Variável avaliada, `vibracao` |
| estado | enum | `ativo` ou `encerrado` |
| iniciado_em, encerrado_em | data; encerramento pode ser null | Instante real com fuso |
| sequencia_abertura | inteiro ≥ 1 | Leitura que cumpriu a persistência, `18` |
| motivo_encerramento | enum ou null | `recuperacao` ou `execucao_encerrada` |
| valor_observado | número | Razão de desvio na abertura ou desvio-padrão em bar, `1.3` |
| criterio_violado | string | Ex. `r > 1` ou `desvio-padrão da janela > 0.2 bar` |
| mensagem, recomendacao | string | Texto em português com contexto simulado |

Os eventos preservam os snapshots de abertura e encerramento. O frontend pode exibir alertas mesmo quando o ISE está Normal.

## Rotas e estruturas auxiliares

| Rota | Entrada / tipo | Resposta 200 |
| --- | --- | --- |
| GET /api/saude | nenhuma | `status: "ok"`, `versao_software: string` |
| GET /api/estado | nenhuma | Estado |
| GET /api/cenarios | nenhuma | Lista de `id` (enum), `nome` e `descricao` (strings de configuração) |
| GET /api/configuracao | nenhuma | Parâmetros didáticos e referência corrente |
| GET /api/execucoes | nenhuma | `execucoes` e `referencias`, ambas listas |
| GET /api/eventos | `execucao_id` string opcional | `execucao_id` string ou null e `itens` Evento[] |
| GET /api/historico | `execucao_id` obrigatório, `apos_sequencia` inteiro ≥ 0 (0), `limite` inteiro de 1 a 1000 (500) | Página |
| POST /api/cenario | `{"cenario":"aquecimento"}` | Estado pausado. Calibração em andamento bloqueia a troca |
| POST /api/iniciar | `{}` | Estado executando. Se necessário, começa coleta Normal |
| POST /api/pausar | `{}` | Estado pausado ou parado |
| POST /api/reiniciar | `{"seed":42}` | Nova execução de teste pausada |
| POST /api/recalibrar | `{"seed":42}` | Nova coleta Normal executando |

Uma página tem `execucao_id` (string), `itens` (Leitura[]), `proxima_sequencia` (inteiro, último item ou cursor da requisição) e `tem_mais` (booleano). Passe `proxima_sequencia` como `apos_sequencia` enquanto houver mais.

Uma execução tem `id` e `sessao_id` (strings), `tipo` (`calibracao` ou `teste`), `cenario` (enum), `seed` (inteiro sem sinal de 32 bits), `referencia_id` (string ou null), `criada_em` e `encerrada_em` (datas, encerramento nulo se aberta) e `total_leituras` (inteiro). As execuções aparecem em ordem de criação.

Uma referência tem `id` e `execucao_calibracao_id` (strings), `criada_em` (data), `seed` (inteiro), `coletadas` (inteiro, 60) e `estatisticas` (objeto com as quatro variáveis). Cada estatística contém `media` e `desvio_padrao` populacional na unidade da variável. Uma referência gerada na coleta só se vincula às novas leituras de teste.

Um evento tem `id`, `sessao_id`, `execucao_id` (IDs, execução pode ser null), `tipo` (enum no OpenAPI), `data_hora` (data), `sequencia` (inteiro ou null), `referencia_id` (string ou null), `alerta` (Alerta ou null), `motivos_qualidade` (MotivoQualidade[]) e `mensagem` (string). A ordem segue o registro no backend.

## Configuração

| Campo | Tipo | Origem, unidade e exemplo |
| --- | --- | --- |
| versao_contrato, versao_software | strings | Versões, `"1"` e `"0.1.0"` |
| ambiente | literal | Contexto, `"simulado"` |
| intervalo_s | inteiro | Cadência, `1` s |
| leituras_calibracao, leituras_roteiro_teste | inteiros | Parâmetros de contagem, `60` e `120` |
| seed_padrao | inteiro | Configuração, `42` |
| seed_execucao_atual | inteiro ou null | Seed da execução selecionada, `7` após reiniciar com 7 |
| rng | string | Algoritmo de geração, `NumPy Generator(PCG64(SeedSequence([seed, dominio])))` |
| dominios_rng | objeto de inteiros | `{"calibracao":0,"teste":1}` |
| pesos | objeto de números | Um coeficiente por variável, ex. `vibracao: 0.30` |
| variaveis | objeto de regras | Uma regra por variável |
| cenarios | objeto de parâmetros | Efeitos programados, detalhados em [CENARIOS.md](CENARIOS.md) |
| avaliacao | objeto de parâmetros | Limiares, razões, guarda numérica e contagens em [REGRAS.md](REGRAS.md) |
| referencia | Referência ou null | Referência corrente criada pelo serviço |

Cada regra tem `campo`, `unidade` e `recomendacao` (strings), `direcao` (enum `aumento` ou `bilateral`), `base`, `ruido_dp` e `tolerancia_minima` (números na unidade da variável) e `peso` (coeficiente). Os parâmetros de cenário e avaliação estão tipados no OpenAPI. Os sufixos `_s`, `_c`, `_ms2` e `_bar` indicam segundos, °C, m/s² e bar. As taxas `_por_s` usam a unidade da variável por segundo. Limites de classificação usam pontos de ISE. Persistência e janela são inteiros em leituras. Razões e multiplicadores são adimensionais. Veja todos os valores e nomes em [configuracao.json](fixtures/configuracao.json).

## Erros

O envelope HTTP usa `{"erro":{"codigo":"REFERENCIA_AUSENTE","mensagem":"Inicie a calibração no cenário Normal.","detalhes":{}}}`. Código e mensagem são strings, detalhes é objeto. Um 400 indica corpo ilegível, por exemplo bytes fora de UTF-8. 409 representa conflito de estado. 422 representa entrada inválida. 404 identifica execução ou rota inexistente. 405 identifica método inadequado. 500 representa falha interna. O preflight CORS acontece antes das rotas e pode devolver 400 em texto ao recusar a origem, o método ou os cabeçalhos.
