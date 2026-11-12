# Revisão de interface — linguagem de produto

Esta revisão separa o que a pessoa precisa para operar o prevLoss do que existe apenas para desenvolvimento, validação ou apresentação acadêmica.

## O que saiu da tela principal

| Informação anterior | Decisão | Motivo |
| --- | --- | --- |
| “Ambiente simulado” no cabeçalho | Removida | Repetia o contexto e ocupava a área de estado. |
| “API conectada” | Substituída por “Sistema online” | O operador precisa saber se o sistema está disponível, não qual camada técnica respondeu. |
| “Leitura simulada” em cada sensor | Removida | Era repetida quatro vezes sem acrescentar uma ação ou decisão. |
| UUIDs de sessão, execução e referência | Recolhidos em **Informações → Dados técnicos** | São úteis para suporte e evidência, mas não para a operação normal. |
| JSON bruto de configuração e referências | Removido | Duplicava dados internos e criava ruído visual. |
| “Protótipo acadêmico” e aviso sobre sensores no rodapé | Removidos | Faziam a aplicação parecer uma tela de apresentação, não um produto. |
| Prefixo “Ambiente simulado:” em alertas | Ocultado somente na apresentação | A mensagem continua fiel ao backend, mas aparece de forma direta para o usuário. |
| IDs curtos no histórico | Substituídos por “Execução 1, 2…” | Cenário, ordem e horário são referências mais compreensíveis. |
| “Referência estatística” | Renomeada para “Linha de base” | É mais curta e explica melhor a função no fluxo. |

## O que permanece visível

- Estado online/offline, pois muda a possibilidade de executar comandos.
- Estado da execução, horário da última atualização e indicação de dados antigos.
- Cenário, linha de base, quatro medições com unidades, ISE, contribuições e alertas.
- Tempo simulado nos gráficos, porque diferencia o relógio do experimento do horário real.
- Erros e instruções de recuperação, sempre próximos da ação possível.

## Tutorial de primeiro uso

O tutorial abre automaticamente uma vez por navegador e destaca a própria área explicada. São seis passos: visão geral, linha de base, controles, medições, ISE/alertas e gráficos/histórico. Ele oferece **Voltar**, **Próximo**, **Pular tutorial** e **Começar a usar**, respeita movimento reduzido e pode ser reaberto em **Como usar**.

O término é salvo em `localStorage` com uma chave versionada. Se o conteúdo do tutorial mudar de forma relevante, uma nova versão da chave permite apresentar a orientação atualizada sem apagar outros dados do navegador.
