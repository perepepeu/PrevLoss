from concurrent.futures import ThreadPoolExecutor

import pytest

from backend.app.session_service import Conflito, Sessao

BASE = dict(temperatura_c=45.0, vibracao_rms_ms2=1.5, corrente_a=8.0, pressao_bar=3.0)


class FonteControlada:
    def __init__(self):
        self.valores = BASE.copy()

    def fabrica(self, seed, tipo):
        return self.ler

    def ler(self, cenario, tempo):
        return self.valores.copy()


def coletar(sessao, total):
    return [sessao.avancar() for _ in range(total)]


def calibrar(sessao):
    sessao.iniciar()
    coletar(sessao, 60)
    estado = sessao.estado()
    assert estado.calibracao.estado == "concluida"
    assert estado.estado_simulacao == "pausada"
    return estado


def test_calibracao_conta_so_validas_e_tem_fluxo_separado():
    fonte = FonteControlada()
    sessao = Sessao(fabrica=fonte.fabrica)
    coleta = sessao.iniciar().execucao_atual_id
    fonte.valores["temperatura_c"] = None
    ausente = sessao.avancar()
    assert ausente.motivo_indisponibilidade == "DADOS_AUSENTES"
    assert sessao.estado().calibracao.coletadas == 0
    fonte.valores = BASE.copy()
    fonte.valores["temperatura_c"] = 44.0
    coletar(sessao, 30)
    fonte.valores["temperatura_c"] = 46.0
    ultimas = coletar(sessao, 29)
    assert ultimas[-1].ise is None
    assert sessao.estado().calibracao.coletadas == 59
    sessao.avancar()
    depois = sessao.estado()
    assert depois.calibracao.coletadas == 60
    assert depois.execucao_atual_id != coleta
    assert depois.ultima_leitura is None
    assert sessao.execucoes().referencias[0].estatisticas.temperatura.media == 45
    assert sessao.execucoes().referencias[0].estatisticas.temperatura.desvio_padrao == 1
    assert len(sessao.historico(coleta, 0, 100).itens) == 61
    sessao.iniciar()
    primeira = sessao.avancar()
    assert (primeira.sequencia, primeira.tempo_simulado_s, primeira.ise) == (1, 1, 100)


def test_get_pausa_e_controles_idempotentes():
    sessao = Sessao()
    inicial = sessao.estado()
    assert sessao.avancar() is None
    assert sessao.pausar() == inicial
    primeira_acao = sessao.iniciar()
    assert sessao.iniciar() == primeira_acao
    assert sessao.estado() == primeira_acao
    sessao.avancar()
    pausada = sessao.pausar()
    assert sessao.pausar() == pausada
    assert sessao.avancar() is None
    assert sessao.estado() == pausada
    sessao.iniciar()
    assert sessao.avancar().sequencia == 2


def test_seed_separa_coleta_e_teste_e_reproduz_reinicio():
    sessao = Sessao()
    calibrar(sessao)
    sessao.iniciar()
    original = coletar(sessao, 4)
    assert original[0].temperatura_c != sessao.historico(
        sessao.execucoes().execucoes[0].id, 0, 1).itens[0].temperatura_c
    nova = sessao.reiniciar(42)
    assert nova.ultima_leitura is None
    assert sessao.avancar() is None
    sessao.iniciar()
    repetida = coletar(sessao, 4)
    campos = {"temperatura_c", "vibracao_rms_ms2", "corrente_a", "pressao_bar", "ise", "classificacao"}
    assert [r.model_dump(include=campos) for r in original] == [
        r.model_dump(include=campos) for r in repetida
    ]
    assert repetida[0].execucao_id != original[0].execucao_id


def test_recalibracao_conserva_referencia_e_historico():
    sessao = Sessao()
    calibrar(sessao)
    sessao.iniciar()
    leitura = sessao.avancar()
    sessao.pausar()
    depois = sessao.recalibrar(19)
    assert depois.calibracao.referencia_id is None
    coletar(sessao, 60)
    assert sessao.estado().calibracao.referencia_id != leitura.referencia_id
    assert [ref.seed for ref in sessao.execucoes().referencias] == [42, 19]
    assert sessao.historico(leitura.execucao_id, 0, 100).itens == (leitura,)


def test_conflitos_nao_alteram_estado():
    sessao = Sessao()
    inicial = sessao.estado()
    with pytest.raises(Conflito, match="calibração"):
        sessao.selecionar("aquecimento")
    with pytest.raises(Conflito):
        sessao.reiniciar(42)
    assert sessao.estado() == inicial
    coletando = sessao.iniciar()
    with pytest.raises(Conflito):
        sessao.selecionar("normal")
    with pytest.raises(Conflito):
        sessao.recalibrar(42)
    assert sessao.estado() == coletando


