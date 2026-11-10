# Roteiro de três minutos para Emerson

1. **Dados**. Mostre uma leitura Normal e identifique temperatura em °C, vibração RMS de aceleração em m/s², corrente em A e pressão em bar. A bomba e os valores são simulados. Os cinco cenários usam os mesmos valores de base e efeitos programados.
2. **Referência**. Mostre o progresso `24/60`. Explique que 60 leituras Normais válidas formam média e desvio-padrão por variável. A referência fica congelada e o teste começa em uma execução separada, com outro fluxo de ruído.
3. **ISE e alertas**. Use o exemplo de notas `[100, 50, 100, 100]`. O ISE é 85, com 15 pontos de perda na vibração. Após três desvios válidos consecutivos, a vibração pode ter alerta ativo mesmo com a classificação Normal. Para a pressão, mostre o alerta de janela e o critério de oscilação.
4. **Evidência**. Na seed 42, o cenário de múltiplos desvios entrou em Crítico pela primeira vez aos 30 s simulados. Cite a referência, a seed e a execução registradas no [relatório de teste](TESTES.md). O resultado demonstra a lógica do protótipo com dados gerados.
