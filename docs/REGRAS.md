# Regras didáticas

## Medidas e pontuação

A primeira ação de iniciar gera leituras Normal para uma referência estatística simulada. Contam somente 60 registros com os quatro valores válidos. A referência guarda a média e o desvio-padrão populacional (`ddof=0`) por variável. Ela fica congelada até a próxima recalibração explícita. As leituras de calibração ficam em uma execução própria, com ISE e notas nulos.

Para cada variável, defina `B = max(3 × desvio_padrão, tolerância_mínima)`. Para temperatura e vibração, `D = max(0, leitura − média)`. Para corrente e pressão, `D = |leitura − média|`. A razão é `r = D/B`.

| Razão | Nota |
| --- | --- |
| `r ≤ 1` | 100 |
| `1 < r < 4` | `100 × (4 − r) / 3` |
| `r ≥ 4` | 0 |

`ISE = 0,25 × St + 0,30 × Sv + 0,25 × Sc + 0,20 × Sp`. A classificação usa o valor antes do arredondamento. É Crítico em `[0, 50)`, Atenção em `[50, 80)` e Normal em `[80, 100]`.

A perda de cada variável é `peso × (100 − nota)`, em pontos de ISE. A lista de principais inclui todos os empates positivos no máximo, com tolerância numérica de `10⁻¹²`. Se todas as perdas são zero, a lista fica vazia. Exemplo manual testado com notas `[100, 50, 100, 100]`: ISE 85, Normal e 15 pontos perdidos pela vibração. O alerta de vibração pode estar ativo.

### Dados inadequados

Um valor ausente (`null` ou campo faltante) fica nulo. Valores não numéricos, booleanos, não finitos e números com módulo maior que `10⁶` ficam nulos e tornam a leitura inválida. O teto é uma guarda numérica didática comum às quatro unidades. Se houver dados ausentes e inválidos juntos, o estado é inválido e todos os motivos aparecem.

Uma variável obrigatória inadequada deixa nulos ISE, classificação e contribuições. As notas disponíveis continuam no payload, sem redistribuição dos pesos.

## Alertas

- **Desvio individual**. Abre após três leituras válidas consecutivas com `r > 1`. Encerra por recuperação após três leituras válidas consecutivas com `r ≤ 1`.
- **Oscilação de pressão**. A janela deslizante exige dez leituras válidas da mesma execução. O limiar em bar é `max(3 × desvio_padrão_da_referência, 0,20)`. Três avaliações consecutivas acima do limiar abrem o alerta. Três avaliações no limiar ou abaixo encerram por recuperação. A primeira abertura possível é na leitura 12.
- Uma leitura globalmente ausente ou inválida zera a persistência de todos os critérios e limpa a janela. Alertas ativos permanecem. A avaliação retoma com leituras válidas.
- Um alerta aberto fica estável até encerrar. Troca de execução fecha alertas com `execucao_encerrada`. A recuperação é registrada somente pelo critério de três avaliações.
- Recomendações de temperatura, vibração, corrente e pressão são hipóteses de inspeção marcadas como simuladas. Eventos registram o critério, o valor e a sequência de abertura.

## Estados e ciclo de vida

| Estado | Comportamento |
| --- | --- |
| Parada | Estado de uma sessão nova, sem geração |
| Executando | O trabalhador do backend gera uma leitura por intervalo de aproximadamente um segundo |
| Pausada | Mantém sequência, relógio e histórico. Nova execução preparada começa em 0 |

A primeira leitura tem sequência 1 e tempo simulado 1 s. A conclusão da coleta cria um teste Normal pausado. Iniciar e pausar repetidamente no estado correspondente devolve o mesmo envelope. Selecionar um cenário com referência cria novo teste pausado com a seed padrão. Reiniciar cria novo teste com a seed solicitada. Recalibrar exige Normal e estado parado ou pausado. A falha inesperada de geração pausa a execução que falhou e registra o evento. GET apenas consulta snapshots.
