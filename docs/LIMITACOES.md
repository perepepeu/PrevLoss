# Limitações e validações pendentes

- O protótipo representa uma bomba virtual e quatro variáveis. Seus cenários e recomendações têm finalidade didática. Os resultados medem o software nos desvios programados.
- A referência é estatística e simulada. Pesos, limiares, cadência, persistência, janela, tolerâncias e guarda numérica devem ser conferidos com Emerson e Pedro antes de congelar a configuração acadêmica.
- O histórico cresce em memória e é salvo em `.prevloss/session.json` a cada mudança. Reiniciar o servidor restaura a sessão pausada, para retomada manual. O arquivo também cresce com as leituras e deve ser preservado para manter os dados.
- A arquitetura utiliza um processo local e um trabalhador de geração. A cadência depende do agendamento do processo e o relógio simulado avança por leitura efetivamente gerada.
- A validação foi executada em Windows 11 x64. O backend e a API estão disponíveis para o dashboard. A conexão com a interface real e a execução por Pedro continuam pendentes.
- Na integração de Pedro, o arquivo de Caíque foi localizado como `ALTERAÇÃO.pdf` na Área de Trabalho e disponibilizado em [referencias/ALTERACAO.pdf](referencias/ALTERACAO.pdf). As 12 verificações originais estão mapeadas em [MATRIZ_CAIQUE.md](MATRIZ_CAIQUE.md). A execução/revisão independente de Caíque continua sendo uma etapa da equipe.
