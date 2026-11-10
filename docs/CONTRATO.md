# Integração da API v1

O [contrato de campos](contrato-v1.md), o [OpenAPI exportado](openapi.json), os [tipos TypeScript](contrato-v1.d.ts) e as [fixtures JSON](fixtures/) são as referências para o adaptador do Pedro. Os exemplos de estado têm o envelope completo. A fixture de vibração contém ISE Normal e alerta ativo. As duas fixtures de qualidade têm ISE e classificação nulos.

## Roteiro HTTP no PowerShell 7

Inicie o backend pelo README. Execute na ordem, usando IDs retornados pelo seu servidor. As amostras em `fixtures/` usam IDs e horários de uma execução de referência.

```powershell
$prevLossApi = 'http://127.0.0.1:8000/api'
function Post-PrevLoss($rota, $dados) {
    Invoke-RestMethod "$prevLossApi/$rota" -Method Post -ContentType 'application/json' -Body $dados
}

# 200, status ok e versão.
Invoke-RestMethod "$prevLossApi/saude"
# 200, parada, referência e leitura nulas em sessão nova.
Invoke-RestMethod "$prevLossApi/estado"
# 200, lista dos cinco cenários.
Invoke-RestMethod "$prevLossApi/cenarios"
# 200, pesos, parâmetros didáticos, seed padrão 42 e referência corrente.
Invoke-RestMethod "$prevLossApi/configuracao"

# 409, erro.codigo REFERENCIA_AUSENTE antes da calibração.
$erro = Invoke-WebRequest "$prevLossApi/reiniciar" -Method Post -ContentType 'application/json' -Body '{"seed":42}' -SkipHttpErrorCheck
$erro.StatusCode
$erro.Content

# 200, coleta em andamento no cenário Normal.
$coleta = Post-PrevLoss 'iniciar' '{}'
$coleta.execucao_atual_id

# Aguarde cerca de um minuto e consulte até calibracao.estado ser concluida.
# 200, 60 coletadas, teste Normal criado e pausado, sem última leitura.
$estado = Invoke-RestMethod "$prevLossApi/estado"
$estado.calibracao
# 200, teste Normal executando com ID diferente da coleta.
$normal = Post-PrevLoss 'iniciar' '{}'
Start-Sleep -Seconds 3
# 200, pausada. Mantém o ID, o relógio e o histórico.
Post-PrevLoss 'pausar' '{}'

# 200, teste de aquecimento pausado e com novo ID.
$aquecimento = Post-PrevLoss 'cenario' '{"cenario":"aquecimento"}'
# 200, primeira página de Normal; guarde proxima_sequencia se tem_mais.
$pagina = Invoke-RestMethod "$prevLossApi/historico?execucao_id=$($normal.execucao_atual_id)&apos_sequencia=0&limite=1"
$pagina | ConvertTo-Json -Depth 12
# 200, histórico vazio no aquecimento recém-selecionado.
Invoke-RestMethod "$prevLossApi/historico?execucao_id=$($aquecimento.execucao_atual_id)"
# 200, eventos do Normal, com IDs e datas.
Invoke-RestMethod "$prevLossApi/eventos?execucao_id=$($normal.execucao_atual_id)"
# 200, inclui a coleta, Normal, aquecimento e a referência congelada.
Invoke-RestMethod "$prevLossApi/execucoes"

# 200, nova execução de aquecimento pausada, com seed 42.
$nova = Post-PrevLoss 'reiniciar' '{"seed":42}'
$nova.execucao_atual_id
# 200, Normal pausado e depois coleta nova iniciada com seed 42.
Post-PrevLoss 'cenario' '{"cenario":"normal"}'
Post-PrevLoss 'recalibrar' '{"seed":42}'
# 422, erro.codigo ENTRADA_INVALIDA.
$invalido = Invoke-WebRequest "$prevLossApi/cenario" -Method Post -ContentType 'application/json' -Body '{"cenario":"desconhecido"}' -SkipHttpErrorCheck
$invalido.StatusCode
$invalido.Content
```

As mesmas rotas e corpos estão em `/docs` e no [OpenAPI](openapi.json). Exemplos de respostas por rota:

| Rota | Exemplo de resposta |
| --- | --- |
| GET saúde | [saude.json](fixtures/saude.json) |
| GET estado | [estado-inicial.json](fixtures/estado-inicial.json), [normal.json](fixtures/normal.json) |
| GET cenários | [cenarios.json](fixtures/cenarios.json) |
| GET configuração | [configuracao.json](fixtures/configuracao.json) |
| GET execuções | [execucoes.json](fixtures/execucoes.json) |
| GET eventos | [eventos.json](fixtures/eventos.json) |
| GET histórico | [historico.json](fixtures/historico.json), [historico-vazio.json](fixtures/historico-vazio.json) |
| POST iniciar e recalibrar | Envelope de estado, como [calibracao-24-de-60.json](fixtures/calibracao-24-de-60.json). A coleta recém-criada começa em 0 |
| POST pausar | [pausa.json](fixtures/pausa.json) |
| POST cenário e reiniciar | Envelope pausado com o ID novo e `ultima_leitura: null`, como [execucao-nova-pausada.json](fixtures/execucao-nova-pausada.json) |
| Erro 409 | [erro.json](fixtures/erro.json) |

## Adaptador do dashboard

- Use `sessao_id` para detectar reinício do backend e descarte respostas de revisões anteriores da mesma sessão. Use `execucao_atual_id` para separar histórico e alertas. Uma nova execução inicia sem leitura.
- Depois da seleção ou reinício, chame `iniciar` explicitamente. Após completar a calibração, também chame `iniciar` para o teste Normal.
- Faça polling de estado a cada segundo. Continue a paginação quando `tem_mais` for verdadeiro e use `proxima_sequencia` como cursor. Nunca combine páginas de execuções diferentes.
- Exiba `alertas_ativos` independentemente da classe do ISE. Use `eventos` para trilha histórica e `qualidade_dados`/motivos para sinalizar valores inadequados.
- Use as fixtures no adaptador de desenvolvimento identificado como mock. Na integração final, use a API real e execute o roteiro da ponte.

Exemplo de importação de tipos:

```typescript
import type { components } from './contrato-v1'
type Estado = components['schemas']['Estado']
type Leitura = components['schemas']['Leitura']
```
