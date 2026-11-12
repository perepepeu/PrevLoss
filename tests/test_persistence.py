from backend.app.session_service import Sessao


def test_sessao_retomada_preserva_historico_referencia_e_fluxo_aleatorio(tmp_path):
    arquivo = tmp_path / "session.json"
    sessao = Sessao(snapshot_path=arquivo)
    sessao.iniciar()
    for _ in range(60):
        sessao.avancar()
    sessao.iniciar()
    for _ in range(8):
        sessao.avancar()

    anterior = sessao.estado()
    execucoes = sessao.execucoes()
    eventos = sessao.eventos()
    restaurada = Sessao(snapshot_path=arquivo)
    recuperado = restaurada.estado()

    assert recuperado.sessao_id == anterior.sessao_id
    assert recuperado.estado_simulacao == "pausada"
    assert recuperado.revisao_estado == anterior.revisao_estado
    assert recuperado.ultima_leitura == anterior.ultima_leitura
    assert restaurada.execucoes() == execucoes
    assert restaurada.eventos() == eventos
    assert restaurada.configuracao().referencia == sessao.configuracao().referencia

    sessao.avancar()
    restaurada.iniciar()
    proxima = restaurada.avancar()
    esperado = sessao.estado().ultima_leitura
    assert proxima.sequencia == esperado.sequencia
    assert proxima.model_dump(include={"temperatura_c", "vibracao_rms_ms2", "corrente_a", "pressao_bar", "ise"}) == esperado.model_dump(include={"temperatura_c", "vibracao_rms_ms2", "corrente_a", "pressao_bar", "ise"})
