import type { Alerta, Estado, Leitura } from '../types/api';
import { cleanCopy, conditionClass, date, fmt, iseText, names, unavailable, variables } from './format';

export function CalibrationStatus({ state }: { state: Estado | null }) {
  const calibration = state?.calibracao;
  const collecting = calibration?.estado === 'em_andamento';
  const ready = calibration?.estado === 'concluida';
  return <section className={`reference-strip ${ready ? 'ready' : ''}`} aria-label="Linha de base" data-tour="operation">
    <span className="reference-icon" aria-hidden="true">{ready ? '✓' : '◎'}</span>
    <div><strong>{ready ? 'Linha de base pronta' : collecting ? 'Preparando a linha de base' : 'Prepare o monitoramento'}</strong>
      <p>{ready ? state?.ultima_leitura === null ? 'Linha de base concluída. Inicie o monitoramento.' : 'As leituras já podem ser comparadas com a condição normal.' : collecting ? `${calibration.coletadas} de ${calibration.necessarias} leituras válidas${state?.estado_simulacao === 'pausada' ? ' · coleta pausada' : ''}.` : 'Colete 60 leituras normais antes de testar os cenários.'}</p></div>
    {collecting ? <div className="reference-progress"><progress aria-label="Coleta de referência" value={calibration.coletadas} max={calibration.necessarias} /><span>{calibration.coletadas}/{calibration.necessarias}</span></div> : ready ? <span className="quiet">60 leituras</span> : null}
  </section>;
}

export function SensorCards({ reading }: { reading: Leitura | null }) {
  return <section className="sensor-grid" aria-label="Medições atuais">{variables.map(variable => {
    const reasons = reading?.motivos_qualidade.filter(reason => reason.variavel === variable.id) ?? [];
    const invalid = reasons.length > 0;
    return <article className={`sensor ${invalid ? 'sensor-invalid' : ''}`} key={variable.id}>
      <div className="sensor-label"><h2>{variable.name}</h2><span style={{ color: variable.color }} aria-hidden="true">{variable.symbol}</span></div>
      <div className="sensor-value" data-testid={`sensor-${variable.id}`}>{fmt(reading?.[variable.field])}<small>{variable.unit}</small></div>
      {(invalid || !reading) && <p>{invalid ? reasons.map(reason => reason.codigo === 'AUSENTE' ? 'Dado ausente' : `Dado inválido: ${reason.codigo.toLowerCase().replaceAll('_', ' ')}`).join('; ') : 'Aguardando leitura'}</p>}
    </article>;
  })}</section>;
}

export function HealthPanel({ reading }: { reading: Leitura | null }) {
  const condition = conditionClass(reading?.classificacao);
  const loss = reading?.contribuicoes_perda;
  return <section className="panel health-panel" aria-labelledby="health-title">
    <div className="section-heading"><div><h2 id="health-title">Condição do equipamento</h2><p>Índice de Saúde do Equipamento · ISE</p></div><span className={`badge ${condition}`}>{reading?.classificacao ?? 'Indisponível'}</span></div>
    <div className="ise-row"><strong data-testid="ise-value">{iseText(reading)}</strong><span>/ 100</span></div>
    <div className={`ise-track ${condition}`} role="meter" aria-label="Índice de Saúde do Equipamento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={reading?.ise ?? undefined} aria-valuetext={reading?.ise == null ? 'Indisponível' : `${reading.ise} de 100; ${reading.classificacao}`}><div style={{ width: `${reading?.ise ?? 0}%` }} /></div>
    {reading?.ise == null ? <p className="explanation">{unavailable(reading)}</p> : <p className="explanation">Atualizado com a leitura mais recente.{iseText(reading).includes('≈') && ' Valor próximo da fronteira; a exibição é aproximada.'}</p>}
    <h3>Contribuições para a perda</h3>
    <div className="contributions">{variables.map(v => <div key={v.id}><span>{v.name}</span><b>{fmt(loss?.por_variavel[v.id])}<small> pts</small></b></div>)}</div>
    <p className="quiet">{loss ? loss.principais.length ? `Maior contribuição: ${loss.principais.map(id => names[id]).join(' e ')}.` : 'Nenhuma perda nesta leitura.' : 'Contribuições disponíveis após a referência e uma leitura válida.'}</p>
  </section>;
}

export function ActiveAlerts({ alerts, reading, available }: { alerts: Alerta[]; reading: Leitura | null; available: boolean }) {
  return <section className="panel alerts-panel" aria-labelledby="alerts-title">
    <div className="section-heading"><div><h2 id="alerts-title">Alertas e orientações</h2><p>Condições individuais das variáveis</p></div><span className={`count ${alerts.length ? 'attention' : ''}`}>{alerts.length}</span></div>
    {alerts.length ? <ul className="alerts-list">{alerts.map(alert => <li key={alert.id}>
      <div className="alert-heading"><span aria-hidden="true">△</span><strong>{names[alert.variavel]}{alert.codigo === 'PRESSAO_INSTAVEL' ? ' · oscilação' : ' · desvio'}</strong></div>
      <p>{cleanCopy(alert.mensagem)}</p><small>Abertura: {date(alert.iniciado_em)} · leitura {alert.sequencia_abertura}</small>
      <details><summary>Critério e orientação</summary><p>{alert.criterio_violado} · observado na abertura: {fmt(alert.valor_observado)} {alert.codigo === 'PRESSAO_INSTAVEL' ? 'bar' : '(razão r, sem unidade)'}</p><p>{cleanCopy(alert.recomendacao)}</p></details>
    </li>)}</ul> : <div className="empty-alert"><span aria-hidden="true">{available ? '✓' : '○'}</span><strong>{available ? 'Operação sem alertas' : 'Aguardando informações'}</strong><p>{available ? 'Nenhuma anomalia individual foi detectada nesta leitura.' : 'Os alertas aparecerão quando o monitoramento estiver disponível.'}</p></div>}
    {!!reading?.recomendacoes.length && <details className="recommendations"><summary>Recomendações desta leitura</summary><ul>{reading.recomendacoes.map(text => <li key={text}>{cleanCopy(text)}</li>)}</ul></details>}
  </section>;
}
