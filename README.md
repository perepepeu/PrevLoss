# prevLoss

O prevLoss é um protótipo didático de monitoramento de um conjunto motor-bomba **simulado**. A API gera leituras de temperatura, vibração, corrente elétrica e pressão em cinco cenários; calcula uma referência estatística, o Índice de Saúde do Equipamento (ISE) e alertas. O dashboard permite acompanhar a operação, pausar, trocar de cenário e consultar execuções anteriores.

O projeto roda no computador, pode ser aberto por um celular na mesma rede Wi-Fi e contém a configuração para hospedagem permanente no Render. A hospedagem ainda depende da criação de um serviço na conta Render; **não há URL pública definida neste repositório**.

## Funcionalidades

- Calibração da linha de base com 60 leituras válidas do cenário Normal.
- Cinco cenários: Normal, Aquecimento, Vibração elevada, Pressão instável e Múltiplos desvios.
- ISE de 0 a 100, classificação, contribuições por variável e alertas independentes da classificação.
- Gráficos das últimas 120 leituras, eventos e histórico de cada execução.
- Retomada da sessão após reiniciar o backend: dados restaurados e simulação pausada.
- Interface para desktop e celular, com tutorial de primeiro uso.

Os dados são gerados por software. O protótipo não lê sensores reais nem deve ser usado para tomar decisões de manutenção em equipamentos.

## Requisitos e instalação

| Ferramenta | Versão de referência | Uso |
| --- | --- | --- |
| Python | 3.13.15 | API e simulador |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | compatível com `uv.lock` | Dependências do backend |
| Node.js | 24.12.0 | Dashboard e scripts |
| npm | 11.6.2 | Dependências do frontend |
| Google Chrome | instalado | Testes de interface com Playwright |

As versões de Python e Node estão em `.python-version` e `frontend/.node-version`. A primeira instalação requer internet. Os comandos abaixo usam PowerShell no Windows.

Na raiz do repositório:

```powershell
uv python install 3.13.15
uv sync --locked
```

Na pasta `frontend`:

```powershell
cd frontend
npm ci
npm run build
```

## Abrir no computador

Mantenha dois terminais abertos:

```powershell
# Terminal 1 — raiz do repositório
uv run --locked uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

```powershell
# Terminal 2 — pasta frontend
npm run preview
```

Abra **http://127.0.0.1:5173**. A documentação interativa da API fica em **http://127.0.0.1:8000/docs**. O preview serve o último build: depois de editar o frontend, execute `npm run build` novamente. Para desenvolver com atualização automática, use `npm run dev` no lugar de `preview`.

Não execute `dev` e `preview` ao mesmo tempo: ambos usam a porta 5173. O backend deve ter apenas um worker para manter uma única sessão. O [guia de operação](docs/DASHBOARD.md) cobre portas ocupadas e falhas de conexão.

## Abrir no celular pela mesma rede

Com as dependências instaladas, conecte computador e celular ao mesmo Wi-Fi. **Encerre um `npm run preview` ou `npm run dev` local que esteja usando a porta 5173** antes de iniciar o modo mobile. Na pasta `frontend`, execute:

```powershell
npm run mobile
```

O comando recompila o dashboard, inicia os serviços ausentes, mostra um link como `http://192.168.1.25:5173/` e salva um QR Code em `frontend/dist/acesso-mobile.svg`. Abra o SVG no computador e escaneie com o celular. Confira se o endereço impresso pertence ao Wi-Fi usado; se a detecção escolher outro adaptador, defina `PREVLOSS_HOST` com o IPv4 correto.

O celular acessa a porta 5173; o frontend encaminha `/api` ao backend local. Os processos iniciados por `npm run mobile` permanecem ativos em segundo plano após o comando terminar. Use uma rede privada confiável e autorize a porta 5173 no firewall do Windows somente para redes privadas. Não copie `frontend/.env.example` para um build mobile sem remover `VITE_API_BASE_URL`: o endereço de loopback no exemplo apontaria para o próprio celular. Veja o [guia mobile](docs/MOBILE_UX.md).

