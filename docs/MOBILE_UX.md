# prevLoss mobile — experiência e execução

## Resultado da revisão

A experiência mobile foi redesenhada para uma pessoa que conhece o equipamento, mas não tem familiaridade com interfaces de computador.

| Critério | Antes | Depois |
| --- | ---: | ---: |
| Primeiro uso | 8,0 | 9,0 |
| Navegação | 4,0 | 8,8 |
| Ação principal | 5,0 | 9,0 |
| Leitura dos dados | 6,0 | 8,7 |
| Histórico | 4,0 | 8,5 |
| Segurança contra toque acidental | 6,0 | 8,5 |
| **Nota geral** | **6,0** | **8,8** |

O mobile passou de aproximadamente **58% para 90% pronto**. O restante corresponde à validação manual em aparelhos físicos e navegadores móveis diferentes.

## O que mudou

- Cabeçalho compacto com logo, conexão e acesso às informações.
- Estado da execução visível no celular.
- Resumo destacado com ISE, classificação e quantidade de alertas.
- Ação principal fixa e alcançável durante a rolagem.
- Navegação inferior entre Monitorar, Histórico e Ajuda.
- Um gráfico por vez, selecionado por botões de variáveis.
- Histórico em cartões, sem tabela ou rolagem horizontal.
- Confirmação antes de criar uma nova execução.
- Tutorial atualizado e reaberto por **Ajuda**.
- Alvos de toque com pelo menos 44 px.

## Abrir em um celular na mesma rede

Use uma rede Wi-Fi privada e confiável. Não encaminhe as portas do roteador para a internet.

Depois de instalar as dependências com `uv sync --locked` na raiz e `npm ci` em `frontend`, execute na pasta `frontend`:

```powershell
npm run mobile
```

O comando recompila o dashboard, inicia os serviços que ainda não estiverem rodando e mostra o endereço IPv4 do Wi-Fi, por exemplo `http://192.168.1.25:5173/`. Ele também salva um QR Code em `frontend/dist/acesso-mobile.svg` para abrir e escanear na tela do computador.

O celular acessa o frontend na porta 5173. As chamadas `/api` passam por essa mesma porta e são encaminhadas ao backend, que escuta somente em `127.0.0.1:8000` no computador. Se existir `VITE_API_BASE_URL` em `frontend/.env`, remova essa configuração antes de gerar o build para usar o encaminhamento automático.

O Windows pode solicitar permissão de firewall para a porta 5173. Autorize somente em redes privadas. Os serviços iniciados pelo comando continuam rodando em segundo plano após ele terminar; encerre os processos da API e do Vite ao fim da demonstração.

## Matriz automatizada

- 320 × 568
- 360 × 800
- 390 × 844
- 412 × 915
- 430 × 932
- 667 × 375, orientação horizontal

Os testes verificam ausência de transbordamento horizontal, tamanho dos controles, ação principal, navegação, tutorial, seleção de gráfico, cartões do histórico e confirmação de nova execução.
