import { useRef, useState } from 'react';
import { usePrevLoss } from '../hooks/usePrevLoss';
import { ActiveAlerts, CalibrationStatus, HealthPanel, SensorCards } from '../components/Indicators';
import { SensorCharts } from '../components/Charts';
import { EventTimeline, HistoryTable } from '../components/History';
import { cleanCopy, conditionClass, date, iseText, scenarioName } from '../components/format';
import { OnboardingTour, shouldStartOnboarding } from '../components/OnboardingTour';
import type { Cenario } from '../types/api';

export function Dashboard() {
  const model = usePrevLoss();
  const { state, monitor } = model;
  const [tab, setTab] = useState<'monitor' | 'history'>('monitor');
  const [details, setDetails] = useState(false);
  const [tourOpen, setTourOpen] = useState(shouldStartOnboarding);
  const dialog = useRef<HTMLDialogElement>(null);
  const restartDialog = useRef<HTMLDialogElement>(null);
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
  const status = model.connection === 'connected' ? 'Sistema online' : model.connection === 'connecting' ? 'Conectando' : model.connection === 'incompatible' ? 'Dados incompatíveis' : 'Sem conexão';
  const primaryText = model.pending ? 'Aguarde…' : running ? 'Pausar' : collecting ? 'Retomar coleta' : !ready ? 'Iniciar linha de base' : reading ? 'Retomar monitoramento' : 'Iniciar monitoramento';
  const executionNumber = (id: string | null) => id ? Math.max(1, model.executions.findIndex(execution => execution.id === id) + 1) : null;
  const primaryAction = () => void monitor.command(running ? 'pausar' : 'iniciar');
  const showTab = (next: 'monitor' | 'history') => {
    setTab(next);
    setDetails(false);
    if (next === 'monitor') monitor.select(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return <>
    <a className="skip-link" href="#main">Ir para o conteúdo</a>
    <header className="app-header"><div className="header-inner"><a className="brand" href="#main" aria-label="prevLoss, início" data-tour="brand"><span className="brand-mark" aria-hidden="true"/><span>prev<span>Loss</span></span></a><div className="connection"><span className={`connection-dot ${model.connection}`} /><span role="status">{status}</span></div><div className="header-actions"><button className="header-button" onClick={() => setTourOpen(true)}>Como usar</button><button className="header-button" aria-expanded={details} onClick={() => setDetails(!details)}>Informações</button></div><button className="mobile-info-button" aria-label="Abrir informações" aria-expanded={details} onClick={() => setDetails(!details)}>i</button></div></header>
    <main id="main" className={`shell ${tab === 'history' ? 'history-view' : ''}`}>
      {import.meta.env.DEV && new URLSearchParams(location.search).has('fixture') && <p className="message" role="status">Modo de desenvolvimento · fixture: {new URLSearchParams(location.search).get('fixture')}. Dados de exemplo; comandos desativados neste modo.</p>}
      <div className="page-heading"><div><p className="context">Ativo monitorado</p><h1>Conjunto motor-bomba 01</h1><p>Acompanhe a condição do equipamento e compare cenários de operação.</p></div><div className="session-summary"><span className={`badge ${running ? 'live' : 'neutral'}`}>{running ? '● Em execução' : state?.estado_simulacao === 'pausada' ? 'Ⅱ Pausada' : '○ Não iniciada'}</span><small>Atualizado em {date(model.lastSync)}</small></div></div>
      {model.error && <section className="message error" role="alert"><div><strong>{model.connection === 'incompatible' ? 'A resposta da API precisa ser conferida' : 'A sincronização foi interrompida'}</strong><p>{model.error} {state && 'Os valores preservados são antigos; os comandos estão suspensos.'}</p></div><button onClick={monitor.retry}>Tentar sincronizar novamente</button></section>}
      {model.notice && <section className="message" role="status"><p>{model.notice}</p><button onClick={monitor.dismissNotice} aria-label="Fechar aviso">Fechar</button></section>}
      {model.actionError && <p className="message error" role="alert">{model.actionError} O estado será consultado novamente; a ação não será repetida automaticamente.</p>}
      {lastFailure && <p className="message error" role="alert">Falha de geração registrada: {cleanCopy(lastFailure.mensagem)} · {date(lastFailure.data_hora)}</p>}
      {details && <section className="panel technical" aria-label="Informações da aplicação"><div className="section-heading"><div><h2>Informações da aplicação</h2><p>Configuração usada na sessão atual.</p></div><button onClick={() => setDetails(false)}>Fechar</button></div>
        <dl><div><dt>Cenário atual</dt><dd>{scenarioName(state?.cenario_selecionado ?? 'normal')}</dd></div><div><dt>Linha de base</dt><dd>{ready ? 'Pronta' : collecting ? 'Em coleta' : 'Não preparada'}</dd></div><div><dt>Seed da execução</dt><dd>{model.config?.seed_execucao_atual ?? model.config?.seed_padrao ?? 42}</dd></div><div><dt>Intervalo das leituras</dt><dd>{model.config?.intervalo_s ?? '—'} s</dd></div></dl>
        <p>O histórico é salvo neste computador. Após reiniciar o servidor, a operação volta pausada para retomada manual.</p>
        <details className="technical-data"><summary>Dados técnicos</summary><dl><div><dt>Backend / contrato</dt><dd>{state?.versao_software ?? '—'} / {state?.versao_contrato ?? '—'}</dd></div><div><dt>Sessão</dt><dd>{state?.sessao_id ?? '—'}</dd></div><div><dt>Execução ativa</dt><dd data-testid="active-execution">{activeId ?? '—'}</dd></div><div><dt>Referência</dt><dd>{state?.calibracao.referencia_id ?? '—'}</dd></div></dl></details>
        <div className="recalibrate"><button disabled={disabled || !ready || running || state?.cenario_selecionado !== 'normal'} onClick={() => dialog.current?.showModal()}>Refazer linha de base</button><small>Disponível no cenário Normal, com o monitoramento pausado.</small></div>
      </section>}
      <section className="controls" aria-label="Controles da execução ativa" data-tour="controls"><label htmlFor="scenario">Cenário<select id="scenario" value={state?.cenario_selecionado ?? 'normal'} disabled={disabled || !ready || collecting} onChange={event => void monitor.command('cenario', { cenario: event.target.value as Cenario })}>{model.scenarios.length ? model.scenarios.map(c => <option value={c.id} key={c.id}>{c.nome}</option>) : <option value="normal">Normal</option>}</select></label><div className="control-description"><strong>{scenarioName(state?.cenario_selecionado ?? 'normal')}</strong><p>{collecting ? 'Conclua a linha de base para liberar os cenários.' : running ? 'A coleta está em andamento.' : 'Pronto para iniciar ou continuar esta execução.'}</p></div><div className="control-actions"><button className="primary primary-action" disabled={disabled} onClick={primaryAction}>{primaryText}</button><button className="new-run-action" disabled={disabled || !ready} onClick={() => restartDialog.current?.showModal()}>Nova execução</button></div></section>
      <CalibrationStatus state={state}/>
      <nav className="tabs" aria-label="Visualização" data-tour="history"><button aria-current={tab === 'monitor' ? 'page' : undefined} onClick={() => showTab('monitor')}>Monitoramento</button><button aria-current={tab === 'history' ? 'page' : undefined} onClick={() => showTab('history')}>Histórico <span>{model.executions.length}</span></button></nav>
      {tab === 'monitor' ? <div className={model.connection !== 'connected' && state ? 'stale' : ''}>
        <section className="mobile-condition-overview" aria-label="Resumo da condição" data-tour="condition"><div><span>Condição atual</span><strong>{iseText(reading)} <small>ISE</small></strong></div><div><span className={`badge ${conditionClass(reading?.classificacao)}`}>{reading?.classificacao ?? 'Aguardando'}</span><small>{state?.alertas_ativos.length ? `${state.alertas_ativos.length} alerta${state.alertas_ativos.length === 1 ? '' : 's'}` : 'Sem alertas'}</small></div></section>
        <div className="measurement-context"><span>{activeId ? `Execução ${executionNumber(activeId)}` : 'Nenhuma execução iniciada'}</span><span>{reading ? `Leitura ${reading.sequencia} · ${reading.tempo_simulado_s} s simulados` : 'Aguardando leitura'}{model.connection !== 'connected' && state ? ' · dados antigos' : ''}</span></div>
        <div data-tour="sensors"><SensorCards reading={reading}/></div><div className="condition-grid" data-tour="condition"><HealthPanel reading={reading}/><ActiveAlerts alerts={state?.alertas_ativos ?? []} reading={reading} available={!!state}/></div>
        <SensorCharts readings={activeReadings}/><EventTimeline events={activeEvents}/>
      </div> : <div><section className="history-selection"><div><h2>Consultar uma execução</h2><p>A seleção altera somente o que você está consultando. A operação continua vinculada à execução ativa.</p></div><label htmlFor="history-execution">Execução<select id="history-execution" aria-label="Execução" value={selectedId ?? ''} disabled={!model.executions.length} onChange={event => monitor.select(event.target.value || null)}><option value="" disabled>Selecione uma execução</option>{[...model.executions].reverse().map((e, index) => <option key={e.id} value={e.id}>{e.tipo === 'calibracao' ? 'Linha de base' : `Execução ${model.executions.length - index} · ${scenarioName(e.cenario)}`} · {date(e.criada_em)}{e.id === activeId ? ' (ativa)' : ''}</option>)}</select></label></section>
        {selectedExecution && <p className="history-context">Consultando a execução {executionNumber(selectedExecution.id)} de {scenarioName(selectedExecution.cenario)} · iniciada em {date(selectedExecution.criada_em)} · seed {selectedExecution.seed}</p>}
        <SensorCharts readings={selectedReadings}/><HistoryTable key={selectedId} readings={selectedReadings}/><EventTimeline events={model.events.filter(e => e.execucao_id === selectedId)}/>
      </div>}
    </main>
    {tab === 'monitor' && <aside className="mobile-action-dock" aria-label="Ação principal"><div><small>{scenarioName(state?.cenario_selecionado ?? 'normal')}</small><strong>{running ? 'Monitorando agora' : collecting ? 'Coletando linha de base' : 'Monitoramento pausado'}</strong></div><button className="primary" disabled={disabled} onClick={primaryAction}>{primaryText}</button></aside>}
    <nav className="mobile-nav" aria-label="Navegação principal" data-tour="history"><button aria-current={tab === 'monitor' ? 'page' : undefined} onClick={() => showTab('monitor')}><span aria-hidden="true">◉</span>Monitorar</button><button aria-current={tab === 'history' ? 'page' : undefined} onClick={() => showTab('history')}><span aria-hidden="true">▤</span>Histórico</button><button onClick={() => setTourOpen(true)}><span aria-hidden="true">?</span>Ajuda</button></nav>
    <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)}/>
    <dialog ref={restartDialog} aria-labelledby="restart-title"><h2 id="restart-title">Começar uma nova execução?</h2><p>O cenário {scenarioName(state?.cenario_selecionado ?? 'normal')} voltará ao início. Os dados atuais continuarão disponíveis no Histórico.</p><div className="dialog-actions"><button autoFocus onClick={() => restartDialog.current?.close()}>Cancelar</button><button className="primary" onClick={() => { restartDialog.current?.close(); void monitor.command('reiniciar', { seed: 42 }); }}>Criar nova execução</button></div></dialog>
    <dialog ref={dialog} aria-labelledby="recalibration-title"><h2 id="recalibration-title">Coletar uma nova linha de base?</h2><p>A linha de base atual deixará de avaliar novas leituras. Uma nova coleta Normal será iniciada; o histórico anterior permanecerá nesta sessão.</p><div className="dialog-actions"><button autoFocus onClick={() => dialog.current?.close()}>Cancelar</button><button className="primary" onClick={() => { dialog.current?.close(); void monitor.command('recalibrar', { seed: 42 }); }}>Iniciar nova linha de base</button></div></dialog>
  </>;
}