def test_historico_paginado_e_execucoes_separadas():
    sessao = Sessao()
    calibrar(sessao)
    sessao.iniciar()
    leituras = coletar(sessao, 5)
    atual = leituras[0].execucao_id
    nova = sessao.selecionar("vibracao_elevada")
    assert nova.estado_simulacao == "pausada"
    assert sessao.historico(nova.execucao_atual_id, 0, 2).itens == ()
    primeira = sessao.historico(atual, 0, 2)
    assert primeira.itens == tuple(leituras[:2])
    assert primeira.tem_mais
    ultima = sessao.historico(atual, primeira.proxima_sequencia, 10)
    assert ultima.itens == tuple(leituras[2:])
    assert not ultima.tem_mais
    assert ultima.proxima_sequencia == 5


def test_geracao_concorrente_serializa_sequencias():
    sessao = Sessao()
    calibrar(sessao)
    execucao = sessao.iniciar().execucao_atual_id
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda _: sessao.avancar(), range(100)))
    assert [r.sequencia for r in sessao.historico(execucao, 0, 1000).itens] == list(range(1, 101))


def test_alerta_individual_normal_persistencia_invalidez_e_recuperacao():
    fonte = FonteControlada()
    sessao = Sessao(fabrica=fonte.fabrica)
    calibrar(sessao)
    sessao.iniciar()
    fonte.valores["vibracao_rms_ms2"] = 1.875
    coletar(sessao, 2)
    assert sessao.estado().alertas_ativos == ()
    abertura = sessao.avancar()
    (alerta,) = sessao.estado().alertas_ativos
    assert abertura.ise == pytest.approx(85)
    assert abertura.classificacao == "Normal"
    assert alerta.sequencia_abertura == 3
    coletar(sessao, 2)
    assert sessao.estado().alertas_ativos == (alerta,)
    fonte.valores = BASE.copy()
    coletar(sessao, 2)
    fonte.valores["corrente_a"] = float("nan")
    invalida = sessao.avancar()
    assert invalida.ise is None
    assert invalida.pontuacoes.vibracao == 100
    assert sessao.estado().alertas_ativos == (alerta,)
    fonte.valores = BASE.copy()
    coletar(sessao, 2)
    assert sessao.estado().alertas_ativos == (alerta,)
    sessao.avancar()
    assert sessao.estado().alertas_ativos == ()
    eventos = sessao.eventos(abertura.execucao_id).itens
    encerrado = next(e.alerta for e in eventos if e.tipo == "alerta_encerrado")
    assert encerrado.motivo_encerramento == "recuperacao"
    assert encerrado.id == alerta.id
    assert any(e.tipo == "falha_dados" for e in eventos)


def test_janela_pressao_exige_dez_validas_e_tres_avaliacoes_e_preserva_alerta():
    fonte = FonteControlada()
    sessao = Sessao(fabrica=fonte.fabrica)
    calibrar(sessao)
    execucao = sessao.iniciar().execucao_atual_id
    for i in range(12):
        fonte.valores["pressao_bar"] = 3 + (0.35 if i % 2 else -0.35)
        sessao.avancar()
        assert any(a.codigo == "PRESSAO_INSTAVEL" for a in sessao.estado().alertas_ativos) == (i == 11)
    oscilacao = next(a for a in sessao.estado().alertas_ativos if a.codigo == "PRESSAO_INSTAVEL")
    assert oscilacao.valor_observado == pytest.approx(0.35)
    assert oscilacao.sequencia_abertura == 12
    fonte.valores["pressao_bar"] = None
    sessao.avancar()
    fonte.valores = BASE.copy()
    coletar(sessao, 11)
    assert sessao.estado().alertas_ativos == (oscilacao,)
    sessao.avancar()
    assert sessao.estado().alertas_ativos == ()
    assert any(e.tipo == "alerta_encerrado" and e.alerta.id == oscilacao.id
               for e in sessao.eventos(execucao).itens)


def test_troca_encerra_alerta_sem_indicar_recuperacao():
    fonte = FonteControlada()
    sessao = Sessao(fabrica=fonte.fabrica)
    calibrar(sessao)
    anterior = sessao.iniciar().execucao_atual_id
    fonte.valores["temperatura_c"] = 49
    coletar(sessao, 3)
    (alerta,) = sessao.estado().alertas_ativos
    assert sessao.selecionar("aquecimento").alertas_ativos == ()
    fim = next(e.alerta for e in sessao.eventos(anterior).itens if e.tipo == "alerta_encerrado")
    assert fim.id == alerta.id
    assert fim.motivo_encerramento == "execucao_encerrada"
