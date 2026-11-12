# Correspondência com as 12 verificações originais de Caíque

Fonte conferida: `docs/referencias/ALTERACAO.pdf`, seção 9, itens 01–12, e seção 4.1 para os seis limites. Cópia do arquivo `ALTERAÇÃO.pdf` encontrado na Área de Trabalho. SHA-256: `ABFAF6E1E353B6A3C1D4762864DA45CE117B8FF0D23A8E8FC74C82233B533AF4`.

Os itens representam **possíveis problemas**, não falhas já encontradas. “Cobertura técnica” significa que há verificação reproduzível; não substitui a execução e revisão de Caíque. Os resultados efetivamente executados e as evidências estão em `ENTREGA_PEDRO.md`.

| Original | Cobertura de backend | Cobertura de interface e validação real | Situação / passagem para Caíque |
| --- | --- | --- | --- |
| 01 — Classificação incorreta do ISE | `test_limites_classificacao`: 0; 49,99; 50; 50,01; 79,99; 80; 80,01; 100. | `Indicators.test.tsx` confirma apresentação da classe recebida e zero válido. Validação real compara classes e instantes com a evidência seed 42. | Coberta tecnicamente; Caíque executa/revisa os seis limites originais pelo teste do backend. Não há injeção de ISE na API pública. |
| 02 — ISE não muda diante de anomalia | `test_cenario_em_120_leituras` verifica Normal e anomalias. | Cinco cenários de 120 leituras no navegador; comparação de mínimo, final e primeira classificação. | Coberta tecnicamente; depende da execução/revisão de Caíque para seu relatório. |
| 03 — ISE não considera múltiplos desvios | Testes de pontuação manual, pesos e cenário de múltiplos desvios. | ISE, contribuições, empates e Crítico apresentados a partir da API. | Coberta tecnicamente; revisar pesos e evidência de Múltiplos desvios. |
| 04 — Ausência de alerta de aquecimento | Cenário determinístico e abertura térmica esperada. | Validação real verifica abertura, instante e mensagem visível. | Coberta tecnicamente; Caíque registra a execução térmica. |
| 05 — Ausência de alerta de vibração | Cenário determinístico e persistência. | Validação real verifica alerta de vibração e sua apresentação. | Coberta tecnicamente; Caíque registra a execução. |
| 06 — Pressão instável sem alerta | Janela de dez leituras e persistência de três avaliações. | Validação real verifica alerta de pressão com ISE Normal; teste visual confirma coexistência. | Coberta tecnicamente; atenção: Normal não implica ausência de alerta individual. |
| 07 — Alertas desaparecem indevidamente | `test_alerta_individual_normal_persistencia_invalidez_e_recuperacao` e `test_troca_encerra_alerta_sem_indicar_recuperacao`. | Alertas preservados com estado antigo em falha de rede; eventos distinguem recuperação de encerramento da execução. | Coberta tecnicamente; recuperação controlada é demonstrada pelo teste do backend, sem alterar os cenários reais para forçá-la. |
| 08 — Dados não atualizados corretamente | Fluxos, trabalhador e GET sem produção de amostras. | Polling, descarte de revisões antigas, novo cenário pausado sem leitura e início explícito. | Coberta tecnicamente; Caíque compara painel antes/depois da troca. |
| 09 — Mistura entre cenários | `test_historico_paginado_e_execucoes_separadas`. | Proteção de IDs, cancelamento por geração, caches por execução e rejeição de resposta de outra sessão. | Coberta tecnicamente; consultar duas execuções na validação real. |
| 10 — Dados ausentes tratados como Normal | Testes de ausência, invalidade e não redistribuição de pesos. | Fixtures `dado-ausente`/`dado-invalido`, ISE indisponível, razões por variável e gráficos com lacunas. | Coberta em testes controlados. Caíque reproduz por testes/fixtures identificadas; não há rota pública de injeção nem modificação da fórmula. |
| 11 — Histórico incorreto | Paginação, preservação de execuções e referências. | Teste com 1001 leituras, deduplicação e consulta de execução anterior no navegador; data/hora e tabela de 50 linhas. | Coberta tecnicamente; Caíque registra as execuções separadas na mesma sessão. |
| 12 — Perda após reinicialização | Snapshot local atômico em `.prevloss/session.json`; reinício restaura sessão e histórico, pausando a operação. | Reload preserva execução; reinício do backend preserva leituras, eventos, referência e sequência. | Teste de retomada automatizado; validar também em demonstração no celular. |

## Método para fronteiras e dados ausentes

Na raiz:

```powershell
uv run --locked pytest -q tests/test_scoring.py -k limites_classificacao
uv run --locked pytest -q tests/test_scoring.py tests/test_session.py
```

Na pasta `frontend`, `npm test` verifica a apresentação. Para captura manual dos estados controlados, usar o modo de desenvolvimento documentado em `DASHBOARD.md`; identificar a evidência como fixture. Isso não substitui a validação da função real do backend.

## Registro de execução/revisão

Copiar este modelo para cada execução de Caíque, preservando registros de falha e adicionando reteste:

| Campo | Preencher |
| --- | --- |
| ID original e identificação do teste | 01–12; identificador único |
| Versão/build, commit e hash de fontes | Frontend e backend |
| Data, hora e fuso | America/Bahia |
| Executor / revisor | Nomes de quem efetivamente executou/revisou |
| Cenário, seed, parâmetros | Seed 42 no roteiro padrão; configuração exportada |
| Sessão, execução e referência | IDs da API |
| Entrada e duração | Valores, leituras e segundos simulados |
| Esperado / observado | ISE, classificação, alertas e histórico |
| Evidência | PNG, vídeo e/ou JSON |
| Resultado | Aprovado / reprovado / bloqueado, com motivo |
| Defeito, correção e reteste | Preservar a falha original; identificar nova versão e evidência |

Pendência de equipe: execução/revisão independente por Caíque e confirmação acadêmica dos parâmetros com Emerson e Pedro. A disponibilidade e a conferência do documento original estão resolvidas.