Para encerrar o modo mobile no Windows, identifique primeiro os processos que escutam nas portas 5173 e 8000:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5173,8000 | Select-Object LocalPort,OwningProcess
```

Confira a linha de comando de cada PID com `Get-CimInstance Win32_Process -Filter "ProcessId = 1234" | Select-Object CommandLine` e use `Stop-Process -Id 1234` **somente** para o processo deste projeto que você iniciou. Se um servidor já estava ativo antes do comando mobile, preserve-o.

## Primeiro uso e operação

1. Confirme **Sistema online** no cabeçalho. No primeiro acesso, o tutorial de seis passos apresenta a interface. Ele pode ser reaberto por **Como usar** no desktop ou **Ajuda** no celular.
2. Clique em **Iniciar linha de base**. A coleta de 60 leituras Normais válidas leva aproximadamente um minuto. Ao concluir, a referência fica congelada e uma execução Normal separada fica preparada, pausada.
3. Clique em **Iniciar monitoramento**. Acompanhe as quatro medidas, o ISE, os alertas e os gráficos.
4. Use **Pausar** antes de trocar de cenário. A troca prepara uma nova execução pausada. **Nova execução** reinicia o cenário selecionado sem apagar o histórico e pede confirmação.
5. Abra **Histórico** para consultar leituras e eventos anteriores. Essa seleção não altera a execução ativa; no celular, volte a **Monitorar** para usar os controles.

Recarregar a página não reinicia a simulação. Ao reiniciar o backend, a sessão de `.prevloss/session.json` volta **pausada** e precisa ser retomada manualmente. A opção **Refazer linha de base** fica em **Informações**, no cenário Normal e com a operação pausada.

Se a conexão cair ou o contrato da API for incompatível, o dashboard identifica os dados antigos, suspende os comandos e tenta sincronizar novamente. Após um comando sem confirmação, consulta o estado sem repetir automaticamente a ação.

## Arquitetura e dados

| Parte | Responsabilidade |
| --- | --- |
| `backend/app/` | API FastAPI, simulador, calibração, ISE, alertas e sessão |
| `frontend/src/` | Dashboard React, cliente HTTP, sincronização, gráficos, histórico e tutorial |
| `frontend/scripts/` | Inicialização mobile e validação integrada |
| `tests/` e `frontend/e2e/` | Testes do backend e da interface |
| `docs/` | Contrato, regras, cenários, operação, evidências e limites |

Enquanto executa, o backend gera aproximadamente uma leitura por segundo. A referência usa média e desvio-padrão das 60 leituras válidas da calibração. O ISE combina as quatro variáveis com pesos configurados; os alertas seguem critérios e persistência próprios, de modo que podem aparecer mesmo com ISE Normal. Consulte as [regras de cálculo](docs/REGRAS.md) e os [cenários](docs/CENARIOS.md).

Os pesos do ISE são 25% para temperatura, 30% para vibração, 25% para corrente e 20% para pressão. A classificação é **Crítico** abaixo de 50, **Atenção** de 50 a menos de 80 e **Normal** a partir de 80. Um alerta individual exige três leituras válidas consecutivas com desvio; a oscilação de pressão usa uma janela de dez leituras e também exige persistência. Esses números descrevem a lógica didática implementada, não parâmetros validados para uma bomba real.

Os gráficos exibem até 120 pontos da execução consultada; isso não limita a duração da simulação. O Histórico busca leituras em lotes e mostra 50 por página, em tabela no desktop e cartões no celular. Os horários apresentados na interface usam `America/Bahia`.

A sessão é salva em `.prevloss/session.json`, arquivo ignorado pelo Git. Ele contém histórico, eventos, referências e o estado necessário para continuar a sequência do simulador; cresce com as leituras. Para iniciar uma sessão vazia, preserve antes uma cópia caso precise dos dados e remova o arquivo **com o servidor desligado**. A hospedagem usa armazenamento separado e não recebe automaticamente a sessão local.

## API e configuração

A API local responde em `http://127.0.0.1:8000`. No computador, o dashboard acessa essa origem; no celular, as chamadas passam pelo endereço do frontend. O [contrato v1](docs/contrato-v1.md), o [OpenAPI](docs/openapi.json), os [tipos TypeScript](docs/contrato-v1.d.ts) e as [respostas de exemplo](docs/fixtures/) descrevem campos e erros.

