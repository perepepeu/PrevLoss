from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, StrictInt

Cenario = Literal["normal", "aquecimento", "vibracao_elevada", "pressao_instavel", "multiplos_desvios"]
Variavel = Literal["temperatura", "vibracao", "corrente", "pressao"]
TipoExecucao = Literal["calibracao", "teste"]
EstadoSimulacao = Literal["parada", "executando", "pausada"]
Qualidade = Literal["valida", "ausente", "invalida"]
Classificacao = Literal["Normal", "Atenção", "Crítico"]
Indisponibilidade = Literal["REFERENCIA_AUSENTE", "DADOS_AUSENTES", "DADOS_INVALIDOS"]
CodigoQualidade = Literal["AUSENTE", "NAO_NUMERICO", "NAO_FINITO", "FORA_DA_FAIXA_NUMERICA"]
CodigoAlerta = Literal["DESVIO_INDIVIDUAL", "PRESSAO_INSTAVEL"]
MotivoEncerramento = Literal["recuperacao", "execucao_encerrada"]
TipoEvento = Literal[
    "execucao_criada", "execucao_encerrada", "simulacao_iniciada", "simulacao_pausada",
    "calibracao_iniciada", "calibracao_concluida", "falha_dados", "falha_geracao",
    "alerta_aberto", "alerta_encerrado",
]
Nota = Annotated[FiniteFloat, Field(ge=0, le=100)]
Seed = Annotated[StrictInt, Field(ge=0, le=2**32 - 1)]
Positivo = Annotated[int, Field(gt=0)]
NaoNegativo = Annotated[int, Field(ge=0)]


class Modelo(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Medidas(Modelo):
    temperatura_c: FiniteFloat | None
    vibracao_rms_ms2: FiniteFloat | None
    corrente_a: FiniteFloat | None
    pressao_bar: FiniteFloat | None


class Pontos(Modelo):
    temperatura: Nota | None
    vibracao: Nota | None
    corrente: Nota | None
    pressao: Nota | None


class Perdas(Modelo):
    por_variavel: Pontos
    principais: tuple[Variavel, ...]


class Estatistica(Modelo):
    media: FiniteFloat
    desvio_padrao: Annotated[FiniteFloat, Field(ge=0)]


class Estatisticas(Modelo):
    temperatura: Estatistica
    vibracao: Estatistica
    corrente: Estatistica
    pressao: Estatistica


class Referencia(Modelo):
    id: str
    execucao_calibracao_id: str
    criada_em: datetime
    seed: Seed
    coletadas: Positivo
    estatisticas: Estatisticas


class MotivoQualidade(Modelo):
    variavel: Variavel
    codigo: CodigoQualidade


class Leitura(Medidas):
    sessao_id: str
    execucao_id: str
    referencia_id: str | None
    sequencia: Positivo
    data_hora: datetime
    tempo_simulado_s: Positivo
    cenario: Cenario
    qualidade_dados: Qualidade
    motivos_qualidade: tuple[MotivoQualidade, ...]
    pontuacoes: Pontos
    ise: Nota | None
    classificacao: Classificacao | None
    motivo_indisponibilidade: Indisponibilidade | None
    contribuicoes_perda: Perdas | None
    recomendacoes: tuple[str, ...]


class Alerta(Modelo):
    id: str
    execucao_id: str
    codigo: CodigoAlerta
    variavel: Variavel
    estado: Literal["ativo", "encerrado"]
    iniciado_em: datetime
    sequencia_abertura: Positivo
    encerrado_em: datetime | None
    motivo_encerramento: MotivoEncerramento | None
    valor_observado: FiniteFloat
    criterio_violado: str
    mensagem: str
    recomendacao: str


class Calibracao(Modelo):
    estado: Literal["nao_iniciada", "em_andamento", "concluida"]
    coletadas: NaoNegativo
    necessarias: Positivo
    referencia_id: str | None


class Estado(Modelo):
    versao_contrato: str
    versao_software: str
    sessao_id: str
    revisao_estado: NaoNegativo
    estado_simulacao: EstadoSimulacao
    cenario_selecionado: Cenario
    calibracao: Calibracao
    execucao_atual_id: str | None
    ultima_leitura: Leitura | None
    alertas_ativos: tuple[Alerta, ...]


class InfoExecucao(Modelo):
    id: str
    sessao_id: str
    tipo: TipoExecucao
    cenario: Cenario
    seed: Seed
    referencia_id: str | None
    criada_em: datetime
    encerrada_em: datetime | None
    total_leituras: NaoNegativo


class Execucoes(Modelo):
    execucoes: tuple[InfoExecucao, ...]
    referencias: tuple[Referencia, ...]


class Evento(Modelo):
    id: str
    sessao_id: str
    execucao_id: str | None
    tipo: TipoEvento
    data_hora: datetime
    sequencia: Positivo | None
    referencia_id: str | None
    alerta: Alerta | None
    motivos_qualidade: tuple[MotivoQualidade, ...]
    mensagem: str


class Eventos(Modelo):
    execucao_id: str | None
    itens: tuple[Evento, ...]


class PaginaHistorico(Modelo):
    execucao_id: str
    itens: tuple[Leitura, ...]
    proxima_sequencia: NaoNegativo
    tem_mais: bool


class Saude(Modelo):
    status: Literal["ok"]
    versao_software: str


class InfoCenario(Modelo):
    id: Cenario
    nome: str
    descricao: str


class RegraVariavel(Modelo):
    campo: str
    unidade: str
    base: FiniteFloat
    ruido_dp: FiniteFloat
    tolerancia_minima: FiniteFloat
    peso: FiniteFloat
    direcao: Literal["aumento", "bilateral"]
    recomendacao: str


class ParametrosCenarios(Modelo):
    inicio_desvios_s: NaoNegativo
    aquecimento_por_s: FiniteFloat
    aquecimento_max_c: FiniteFloat
    vibracao_por_s: FiniteFloat
    vibracao_max_ms2: FiniteFloat
    oscilacao_pressao_bar: FiniteFloat
    periodo_pressao_s: Positivo
    queda_pressao_por_s: FiniteFloat
    queda_pressao_max_bar: FiniteFloat


class ParametrosAvaliacao(Modelo):
    limite_atencao: Nota
    limite_normal: Nota
    multiplicador_dispersao: FiniteFloat
    razao_inicio_perda: FiniteFloat
    razao_nota_zero: FiniteFloat
    persistencia: Positivo
    janela_pressao: Positivo
    limiar_minimo_pressao_bar: FiniteFloat
    modulo_maximo_leitura: FiniteFloat


class Configuracao(Modelo):
    versao_contrato: str
    versao_software: str
    ambiente: Literal["simulado"]
    intervalo_s: Positivo
    leituras_calibracao: Positivo
    leituras_roteiro_teste: Positivo
    seed_padrao: Seed
    seed_execucao_atual: Seed | None
    rng: str
    dominios_rng: dict[TipoExecucao, NaoNegativo]
    pesos: dict[Variavel, FiniteFloat]
    variaveis: dict[Variavel, RegraVariavel]
    cenarios: ParametrosCenarios
    avaliacao: ParametrosAvaliacao
    referencia: Referencia | None


class ComandoVazio(Modelo):
    pass


class ComandoCenario(Modelo):
    cenario: Cenario


class ComandoSeed(Modelo):
    seed: Seed


class Erro(Modelo):
    codigo: str
    mensagem: str
    detalhes: dict


class EnvelopeErro(Modelo):
    erro: Erro
