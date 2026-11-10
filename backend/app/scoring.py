import math
from collections.abc import Mapping
from dataclasses import dataclass

from .config import PARAMETROS_AVALIACAO as P, PESOS, VARIAVEIS
from .schemas import (
    Classificacao, CodigoQualidade, Estatisticas, Medidas, MotivoQualidade, Perdas,
    Pontos, Qualidade, Variavel,
)

SEM_PONTOS = Pontos(temperatura=None, vibracao=None, corrente=None, pressao=None)


def codigo_qualidade(valor: object) -> CodigoQualidade | None:
    if valor is None:
        return "AUSENTE"
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        return "NAO_NUMERICO"
    if isinstance(valor, float) and not math.isfinite(valor):
        return "NAO_FINITO"
    if abs(valor) > P.modulo_maximo_leitura:
        return "FORA_DA_FAIXA_NUMERICA"
    return None


def validar(brutas: Mapping[str, object]) -> tuple[Medidas, Qualidade, tuple[MotivoQualidade, ...]]:
    saneadas = {}
    motivos = []
    for nome, regra in VARIAVEIS.items():
        valor = brutas.get(regra.campo)
        codigo = codigo_qualidade(valor)
        saneadas[regra.campo] = float(valor) if codigo is None else None
        if codigo is not None:
            motivos.append(MotivoQualidade(variavel=nome, codigo=codigo))
    qualidade = "valida"
    if motivos:
        qualidade = "invalida" if any(m.codigo != "AUSENTE" for m in motivos) else "ausente"
    return Medidas(**saneadas), qualidade, tuple(motivos)


def nota_por_razao(razao: float) -> float:
    if not math.isfinite(razao) or razao < 0:
        raise ValueError("A razão de desvio deve ser finita e não negativa.")
    if razao <= P.razao_inicio_perda:
        return 100
    if razao >= P.razao_nota_zero:
        return 0
    return 100 * (P.razao_nota_zero - razao) / (P.razao_nota_zero - P.razao_inicio_perda)


def classificar_ise(ise: float) -> Classificacao:
    if not math.isfinite(ise) or not 0 <= ise <= 100:
        raise ValueError("ISE deve estar entre 0 e 100.")
    if ise >= P.limite_normal:
        return "Normal"
    if ise >= P.limite_atencao:
        return "Atenção"
    return "Crítico"


@dataclass(frozen=True)
class Avaliacao:
    razoes: dict[Variavel, float]
    pontuacoes: Pontos
    ise: float | None
    classificacao: Classificacao | None
    perdas: Perdas | None


def avaliar(medidas: Medidas, referencia: Estatisticas | None) -> Avaliacao:
    if referencia is None:
        return Avaliacao({}, SEM_PONTOS, None, None, None)

    razoes = {}
    notas = {}
    for nome, regra in VARIAVEIS.items():
        valor = getattr(medidas, regra.campo)
        if valor is None:
            notas[nome] = None
            continue
        estatistica = getattr(referencia, nome)
        tolerancia = max(P.multiplicador_dispersao * estatistica.desvio_padrao, regra.tolerancia_minima)
        diferenca = valor - estatistica.media
        desvio = max(0, diferenca) if regra.direcao == "aumento" else abs(diferenca)
        razoes[nome] = desvio / tolerancia
        notas[nome] = nota_por_razao(razoes[nome])

    pontos = Pontos(**notas)
    if len(razoes) != len(VARIAVEIS):
        return Avaliacao(razoes, pontos, None, None, None)

    ise = math.fsum(PESOS[nome] * notas[nome] for nome in VARIAVEIS)
    perdas = {nome: PESOS[nome] * (100 - notas[nome]) for nome in VARIAVEIS}
    maior = max(perdas.values())
    principais = tuple(
        nome for nome, perda in perdas.items()
        if perda > 0 and math.isclose(perda, maior, rel_tol=1e-12, abs_tol=1e-12)
    )
    return Avaliacao(razoes, pontos, ise, classificar_ise(ise),
                     Perdas(por_variavel=Pontos(**perdas), principais=principais))
