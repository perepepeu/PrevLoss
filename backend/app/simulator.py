import math

from numpy.random import PCG64, Generator, SeedSequence

from .config import DOMINIOS_RNG, PARAMETROS_CENARIOS, VARIAVEIS
from .schemas import Cenario, TipoExecucao


class Simulador:
    """Uma instância e um fluxo aleatório por execução."""

    def __init__(self, seed: int, tipo: TipoExecucao):
        self.rng = Generator(PCG64(SeedSequence([seed, DOMINIOS_RNG[tipo]])))

    def __call__(self, cenario: Cenario, tempo_s: int) -> dict[str, float]:
        p = PARAMETROS_CENARIOS
        t = max(0, tempo_s - p.inicio_desvios_s)
        valores = {v.campo: float(self.rng.normal(v.base, v.ruido_dp)) for v in VARIAVEIS.values()}
        if cenario in ("aquecimento", "multiplos_desvios"):
            valores["temperatura_c"] += min(p.aquecimento_por_s * t, p.aquecimento_max_c)
        if cenario in ("vibracao_elevada", "multiplos_desvios"):
            valores["vibracao_rms_ms2"] += min(p.vibracao_por_s * t, p.vibracao_max_ms2)
        if cenario == "pressao_instavel":
            valores["pressao_bar"] += p.oscilacao_pressao_bar * math.sin(math.tau * t / p.periodo_pressao_s)
        if cenario == "multiplos_desvios":
            valores["pressao_bar"] -= min(p.queda_pressao_por_s * t, p.queda_pressao_max_bar)
        return valores
