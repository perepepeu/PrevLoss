import json
import os
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from uuid import uuid4

from .alerts import MotorAlertas
from .calibration import calcular_referencia
from .config import (
    DOMINIOS_RNG, INTERVALO_S, LEITURAS_CALIBRACAO, LEITURAS_ROTEIRO, PARAMETROS_AVALIACAO,
    PARAMETROS_CENARIOS, PESOS, SEED_PADRAO, VARIAVEIS, VERSAO_CONTRATO, VERSAO_SOFTWARE,
)
from .schemas import (
    Alerta, Calibracao, Cenario, Configuracao, Estado, EstadoSimulacao, Evento,
    Eventos, Execucoes, Indisponibilidade, InfoExecucao, Leitura, Medidas, MotivoQualidade,
    PaginaHistorico, Referencia, TipoEvento, TipoExecucao,
)
from .scoring import avaliar, validar
from .simulator import Simulador

Fonte = Callable[[Cenario, int], Mapping[str, object]]
Fabrica = Callable[[int, TipoExecucao], Fonte]


class Conflito(Exception):
    def __init__(self, codigo: str, mensagem: str):
        self.codigo = codigo
        super().__init__(mensagem)


class ExecucaoInexistente(Exception):
    pass


@dataclass
class Execucao:
    id: str
    tipo: TipoExecucao
    cenario: Cenario
    seed: int
    referencia: Referencia | None
    criada_em: datetime
    fonte: Fonte
    alertas: MotorAlertas
    encerrada_em: datetime | None = None
    leituras: list[Leitura] = field(default_factory=list)
    amostra: list[Medidas] = field(default_factory=list)

    @property
    def referencia_id(self) -> str | None:
        return self.referencia.id if self.referencia is not None else None