| Método | Rotas | Finalidade |
| --- | --- | --- |
| GET | `/api/saude`, `/api/estado` | Saúde do processo e estado atual |
| GET | `/api/configuracao`, `/api/cenarios` | Parâmetros e cenários disponíveis |
| GET | `/api/execucoes`, `/api/historico`, `/api/eventos` | Referências, execuções, leituras e eventos |
| POST | `/api/iniciar`, `/api/pausar` | Iniciar, retomar ou pausar |
| POST | `/api/cenario`, `/api/reiniciar`, `/api/recalibrar` | Trocar cenário, criar execução ou refazer referência |

| Variável de ambiente | Quando usar |
| --- | --- |
| `PREVLOSS_STATE_FILE` | Caminho do arquivo de sessão; padrão `.prevloss/session.json` |
| `PREVLOSS_HOST` | IPv4 mostrado por `npm run mobile`, caso a detecção da rede escolha outro adaptador |
| `VITE_API_BASE_URL` | Sobrescreve a origem da API no build; normalmente deve ficar ausente no mobile |
| `PREVLOSS_CORS_ORIGINS` | Origens autorizadas quando frontend e API estão em endereços diferentes |
| `PREVLOSS_STATIC_DIR` | Faz a API servir o build do frontend no mesmo endereço, como no container |
| `PREVLOSS_REQUIRE_AUTH`, `PREVLOSS_ACCESS_PASSWORD` | Proteção por senha no acesso publicado; configure o segredo fora do repositório |

Em `VITE_API_BASE_URL`, use somente a origem, sem `/api`. A variável é incorporada ao build e exige nova compilação. Veja [instalação e CORS](docs/INSTALACAO.md) e o [roteiro HTTP](docs/CONTRATO.md). A seção de Git do guia de instalação registra uma branch antiga; para um clone novo, use a `main`.

## Verificar o projeto

Na raiz, com as dependências instaladas:

```powershell
uv run --locked pytest -q
```

Na pasta `frontend`:

```powershell
npm run lint
npm test
npm run build
npm run test:e2e
```

O teste de interface usa Chrome e inicia o preview quando necessário. Os roteiros adicionais `npm run test:real` e `python -m tools.verificar_http` ainda pressupõem uma sessão inicial vazia e não foram atualizados para a restauração por snapshot; execute-os apenas em ambiente isolado e não os use para avaliar uma sessão que queira preservar. As [evidências de teste](docs/TESTES.md) registram resultados de entregas anteriores, com as datas e versões correspondentes.

## Hospedagem fora do Wi-Fi

`Dockerfile` e `render.yaml` preparam frontend e API no mesmo endereço HTTPS do Render. O Blueprint prevê um serviço web pago com um processo de API e disco persistente de 1 GB. A interface e os comandos exigem usuário `prevloss` e senha configurada no Render; `/api/saude` permanece público para a checagem de saúde.

A criação do serviço, a aprovação do custo e a definição da senha acontecem na conta Render. O repositório não contém credenciais. O [guia de hospedagem](docs/HOSPEDAGEM.md) explica a publicação e a validação após o deploy.

## Documentação complementar

- [Dashboard: instalação, operação e apresentação](docs/DASHBOARD.md)
- [Experiência e acesso mobile](docs/MOBILE_UX.md)
- [Contrato HTTP e exemplos](docs/CONTRATO.md)
- [Regras de cálculo](docs/REGRAS.md) e [cenários simulados](docs/CENARIOS.md)
- [Limitações e validações pendentes](docs/LIMITACOES.md)
- [Matriz das 12 verificações de Caíque](docs/MATRIZ_CAIQUE.md) e [evidências de teste](docs/TESTES.md)
- [Roteiro de apresentação](docs/APRESENTACAO.md) e [relatório histórico da entrega do dashboard](docs/ENTREGA_PEDRO.md)

Alguns relatórios em `docs/` registram o estado de entregas anteriores. Para comportamento atual, confira este README, o código e os testes; por exemplo, a sessão agora persiste entre reinícios, ao contrário do que diz um relatório antigo.
