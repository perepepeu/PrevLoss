# Instalação e execução local

Ambiente verificado em 10/11/2026: Windows 11 x64 (build 26200), Python 3.13.15 e uv 0.12.6. A versão de Python está em `.python-version` e as bibliotecas estão fixadas em `pyproject.toml` e `uv.lock`. O backend roda sem Node. A exportação dos tipos foi verificada com Node 24.19.0, openapi-typescript 7.10.1 e TypeScript 5.9.3. Linux e macOS ainda precisam de validação.

## Primeiro início

1. Instale o [uv](https://docs.astral.sh/uv/getting-started/installation/) e abra o terminal na raiz do projeto.
2. Execute:

   ```powershell
   uv python install 3.13.15
   uv sync --locked
   uv run --locked uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
   ```

3. Em outro terminal:

   ```powershell
   curl.exe http://127.0.0.1:8000/api/saude
   ```

   Resultado esperado `{"status":"ok","versao_software":"0.1.0"}`. O Swagger fica em [127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) e a especificação em [127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json).

A primeira sincronização baixa dependências. A API e a simulação funcionam localmente após a instalação. O Swagger usa os arquivos de interface padrão do FastAPI servidos por CDN. Se a interface visual estiver indisponível, use o JSON OpenAPI ou os comandos em [CONTRATO.md](CONTRATO.md).

## CORS e portas

| Configuração | Valor |
| --- | --- |
| API | `http://127.0.0.1:8000` |
| Origens do dashboard autorizadas por padrão | `http://localhost:5173`, `http://127.0.0.1:5173` |
| `PREVLOSS_CORS_ORIGINS` | Lista separada por vírgulas. Inclua esquema, host e porta, sem barra final |

Para mudar as origens, copie `.env.example` para `.env`, edite e acrescente `--env-file .env` ao comando do Uvicorn. Também pode definir a variável de ambiente diretamente no terminal. O arquivo de exemplo não contém segredos.

Se o Uvicorn exibir erro de bind, como `[WinError 10048]` ou `address already in use`, pare o servidor que usa a porta ou altere `--port` para 8001 e ajuste a URL usada pelo cliente. Use `Ctrl+C` para parar o servidor. Cada processo mantém uma sessão independente em memória. Execute com um worker e sem `--reload` durante a demonstração.

## Git

A entrega foi preparada na branch local `emerson/backend-v1`, baseada na `main` do repositório do grupo (commit inicial `52adfe2`). O ZIP executa por si só. Para importar a branch usando o bundle, execute na raiz de um clone do repositório do grupo, ajustando o caminho do arquivo:

```powershell
git fetch "C:/caminho/prevloss-backend-v1.bundle" "refs/heads/emerson/backend-v1:refs/heads/emerson/backend-v1"
git switch emerson/backend-v1
```

## Referências de implementação

- Inicialização e desligamento do trabalhador pelo [lifespan do FastAPI](https://fastapi.tiangolo.com/advanced/events/).
- Resolução e sincronização reproduzível pelo [lock do uv](https://docs.astral.sh/uv/concepts/projects/sync/).
