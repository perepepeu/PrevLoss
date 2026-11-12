import { useRef, useState } from 'react';
import { usePrevLoss } from '../hooks/usePrevLoss';
import { ActiveAlerts, CalibrationStatus, HealthPanel, SensorCards } from '../components/Indicators';
import { SensorCharts } from '../components/Charts';
import { EventTimeline, HistoryTable } from '../components/History';
import { date, scenarioName } from '../components/format';
import type { Cenario } from '../types/api';

export function Dashboard() {
  const model = usePrevLoss();
  const { state, monitor } = model;
  const [tab, setTab] = useState<'monitor' | 'history'>('monitor');
  const [details, setDetails] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const ready = state?.calibracao.estado === 'concluida';
  const collecting = state?.calibracao.estado === 'em_andamento';
  const running = state?.estado_simulacao === 'executando';
  const disabled = model.connection !== 'connected' || model.pending || (import.meta.env.DEV && new URLSearchParams(location.search).has('fixture'));
  const activeId = state?.execucao_atual_id ?? null;
  const selectedId = model.selected ?? activeId;
  const reading = state?.ultima_leitura ?? null;
  const activeReadings = activeId ? model.history[activeId] ?? [] : [];
  const selectedReadings = selectedId ? model.history[selectedId] ?? [] : [];
  const selectedExecution = model.executions.find(e => e.id === selectedId);
  const activeEvents = model.events.filter(e => e.execucao_id === activeId);
  const lastFailure = [...activeEvents].reverse().find(e => e.tipo === 'falha_geracao');
  const status = model.connection === 'connected' ? 'API conectada' : model.connection === 'connecting' ? 'Conectando à API' : model.connection === 'incompatible' ? 'Contrato incompatível' : 'Sem conexão';
  const primaryText = model.pending ? 'Aguarde…' : running ? 'Pausar' : collecting ? 'Retomar coleta' : !ready ? 'Iniciar referência' : reading ? 'Retomar simulação' : 'Iniciar simulação';
  return <>
    <a className="skip-link" href="#main">Ir para o conteúdo</a>
    <header className="app-header"><div className="header-inner"><a className="brand" href="#main" aria-label="prevLoss, início"><svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor"/><path d="M5 17h5l3-9 6 17 3-8h5" fill="none" stroke="white" strokeWidth="2"/></svg><span>prev<span>Loss</span></span></a><span className="simulation-label">Ambiente simulado</span><div className="connection"><span className={`connection-dot ${model.connection}`} /><span role="status">{status}</span></div><button className="detail-button" aria-expanded={details} onClick={() => setDetails(!details)}>Detalhes da simulação</button></div></header>
    <main id="main" className="shell">
      {import.meta.env.DEV && new URLSearchParams(location.search).has('fixture') && <p className="message" role="status">Modo de desenvolvimento · fixture: {new URLSearchParams(location.search).get('fixture')}. Dados de exemplo; comandos desativados neste modo.</p>}
      <div className="page-heading"><div><p className="context">Conjunto motor-bomba / Unidade virtual 01</p><h1>Monitoramento de condição</h1><p>Acompanhe as variáveis e observe a resposta aos cenários simulados.</p></div><div className="session-summary"><span className={`badge ${running ? 'live' : 'neutral'}`}>{running ? '● Em execução' : state?.estado_simulacao === 'pausada' ? 'Ⅱ Pausada' : '○ Não iniciada'}</span><small>Última sincronização<br/>{date(model.lastSync)}</small></div></div>
      {model.error && <section className="message error" role="alert"><div><strong>{model.connection === 'incompatible' ? 'A resposta da API precisa ser conferida' : 'A sincronização foi interrompida'}</strong><p>{model.error} {state && 'Os valores preservados são antigos; os comandos estão suspensos.'}</p></div><button onClick={monitor.retry}>Tentar sincronizar novamente</button></section>}
      {model.notice && <section className="message" role="status"><p>{model.notice}</p><button onClick={monitor.dismissNotice} aria-label="Fechar aviso">Fechar</button></section>}
      {model.actionError && <p className="message error" role="alert">{model.actionError} O estado será consultado novamente; a ação não será repetida automaticamente.</p>}
      {lastFailure && <p className="message error" role="alert">Falha de geração registrada: {lastFailure.mensagem} · {date(lastFailure.data_hora)}</p>}
      {details && <section className="panel technical" aria-label="Detalhes da simulação"><div className="section-heading"><div><h2>Detalhes da simulação</h2><p>Uma bomba virtual. Dados e referência estatística simulados.</p></div><button onClick={() => setDetails(false)}>Fechar detalhes</button></div>
        <dl><div><dt>Backend / contrato</dt><dd>{state?.versao_software ?? '—'} / {state?.versao_contrato ?? '—'}</dd></div><div><dt>Sessão</dt><dd>{state?.sessao_id ?? '—'}</dd></div><div><dt>Execução ativa</dt><dd data-testid="active-execution">{activeId ?? '—'}</dd></div><div><dt>Referência atual</dt><dd>{state?.calibracao.referencia_id ?? '—'}</dd></div><div><dt>Seed</dt><dd>{model.config?.seed_execucao_atual ?? model.config?.seed_padrao ?? 42}</dd></div><div><dt>Cadência</dt><dd>{model.config?.intervalo_s ?? '—'} s por leitura</dd></div></dl>
        <p>O histórico permanece enquanto o servidor estiver aberto. Recarregar esta página preserva a sessão; reiniciar o servidor elimina os registros.</p>
        <details><summary>Parâmetros e referências da sessão</summary><pre>{JSON.stringify({ configuracao: model.config, referencias: model.references }, null, 2)}</pre></details>
        <div className="recalibrate"><button disabled={disabled || !ready || running || state?.cenario_selecionado !== 'normal'} onClick={() => dialog.current?.showModal()}>Refazer referência</button><small>Disponível com referência pronta, cenário Normal e simulação pausada.</small></div>
      </section>}
      <section className="controls" aria-label="Controles da execução ativa"><label htmlFor="scenario">Cenário ativo<select id="scenario" value={state?.cenario_selecionado ?? 'normal'} disabled={disabled || !ready || collecting} onChange={event => void monitor.command('cenario', { cenario: event.target.value as Cenario })}>{model.scenarios.length ? model.scenarios.map(c => <option value={c.id} key={c.id}>{c.nome}</option>) : <option value="normal">Normal</option>}</select></label><div className="control-description"><strong>{scenarioName(state?.cenario_selecionado ?? 'normal')}</strong><p>{collecting ? 'Conclua a referência antes de trocar o cenário.' : 'Trocar o cenário prepara outra execução, pausada.'}</p></div><div className="control-actions"><button className="primary" disabled={disabled} onClick={() => void monitor.command(running ? 'pausar' : 'iniciar')}>{primaryText}</button><button disabled={disabled || !ready} onClick={() => void monitor.command('reiniciar', { seed: 42 })}>Nova execução</button></div></section>
      <CalibrationStatus state={state}/>
      <nav className="tabs" aria-label="Visualização"><button aria-current={tab === 'monitor' ? 'page' : undefined} onClick={() => { setTab('monitor'); monitor.select(null); }}>Monitoramento</button><button aria-current={tab === 'history' ? 'page' : undefined} onClick={() => setTab('history')}>Histórico da sessão <span>{model.executions.length}</span></button></nav>
      {tab === 'monitor' ? <div className={model.connection !== 'connected' && state ? 'stale' : ''}>
        <div className="measurement-context"><span>{activeId ? `Execução ${activeId.slice(0, 8)}` : 'Nenhuma execução iniciada'}</span><span>{reading ? `Leitura ${reading.sequencia} · ${reading.tempo_simulado_s} s simulados` : 'Aguardando leitura'}{model.connection !== 'connected' && state ? ' · dados antigos' : ''}</span></div>
        <SensorCards reading={reading}/><div className="condition-grid"><HealthPanel reading={reading}/><ActiveAlerts alerts={state?.alertas_ativos ?? []} reading={reading} available={!!state}/></div>
        <SensorCharts readings={activeReadings}/><EventTimeline events={activeEvents}/>
      </div> : <div><section className="history-selection"><div><h2>Consultar uma execução</h2><p>A seleção abaixo altera somente a consulta. Os controles acima operam a execução ativa.</p></div><label htmlFor="history-execution">Execução<select id="history-execution" aria-label="Execução" value={selectedId ?? ''} disabled={!model.executions.length} onChange={event => monitor.select(event.target.value || null)}><option value="" disabled>Selecione uma execução</option>{[...model.executions].reverse().map(e => <option key={e.id} value={e.id}>{e.tipo === 'calibracao' ? 'Referência' : scenarioName(e.cenario)} · {date(e.criada_em)} · {e.id.slice(0, 8)}{e.id === activeId ? ' (ativa)' : ''}</option>)}</select></label></section>
        {selectedExecution && <p className="history-context">Consultando: {selectedExecution.id} · seed {selectedExecution.seed} · referência {selectedExecution.referencia_id ?? 'em coleta'}</p>}
        <SensorCharts readings={selectedReadings}/><HistoryTable key={selectedId} readings={selectedReadings}/><EventTimeline events={model.events.filter(e => e.execucao_id === selectedId)}/>
      </div>}
      <footer><span>prevLoss · Protótipo acadêmico</span><span>Dados simulados. Sem sensores físicos ou diagnóstico industrial.</span></footer>
    </main>
    <dialog ref={dialog} aria-labelledby="recalibration-title"><h2 id="recalibration-title">Coletar uma nova referência?</h2><p>A referência atual deixará de avaliar novas leituras. Uma nova coleta Normal será iniciada com seed 42. O histórico anterior permanecerá nesta sessão.</p><div className="dialog-actions"><button autoFocus onClick={() => dialog.current?.close()}>Cancelar</button><button className="primary" onClick={() => { dialog.current?.close(); void monitor.command('recalibrar', { seed: 42 }); }}>Iniciar nova referência</button></div></dialog>
  </>;
}
