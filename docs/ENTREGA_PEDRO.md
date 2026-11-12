# Entrega do dashboard de Pedro

Entrega concluída em 11/11/2026, America/Bahia. Frontend 0.1.0; backend 0.1.0; contrato 1. Branch `codex/pedro-dashboard-v1`, baseada em `121c3c6`. A implementação mantém a API, os pesos, fórmulas e arquivos de tipos gerados do backend.

## Implementado

- Interface clara e responsiva com Monitoramento, Histórico e Detalhes da simulação.
- Coleta de referência, início explícito, pausa/retomada, cinco cenários, nova execução e confirmação de recalibração.
- Quatro medidas, ISE, contribuições, recomendações, alertas independentes e cinco gráficos.
- Histórico incremental paginado, tabela, referências históricas e eventos.
- Validação das respostas pelo OpenAPI original; proteção de sessão, revisão, execução e requisições canceladas.
- Recuperação de rede/contrato sem reload, comandos suspensos enquanto dados não são confiáveis e ausência de fallback automático para mocks.
- Fixtures visuais somente em desenvolvimento, com identificação e comandos desativados; excluídas do build.
- Documento original de Caíque disponível localmente e 12 verificações mapeadas em `MATRIZ_CAIQUE.md`.

## Resultados de verificação

| Verificação | Resultado |
| --- | --- |
| Backend pytest | 81 testes aprovados novamente na entrega. |
| Frontend Vitest | 45 testes aprovados, incluindo 1001 leituras paginadas, timeout e respostas fora de ordem. |
| Playwright rápido | 5 testes aprovados: operação inicial, recuperação, layout/alertas, isolamento de fixtures e histórico acessível. |
| Build TypeScript + Vite | Aprovado. |
| ESLint | Aprovado. |
| Ponte HTTP real | Aprovada: `evidencias/ponte-http-pedro.json`. |
| Cinco cenários e offline | Aprovado no reteste final, com 600 leituras de cenário e zero requisições externas. |

Não considerar uma execução com resultado “em execução” ou “reprovado” como aprovada. Os registros anteriores são mantidos quando houver correção e reteste.

### Falha preservada e correção

A primeira validação real (`evidencias/pedro/2026-11-10T17-45-36-245Z/validacao-real.json`) aprovou os cinco cenários de 120 leituras, mas foi reprovada na seleção automatizada do histórico: `getByLabel('Execução', { exact: true })` não encontrou o controle porque o texto do label envolvia também as opções do select. A interface recebia o histórico, mas a identificação exata usada pelo roteiro não era estável.

Correção: nome acessível explícito `aria-label="Execução"`, mantendo o rótulo visível, e teste Playwright específico de seleção e tabela. A gravação curta da primeira tentativa também foi interrompida pelo mesmo seletor; não é a gravação final de apresentação. O reteste completo foi registrado em outra pasta, preservando o JSON e a captura originais.

O reteste final está em `evidencias/pedro/2026-11-12T02-26-43-166Z/validacao-real.json` e terminou **aprovado** em 11/11/2026 às 23:39 (America/Bahia). Validou a seleção e a paginação do histórico corrigidas, nova execução, recalibração completa, preservação das referências antigas, perda de conexão e reinício em nova sessão.

| Cenário | Leituras | ISE final | Classe final | Resultado |
| --- | ---: | ---: | --- | --- |
| Normal | 120 | 100 | Normal | Aprovado |
| Aquecimento | 120 | 75 | Atenção | Aprovado |
| Vibração elevada | 120 | 70 | Atenção | Aprovado |
| Pressão instável | 120 | 80 | Normal, com alertas esperados | Aprovado |
| Múltiplos desvios | 120 | 25 | Crítico | Aprovado |

A execução durou 12 minutos e 28 segundos. O navegador isolado comprovou o bloqueio externo antes do teste, registrou zero requisições remotas da aplicação e zero erros JavaScript. As capturas incluem estado inicial, calibração, cada cenário, histórico, tela estreita e desconexão. A gravação curta MP4, identificada como **Gravação reserva | Ambiente simulado**, acompanha a evidência e entra no Git. A gravação integral WebM permanece no ambiente local e fica fora do Git por causa do tamanho.

## Operação e limites

Seguir `DASHBOARD.md`. Desenvolvimento e preview ficam em 127.0.0.1:5173 com porta estrita. API em 127.0.0.1:8000, um worker. Dependências exatas e versões Node/npm registradas.

O histórico cresce em memória durante a sessão e não persiste ao encerrar o backend. O cliente também mantém os registros recuperados em memória. Os gráficos mostram os últimos 120 pontos; não constituem limite de coleta. A versão destina-se à demonstração local de uma bomba virtual.

O teste offline bloqueia o acesso externo do processo isolado de navegador por proxy indisponível e libera loopback, sem alterar adaptadores de rede do usuário. A prova inclui uma tentativa externa rejeitada e zero requisições remotas do dashboard. Não se afirma que o Wi-Fi do computador foi fisicamente desligado.

O build contém uma biblioteca de gráficos e validação de contrato; Vite emite aviso de tamanho do bundle, sem falha de compilação. Auditoria inicial não apontou vulnerabilidades nas dependências de produção; apontou avisos moderados na cadeia de ferramentas de lint (minimatch), sem recurso remoto em operação. Atualizações de ferramentas devem preservar o lock e passar pelos testes.

A aprovação independente de Caíque e o alinhamento acadêmico dos parâmetros com Emerson/Pedro são passos de revisão humana; não são apresentados como já realizados.
