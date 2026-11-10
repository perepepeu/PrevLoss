from math import fsum, isclose
from types import MappingProxyType

from .schemas import InfoCenario, ParametrosAvaliacao, ParametrosCenarios, RegraVariavel

VERSAO_CONTRATO = "1"
VERSAO_SOFTWARE = "0.1.0"
INTERVALO_S = 1
LEITURAS_CALIBRACAO = 60
LEITURAS_ROTEIRO = 120
SEED_PADRAO = 42
DOMINIOS_RNG = MappingProxyType({"calibracao": 0, "teste": 1})

VARIAVEIS = MappingProxyType({
    "temperatura": RegraVariavel(
        campo="temperatura_c", unidade="°C", base=45, ruido_dp=0.3,
        tolerancia_minima=1, peso=0.25, direcao="aumento",
        recomendacao="Ambiente simulado: verificar ventilação e condições operacionais em uma aplicação real.",
    ),
    "vibracao": RegraVariavel(
        campo="vibracao_rms_ms2", unidade="m/s² RMS", base=1.5, ruido_dp=0.03,
        tolerancia_minima=0.15, peso=0.30, direcao="aumento",
        recomendacao="Ambiente simulado: avaliar fixação e alinhamento em uma aplicação real.",
    ),
    "corrente": RegraVariavel(
        campo="corrente_a", unidade="A", base=8, ruido_dp=0.1,
        tolerancia_minima=0.4, peso=0.25, direcao="bilateral",
        recomendacao="Ambiente simulado: verificar carga e alimentação em uma aplicação real.",
    ),
    "pressao": RegraVariavel(
        campo="pressao_bar", unidade="bar", base=3, ruido_dp=0.03,
        tolerancia_minima=0.15, peso=0.20, direcao="bilateral",
        recomendacao="Ambiente simulado: verificar condições hidráulicas em uma aplicação real.",
    ),
})
PESOS = MappingProxyType({nome: regra.peso for nome, regra in VARIAVEIS.items()})
if not all(0 < peso <= 1 for peso in PESOS.values()) or not isclose(
    fsum(PESOS.values()), 1, rel_tol=0, abs_tol=1e-12
):
    raise ValueError("Os quatro pesos do ISE devem ser positivos e somar 1.")

CENARIOS = (
    InfoCenario(id="normal", nome="Normal", descricao="Valores de base com ruído simulado."),
    InfoCenario(id="aquecimento", nome="Aquecimento", descricao="Elevação gradual de temperatura."),
    InfoCenario(id="vibracao_elevada", nome="Vibração elevada", descricao="Elevação gradual de vibração."),
    InfoCenario(id="pressao_instavel", nome="Pressão instável", descricao="Oscilação periódica da pressão."),
    InfoCenario(id="multiplos_desvios", nome="Múltiplos desvios",
                descricao="Aquecimento, vibração elevada e redução de pressão combinados."),
)

PARAMETROS_CENARIOS = ParametrosCenarios(
    inicio_desvios_s=10, aquecimento_por_s=0.15, aquecimento_max_c=12,
    vibracao_por_s=0.025, vibracao_max_ms2=2, oscilacao_pressao_bar=0.6,
    periodo_pressao_s=8, queda_pressao_por_s=0.02, queda_pressao_max_bar=1.2,
)
PARAMETROS_AVALIACAO = ParametrosAvaliacao(
    limite_atencao=50, limite_normal=80, multiplicador_dispersao=3,
    razao_inicio_perda=1, razao_nota_zero=4, persistencia=3, janela_pressao=10,
    limiar_minimo_pressao_bar=0.20, modulo_maximo_leitura=1e6,
)
