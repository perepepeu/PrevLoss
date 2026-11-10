from collections.abc import Sequence

import numpy as np

from .config import LEITURAS_CALIBRACAO, VARIAVEIS
from .schemas import Estatistica, Estatisticas, Medidas


def calcular_referencia(leituras: Sequence[Medidas]) -> Estatisticas:
    if len(leituras) != LEITURAS_CALIBRACAO:
        raise ValueError("A referência exige 60 leituras válidas.")
    estatisticas = {}
    for nome, regra in VARIAVEIS.items():
        valores = [getattr(leitura, regra.campo) for leitura in leituras]
        if any(valor is None for valor in valores):
            raise ValueError("A referência não aceita medidas ausentes.")
        estatisticas[nome] = Estatistica(
            media=float(np.mean(valores)), desvio_padrao=float(np.std(valores, ddof=0))
        )
    return Estatisticas(**estatisticas)
