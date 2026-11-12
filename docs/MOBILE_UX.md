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

No terminal da raiz:

```powershell
uv run --locked uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --workers 1
```

Na pasta `frontend`:

```powershell
npm run build
npm run preview:mobile
```

Execute `ipconfig` e localize o endereço IPv4 do notebook, por exemplo `192.168.1.25`. Com o celular no mesmo Wi-Fi, abra:

```text
http://192.168.1.25:5173
```

O frontend usa automaticamente o mesmo endereço para alcançar a API na porta 8000. Se existir um arquivo `frontend/.env`, remova temporariamente `VITE_API_BASE_URL` ou configure-o com o mesmo IPv4 antes de gerar o build.

O Windows pode solicitar permissão de firewall. Autorize somente para redes privadas. Encerre os dois terminais com `Ctrl+C` depois do uso.

## Matriz automatizada

- 320 × 568
- 360 × 800
- 390 × 844
- 412 × 915
- 430 × 932
- 667 × 375, orientação horizontal

Os testes verificam ausência de transbordamento horizontal, tamanho dos controles, ação principal, navegação, tutorial, seleção de gráfico, cartões do histórico e confirmação de nova execução.
