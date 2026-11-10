import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from typing import Annotated

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import CENARIOS, INTERVALO_S, VERSAO_SOFTWARE
from .schemas import (
    ComandoCenario, ComandoSeed, ComandoVazio, Configuracao, EnvelopeErro, Erro, Estado,
    Eventos, Execucoes, InfoCenario, PaginaHistorico, Saude,
)
from .session_service import Conflito, ExecucaoInexistente, Sessao

LOG = logging.getLogger(__name__)
ORIGENS_LOCAIS = "http://localhost:5173,http://127.0.0.1:5173"
ERROS_ENTRADA = {422: {"model": EnvelopeErro, "description": "Entrada inválida"}}
ERROS_CONFLITO = {**ERROS_ENTRADA, 409: {"model": EnvelopeErro, "description": "Conflito de estado"}}
ERROS_CONSULTA = {**ERROS_ENTRADA, 404: {"model": EnvelopeErro, "description": "Execução inexistente"}}


def erro(status: int, codigo: str, mensagem: str, detalhes: dict | None = None, headers=None) -> JSONResponse:
    corpo = EnvelopeErro(erro=Erro(codigo=codigo, mensagem=mensagem, detalhes=detalhes or {}))
    return JSONResponse(corpo.model_dump(mode="json"), status_code=status, headers=headers)


async def gerar_leituras(sessao: Sessao, intervalo_s: float) -> None:
    while True:
        await asyncio.sleep(intervalo_s)
        try:
            sessao.avancar()
        except Exception:
            LOG.exception("Erro no trabalhador de simulação")
            sessao.falha_geracao()


def criar_app(sessao: Sessao | None = None, *, gerar: bool = True, intervalo_s: float = INTERVALO_S) -> FastAPI:
    servico = sessao if sessao is not None else Sessao()

    @asynccontextmanager
    async def lifespan(_):
        tarefa = asyncio.create_task(gerar_leituras(servico, intervalo_s)) if gerar else None
        try:
            yield
        finally:
            if tarefa is not None:
                tarefa.cancel()
                with suppress(asyncio.CancelledError):
                    await tarefa

    app = FastAPI(
        title="prevLoss | Ambiente simulado",
        description="API local de simulação, referência estatística, ISE e alertas de um conjunto motor-bomba.",
        version=VERSAO_SOFTWARE,
        lifespan=lifespan,
        responses={500: {"model": EnvelopeErro, "description": "Falha inesperada"}},
        redoc_url=None,
    )
    origens = os.getenv("PREVLOSS_CORS_ORIGINS", ORIGENS_LOCAIS).split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origem.strip() for origem in origens if origem.strip()],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(Conflito)
    async def conflito(_, exc: Conflito):
        return erro(409, exc.codigo, str(exc))

    @app.exception_handler(ExecucaoInexistente)
    async def inexistente(_, exc: ExecucaoInexistente):
        return erro(404, "EXECUCAO_INEXISTENTE", "A execução não existe nesta sessão.",
                    {"execucao_id": str(exc)})

    @app.exception_handler(RequestValidationError)
    async def entrada_invalida(_, exc: RequestValidationError):
        campos = [{"campo": list(e["loc"]), "tipo": e["type"]} for e in exc.errors()]
        return erro(422, "ENTRADA_INVALIDA", "Confira os parâmetros da requisição.", {"campos": campos})

    @app.exception_handler(StarletteHTTPException)
    async def erro_http(_, exc: StarletteHTTPException):
        codigo, mensagem = {
            400: ("REQUISICAO_INVALIDA", "A requisição não pôde ser lida."),
            404: ("ROTA_INEXISTENTE", "A rota não existe."),
            405: ("METODO_INCORRETO", "Use o método HTTP documentado para esta rota."),
        }.get(exc.status_code, ("ERRO_HTTP", "A requisição não pôde ser atendida."))
        return erro(exc.status_code, codigo, mensagem, headers=exc.headers)

    @app.exception_handler(Exception)
    async def inesperado(_: Request, exc: Exception):
        LOG.error("Erro inesperado na API", exc_info=exc)
        return erro(500, "ERRO_INTERNO", "Ocorreu uma falha inesperada no backend.")

    @app.get("/api/saude", summary="Verificar o processo")
    def saude() -> Saude:
        return Saude(status="ok", versao_software=VERSAO_SOFTWARE)

    @app.get("/api/estado", summary="Consultar o estado atual")
    def estado() -> Estado:
        return servico.estado()

    @app.get("/api/cenarios", summary="Listar os cinco cenários")
    def cenarios() -> tuple[InfoCenario, ...]:
        return CENARIOS

    @app.get("/api/configuracao", summary="Consultar parâmetros e referência corrente")
    def configuracao() -> Configuracao:
        return servico.configuracao()

    @app.get("/api/execucoes", summary="Listar execuções e referências da sessão")
    def execucoes() -> Execucoes:
        return servico.execucoes()

    @app.get("/api/eventos", summary="Consultar eventos", responses=ERROS_CONSULTA)
    def eventos(execucao_id: Annotated[str | None, Query(min_length=1)] = None) -> Eventos:
        return servico.eventos(execucao_id)

    @app.get("/api/historico", summary="Paginar leituras por execução", responses=ERROS_CONSULTA)
    def historico(
        execucao_id: Annotated[str, Query(min_length=1)],
        apos_sequencia: Annotated[int, Query(ge=0)] = 0,
        limite: Annotated[int, Query(ge=1, le=1000)] = 500,
    ) -> PaginaHistorico:
        return servico.historico(execucao_id, apos_sequencia, limite)

    @app.post("/api/cenario", summary="Selecionar cenário e deixar pausado", responses=ERROS_CONFLITO)
    def cenario(comando: ComandoCenario) -> Estado:
        return servico.selecionar(comando.cenario)

    @app.post("/api/iniciar", summary="Iniciar ou retomar", responses=ERROS_ENTRADA)
    def iniciar(comando: ComandoVazio) -> Estado:
        return servico.iniciar()

    @app.post("/api/pausar", summary="Pausar sem perder histórico", responses=ERROS_ENTRADA)
    def pausar(comando: ComandoVazio) -> Estado:
        return servico.pausar()

    @app.post("/api/reiniciar", summary="Criar nova execução de teste pausada", responses=ERROS_CONFLITO)
    def reiniciar(comando: ComandoSeed) -> Estado:
        return servico.reiniciar(comando.seed)

    @app.post("/api/recalibrar", summary="Iniciar nova coleta de referência Normal", responses=ERROS_CONFLITO)
    def recalibrar(comando: ComandoSeed) -> Estado:
        return servico.recalibrar(comando.seed)

    return app


app = criar_app()