class Sessao:
    """Um escritor por vez. Leituras, eventos e referências são registros imutáveis."""

    def __init__(self, fabrica: Fabrica = Simulador, relogio: Callable[[], datetime] | None = None,
                 snapshot_path: Path | None = None):
        self._lock = RLock()
        self._fabrica = fabrica
        self._agora = relogio if relogio is not None else lambda: datetime.now(UTC)
        self._id = str(uuid4())
        self._revisao = 0
        self._modo: EstadoSimulacao = "parada"
        self._cenario: Cenario = "normal"
        self._referencia: Referencia | None = None
        self._atual: Execucao | None = None
        self._execucoes: dict[str, Execucao] = {}
        self._referencias: list[Referencia] = []
        self._eventos: list[Evento] = []
        self._snapshot_path = snapshot_path
        if snapshot_path is not None and snapshot_path.exists():
            self._restaurar(json.loads(snapshot_path.read_text(encoding="utf-8")))

    def _restaurar(self, data: dict) -> None:
        if data.get("versao") != 1:
            raise ValueError("Versão do arquivo de sessão incompatível.")
        self._id = data["id"]
        self._revisao = data["revisao"]
        self._modo = "pausada" if data["modo"] == "executando" else data["modo"]
        self._cenario = data["cenario"]
        self._referencias = [Referencia.model_validate(item) for item in data["referencias"]]
        referencias = {item.id: item for item in self._referencias}
        self._referencia = referencias.get(data["referencia_id"])
        self._eventos = [Evento.model_validate(item) for item in data["eventos"]]
        for item in data["execucoes"]:
            fonte = self._fabrica(item["seed"], item["tipo"])
            if not isinstance(fonte, Simulador):
                raise ValueError("A restauração exige o simulador padrão.")
            fonte.rng.bit_generator.state = item["rng_state"]
            alertas = MotorAlertas(item["id"])
            for nome, state in item["alertas"]["niveis"].items():
                alertas.niveis[nome].consecutivas = state["consecutivas"]
                alertas.niveis[nome].alerta = Alerta.model_validate(state["alerta"]) if state["alerta"] else None
            state = item["alertas"]["oscilacao"]
            alertas.oscilacao.consecutivas = state["consecutivas"]
            alertas.oscilacao.alerta = Alerta.model_validate(state["alerta"]) if state["alerta"] else None
            alertas.janela.extend(item["alertas"]["janela"])
            execucao = Execucao(
                id=item["id"], tipo=item["tipo"], cenario=item["cenario"], seed=item["seed"],
                referencia=referencias.get(item["referencia_id"]),
                criada_em=datetime.fromisoformat(item["criada_em"]), fonte=fonte, alertas=alertas,
                encerrada_em=datetime.fromisoformat(item["encerrada_em"]) if item["encerrada_em"] else None,
                leituras=[Leitura.model_validate(value) for value in item["leituras"]],
                amostra=[Medidas.model_validate(value) for value in item["amostra"]],
            )
            self._execucoes[execucao.id] = execucao
        self._atual = self._execucoes.get(data["atual_id"])

    def _salvar(self) -> None:
        if self._snapshot_path is None:
            return
        def dump(value):
            return value.model_dump(mode="json") if value is not None else None
        def persistence(value):
            return {"consecutivas": value.consecutivas, "alerta": dump(value.alerta)}
        execucoes = []
        for item in self._execucoes.values():
            if not isinstance(item.fonte, Simulador):
                raise ValueError("A persistência exige o simulador padrão.")
            execucoes.append({
                "id": item.id, "tipo": item.tipo, "cenario": item.cenario, "seed": item.seed,
                "referencia_id": item.referencia_id, "criada_em": item.criada_em.isoformat(),
                "encerrada_em": item.encerrada_em.isoformat() if item.encerrada_em else None,
                "leituras": [dump(value) for value in item.leituras],
                "amostra": [dump(value) for value in item.amostra],
                "rng_state": item.fonte.rng.bit_generator.state,
                "alertas": {
                    "niveis": {nome: persistence(value) for nome, value in item.alertas.niveis.items()},
                    "oscilacao": persistence(item.alertas.oscilacao),
                    "janela": list(item.alertas.janela),
                },
            })
        data = {
            "versao": 1, "id": self._id, "revisao": self._revisao, "modo": self._modo,
            "cenario": self._cenario, "referencia_id": self._referencia.id if self._referencia else None,
            "atual_id": self._atual.id if self._atual else None,
            "referencias": [dump(value) for value in self._referencias],
            "eventos": [dump(value) for value in self._eventos], "execucoes": execucoes,
        }
        path = self._snapshot_path
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        with temporary.open("w", encoding="utf-8") as output:
            json.dump(data, output, ensure_ascii=False, allow_nan=False)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)

    def estado(self) -> Estado:
        with self._lock:
            return self._estado()

    def _estado(self) -> Estado:
        atual = self._atual
        fase = "nao_iniciada"
        coletadas = 0
        if self._referencia is not None:
            fase = "concluida"
            coletadas = self._referencia.coletadas
        elif atual is not None and atual.tipo == "calibracao":
            fase = "em_andamento"
            coletadas = len(atual.amostra)
        return Estado(
            versao_contrato=VERSAO_CONTRATO, versao_software=VERSAO_SOFTWARE, sessao_id=self._id,
            revisao_estado=self._revisao, estado_simulacao=self._modo, cenario_selecionado=self._cenario,
            calibracao=Calibracao(estado=fase, coletadas=coletadas, necessarias=LEITURAS_CALIBRACAO,
                                 referencia_id=self._referencia.id if self._referencia else None),
            execucao_atual_id=atual.id if atual else None,
            ultima_leitura=atual.leituras[-1] if atual and atual.leituras else None,
            alertas_ativos=atual.alertas.ativos() if atual else (),
        )

    def configuracao(self) -> Configuracao:
        with self._lock:
            return Configuracao(
                versao_contrato=VERSAO_CONTRATO, versao_software=VERSAO_SOFTWARE, ambiente="simulado",
                intervalo_s=INTERVALO_S, leituras_calibracao=LEITURAS_CALIBRACAO,
                leituras_roteiro_teste=LEITURAS_ROTEIRO, seed_padrao=SEED_PADRAO,
                seed_execucao_atual=self._atual.seed if self._atual is not None else None,
                rng="NumPy Generator(PCG64(SeedSequence([seed, dominio])))",
                dominios_rng=dict(DOMINIOS_RNG), pesos=dict(PESOS), variaveis=dict(VARIAVEIS),
                cenarios=PARAMETROS_CENARIOS, avaliacao=PARAMETROS_AVALIACAO, referencia=self._referencia,
            )

    def _buscar(self, execucao_id: str) -> Execucao:
        try:
            return self._execucoes[execucao_id]
        except KeyError:
            raise ExecucaoInexistente(execucao_id) from None

    def execucoes(self) -> Execucoes:
        with self._lock:
            return Execucoes(
                execucoes=tuple(
                    InfoExecucao(
                        id=e.id, sessao_id=self._id, tipo=e.tipo, cenario=e.cenario, seed=e.seed,
                        referencia_id=e.referencia_id, criada_em=e.criada_em, encerrada_em=e.encerrada_em,
                        total_leituras=len(e.leituras),
                    ) for e in self._execucoes.values()
                ),
                referencias=tuple(self._referencias),
            )

    def historico(self, execucao_id: str, apos_sequencia: int, limite: int) -> PaginaHistorico:
        with self._lock:
            leituras = self._buscar(execucao_id).leituras
            itens = tuple(leituras[apos_sequencia:apos_sequencia + limite])
            proxima = itens[-1].sequencia if itens else apos_sequencia
            return PaginaHistorico(
                execucao_id=execucao_id, itens=itens, proxima_sequencia=proxima,
                tem_mais=proxima < len(leituras),
            )

    def eventos(self, execucao_id: str | None = None) -> Eventos:
        with self._lock:
            if execucao_id is not None:
                self._buscar(execucao_id)
            return Eventos(execucao_id=execucao_id, itens=tuple(
                e for e in self._eventos if execucao_id is None or e.execucao_id == execucao_id
            ))

    def iniciar(self) -> Estado:
        with self._lock:
            if self._modo == "executando":
                return self._estado()
            agora = self._agora()
            if self._atual is None:
                self._iniciar_coleta(SEED_PADRAO, agora)
            self._modo = "executando"
            self._registrar("simulacao_iniciada", "Simulação iniciada ou retomada.", agora)
            return self._alterado()

    def pausar(self) -> Estado:
        with self._lock:
            if self._modo != "executando":
                return self._estado()
            agora = self._agora()
            self._modo = "pausada"
            self._registrar("simulacao_pausada", "Simulação pausada.", agora)
            return self._alterado()

    def selecionar(self, cenario: Cenario) -> Estado:
        with self._lock:
            if self._atual is not None and self._atual.tipo == "calibracao":
                raise Conflito("CALIBRACAO_EM_ANDAMENTO", "Conclua a calibração antes de trocar o cenário.")
            if self._referencia is None and cenario != "normal":
                raise Conflito("REFERENCIA_AUSENTE", "Inicie a calibração no cenário Normal.")
            agora = self._agora()
            if self._referencia is not None:
                nova = self._preparar("teste", cenario, SEED_PADRAO, self._referencia, agora)
                self._trocar(nova, agora)
            self._cenario = cenario
            self._modo = "pausada"
            return self._alterado()

    def reiniciar(self, seed: int) -> Estado:
        with self._lock:
            if self._referencia is None:
                raise Conflito("REFERENCIA_AUSENTE", "Inicie a calibração no cenário Normal.")
            agora = self._agora()
            nova = self._preparar("teste", self._cenario, seed, self._referencia, agora)
            self._trocar(nova, agora)
            self._modo = "pausada"
            return self._alterado()

    def recalibrar(self, seed: int) -> Estado:
        with self._lock:
            if self._cenario != "normal" or self._modo == "executando":
                raise Conflito("RECALIBRACAO_INDISPONIVEL", "Selecione Normal e pause antes de recalibrar.")
            agora = self._agora()
            self._iniciar_coleta(seed, agora)
            self._modo = "executando"
            self._registrar("simulacao_iniciada", "Simulação de calibração iniciada.", agora)
            return self._alterado()

    def _iniciar_coleta(self, seed: int, agora: datetime) -> None:
        nova = self._preparar("calibracao", "normal", seed, None, agora)
        self._trocar(nova, agora)
        self._referencia = None
        self._registrar("calibracao_iniciada", "Coleta de referência iniciada.", agora)

    def _preparar(
        self, tipo: TipoExecucao, cenario: Cenario, seed: int,
        referencia: Referencia | None, agora: datetime,
    ) -> Execucao:
        id_execucao = str(uuid4())
        return Execucao(
            id=id_execucao, tipo=tipo, cenario=cenario, seed=seed, referencia=referencia,
            criada_em=agora, fonte=self._fabrica(seed, tipo), alertas=MotorAlertas(id_execucao),
        )

    def _trocar(self, nova: Execucao, agora: datetime) -> None:
        if self._atual is not None:
            anterior = self._atual
            for alerta in anterior.alertas.encerrar(agora):
                self._registrar_alerta(alerta, agora, len(anterior.leituras))
            anterior.encerrada_em = agora
            anterior.amostra.clear()
            self._registrar("execucao_encerrada", "Execução encerrada.", agora)
        self._atual = nova
        self._execucoes[nova.id] = nova
        self._registrar("execucao_criada", "Execução criada.", agora)

    def _alterado(self) -> Estado:
        self._revisao += 1
        self._salvar()
        return self._estado()

    def _registrar(
        self, tipo: TipoEvento, mensagem: str, agora: datetime, *, sequencia: int | None = None,
        referencia_id: str | None = None, alerta: Alerta | None = None,
        motivos: tuple[MotivoQualidade, ...] = (),
    ) -> None:
        atual = self._atual
        self._eventos.append(Evento(
            id=str(uuid4()), sessao_id=self._id, execucao_id=atual.id if atual else None,
            tipo=tipo, data_hora=agora, sequencia=sequencia,
            referencia_id=referencia_id or (atual.referencia_id if atual else None),
            alerta=alerta, motivos_qualidade=motivos, mensagem=mensagem,
        ))

    def _registrar_alerta(self, alerta: Alerta, agora: datetime, sequencia: int) -> None:
        if alerta.estado == "ativo":
            self._registrar("alerta_aberto", alerta.mensagem, agora, sequencia=sequencia, alerta=alerta)
        else:
            self._registrar("alerta_encerrado", f"Alerta encerrado ({alerta.motivo_encerramento}).",
                            agora, sequencia=sequencia, alerta=alerta)

    def avancar(self) -> Leitura | None:
        with self._lock:
            execucao = self._atual
            if self._modo != "executando" or execucao is None:
                return None
            agora = self._agora()
            try:
                return self._gerar_leitura(execucao, agora)
            except Exception:
                self._modo = "pausada"
                self._registrar("falha_geracao", "Erro ao gerar leitura. Simulação pausada.", agora)
                self._registrar("simulacao_pausada", "Simulação pausada após erro de geração.", agora)
                self._revisao += 1
                self._salvar()
                raise

    def _gerar_leitura(self, execucao: Execucao, agora: datetime) -> Leitura:
        sequencia = len(execucao.leituras) + 1
        medidas, qualidade, motivos = validar(execucao.fonte(execucao.cenario, sequencia))
        estatisticas = execucao.referencia.estatisticas if execucao.referencia else None
        resultado = avaliar(medidas, estatisticas)
        indisponibilidade: Indisponibilidade | None = {
            "ausente": "DADOS_AUSENTES", "invalida": "DADOS_INVALIDOS",
        }.get(qualidade)
        if qualidade == "valida" and estatisticas is None:
            indisponibilidade = "REFERENCIA_AUSENTE"

        nova_execucao = None
        if execucao.tipo == "calibracao" and qualidade == "valida":
            amostra = [*execucao.amostra, medidas]
            if len(amostra) == LEITURAS_CALIBRACAO:
                referencia = Referencia(
                    id=str(uuid4()), execucao_calibracao_id=execucao.id, criada_em=agora,
                    seed=execucao.seed, coletadas=len(amostra), estatisticas=calcular_referencia(amostra),
                )
                nova_execucao = self._preparar("teste", "normal", execucao.seed, referencia, agora)
            execucao.amostra = amostra

        if qualidade != "valida":
            execucao.alertas.invalidar()
            self._registrar("falha_dados", "Leitura com dados inadequados.", agora,
                            sequencia=sequencia, motivos=motivos)
        elif estatisticas is not None:
            assert medidas.pressao_bar is not None
            for alerta in execucao.alertas.avaliar(
                resultado.razoes, medidas.pressao_bar, estatisticas, sequencia, agora
            ):
                self._registrar_alerta(alerta, agora, sequencia)

        recomendacoes = [
            VARIAVEIS[nome].recomendacao for nome, razao in resultado.razoes.items()
            if razao > PARAMETROS_AVALIACAO.razao_inicio_perda
        ]
        recomendacoes.extend(a.recomendacao for a in execucao.alertas.ativos())
        leitura = Leitura(
            **medidas.model_dump(), sessao_id=self._id, execucao_id=execucao.id,
            referencia_id=execucao.referencia_id, sequencia=sequencia, data_hora=agora,
            tempo_simulado_s=sequencia, cenario=execucao.cenario, qualidade_dados=qualidade,
            motivos_qualidade=motivos, pontuacoes=resultado.pontuacoes, ise=resultado.ise,
            classificacao=resultado.classificacao, motivo_indisponibilidade=indisponibilidade,
            contribuicoes_perda=resultado.perdas, recomendacoes=tuple(dict.fromkeys(recomendacoes)),
        )
        execucao.leituras.append(leitura)

        if nova_execucao is not None:
            self._referencia = referencia
            self._referencias.append(referencia)
            self._registrar("calibracao_concluida", "Referência de dados simulados congelada.",
                            agora, sequencia=sequencia, referencia_id=referencia.id)
            self._trocar(nova_execucao, agora)
            self._modo = "pausada"

        self._revisao += 1
        self._salvar()
        return leitura
