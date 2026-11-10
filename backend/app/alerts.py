from collections import deque
from dataclasses import dataclass
from datetime import datetime
from statistics import pstdev
from uuid import uuid4

from .config import PARAMETROS_AVALIACAO as P, VARIAVEIS
from .schemas import Alerta, CodigoAlerta, Estatisticas, MotivoEncerramento, Variavel


@dataclass
class Persistencia:
    alerta: Alerta | None = None
    consecutivas: int = 0

    def observar(self, violou: bool) -> bool:
        espera_violacao = self.alerta is None
        self.consecutivas = self.consecutivas + 1 if violou == espera_violacao else 0
        if self.consecutivas < P.persistencia:
            return False
        self.consecutivas = 0
        return True

    def encerrar(self, agora: datetime, motivo: MotivoEncerramento) -> Alerta:
        assert self.alerta is not None
        encerrado = self.alerta.model_copy(update={
            "estado": "encerrado", "encerrado_em": agora, "motivo_encerramento": motivo,
        })
        self.alerta = None
        self.consecutivas = 0
        return encerrado


class MotorAlertas:
    def __init__(self, execucao_id: str):
        self.execucao_id = execucao_id
        self.niveis = {nome: Persistencia() for nome in VARIAVEIS}
        self.oscilacao = Persistencia()
        self.janela = deque(maxlen=P.janela_pressao)

    def ativos(self) -> tuple[Alerta, ...]:
        return tuple(p.alerta for p in (*self.niveis.values(), self.oscilacao) if p.alerta is not None)

    def invalidar(self) -> None:
        self.janela.clear()
        for persistencia in (*self.niveis.values(), self.oscilacao):
            persistencia.consecutivas = 0

    def encerrar(self, agora: datetime) -> tuple[Alerta, ...]:
        return tuple(
            p.encerrar(agora, "execucao_encerrada")
            for p in (*self.niveis.values(), self.oscilacao)
            if p.alerta is not None
        )

    def avaliar(
        self, razoes: dict[Variavel, float], pressao: float, referencia: Estatisticas,
        sequencia: int, agora: datetime,
    ) -> list[Alerta]:
        alteracoes = []
        for variavel, valor in razoes.items():
            limiar = P.razao_inicio_perda
            alerta = self._atualizar(
                self.niveis[variavel], "DESVIO_INDIVIDUAL", variavel, valor, limiar,
                f"r > {limiar:g}", sequencia, agora,
            )
            if alerta is not None:
                alteracoes.append(alerta)

        self.janela.append(pressao)
        if len(self.janela) == P.janela_pressao:
            limiar = max(
                P.multiplicador_dispersao * referencia.pressao.desvio_padrao,
                P.limiar_minimo_pressao_bar,
            )
            alerta = self._atualizar(
                self.oscilacao, "PRESSAO_INSTAVEL", "pressao", pstdev(self.janela), limiar,
                f"desvio-padrão da janela > {limiar:g} bar", sequencia, agora,
            )
            if alerta is not None:
                alteracoes.append(alerta)
        return alteracoes

    def _atualizar(
        self, persistencia: Persistencia, codigo: CodigoAlerta, variavel: Variavel,
        valor: float, limiar: float, criterio: str, sequencia: int, agora: datetime,
    ) -> Alerta | None:
        if not persistencia.observar(valor > limiar):
            return None
        if persistencia.alerta is not None:
            return persistencia.encerrar(agora, "recuperacao")
        descricao = {
            "temperatura": "temperatura", "vibracao": "vibração",
            "corrente": "corrente", "pressao": "pressão",
        }
        mensagem = (
            "Ambiente simulado: oscilação de pressão na janela."
            if codigo == "PRESSAO_INSTAVEL"
            else f"Ambiente simulado: desvio de nível em {descricao[variavel]}."
        )
        persistencia.alerta = Alerta(
            id=str(uuid4()), execucao_id=self.execucao_id, codigo=codigo, variavel=variavel,
            estado="ativo", iniciado_em=agora, sequencia_abertura=sequencia, encerrado_em=None,
            motivo_encerramento=None, valor_observado=valor, criterio_violado=criterio,
            mensagem=mensagem, recomendacao=VARIAVEIS[variavel].recomendacao,
        )
        return persistencia.alerta
