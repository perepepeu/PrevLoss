# Cenários e seeds

Configuração didática proposta no guia v2. Consulte também `GET /api/configuracao`.

| Variável | Unidade | Base | Desvio-padrão do ruído | Tolerância mínima | Peso |
| --- | --- | ---: | ---: | ---: | ---: |
| Temperatura | °C | 45 | 0,30 | 1 | 0,25 |
| Vibração | m/s² RMS de aceleração | 1,5 | 0,03 | 0,15 | 0,30 |
| Corrente | A | 8 | 0,10 | 0,40 | 0,25 |
| Pressão | bar | 3 | 0,03 | 0,15 | 0,20 |

Cada leitura começa com base e ruído gaussiano independente por variável, na ordem da tabela. Seja `u = max(0, tempo_simulado_s − 10)`.

| Cenário | Alteração programada |
| --- | --- |
| `normal` | Base e ruído |
| `aquecimento` | Soma `min(0,15u, 12)` °C |
| `vibracao_elevada` | Soma `min(0,025u, 2)` m/s² |
| `pressao_instavel` | Soma `0,6 sen(2πu/8)` bar |
| `multiplos_desvios` | Combina aquecimento, vibração e subtrai `min(0,02u, 1,2)` bar |

A seed padrão é 42 e a API aceita inteiros de 0 a 4.294.967.295. Cada execução tem um `Generator` próprio com `PCG64(SeedSequence([seed, dominio]))`. A coleta usa domínio 0, e testes usam domínio 1. O Normal preparado após calibração usa a mesma seed numérica da coleta e um fluxo separado. Selecionar cenário usa 42. Reiniciar usa a seed enviada. Para reproduzir valores, fixe cenário, seeds de referência e teste, versões e sequência de chamadas. IDs e datas reais podem variar. [NumPy SeedSequence](https://numpy.org/doc/stable/reference/random/parallel.html)

O roteiro inicial mede 120 leituras por cenário. Ele é acelerado em teste e a execução interativa continua até o próximo controle. Confira [os tempos observados e o ISE mínimo](TESTES.md) e [os dados brutos da evidência](evidencias/cenarios-seed42.json).
