import { useState } from 'react';
import type { Evento, Leitura } from '../types/api';
import { conditionClass, date, fmt, scenarioName } from './format';

export function HistoryTable({ readings }: { readings: Leitura[] }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(readings.length / 50));
  const current = Math.min(page, pages - 1);
  const slice = readings.slice(current * 50, current * 50 + 50);
  return <section className="panel"><div className="section-heading"><div><h2>Registros da execução</h2><p>{readings.length} leituras recuperadas · horários de Brasília (Bahia)</p></div></div>
    {!readings.length ? <p className="empty-state">Esta execução ainda não possui leituras.</p> : <>
      <div className="table-scroll"><table><caption className="sr-only">Medições por sequência da execução selecionada</caption><thead><tr><th>Leitura</th><th>Data e hora</th><th>Tempo</th><th>°C</th><th>m/s² RMS</th><th>A</th><th>bar</th><th>ISE</th><th>Classificação</th><th>Qualidade</th></tr></thead><tbody>{slice.map(l => <tr key={l.sequencia}><td>{l.sequencia}</td><td>{date(l.data_hora)}</td><td>{l.tempo_simulado_s} s</td><td>{fmt(l.temperatura_c)}</td><td>{fmt(l.vibracao_rms_ms2)}</td><td>{fmt(l.corrente_a)}</td><td>{fmt(l.pressao_bar)}</td><td>{fmt(l.ise, 6)}</td><td><span className={`badge ${conditionClass(l.classificacao)}`}>{l.classificacao ?? 'Indisponível'}</span></td><td>{l.qualidade_dados === 'valida' ? 'Válida' : l.qualidade_dados === 'ausente' ? 'Ausente' : 'Inválida'}</td></tr>)}</tbody></table></div>
      <div className="pagination"><button disabled={current === 0} onClick={() => setPage(current - 1)}>Anterior</button><span>Página {current + 1} de {pages}</span><button disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Próxima</button></div>
    </>}
  </section>;
}

export function EventTimeline({ events }: { events: Evento[] }) {
  return <section className="panel"><div className="section-heading"><div><h2>Eventos da execução</h2><p>Aberturas, encerramentos e mudanças de operação</p></div><span className="quiet">{events.length} eventos</span></div>
    {events.length ? <ol className="timeline">{[...events].reverse().map(event => <li key={event.id} className={event.tipo === 'falha_geracao' ? 'failure' : ''}><time>{date(event.data_hora)}</time><div><strong>{event.mensagem}</strong>{event.alerta?.motivo_encerramento && <p>{event.alerta.motivo_encerramento === 'recuperacao' ? 'Alerta encerrado por recuperação.' : 'Execução encerrada. Isso não comprova recuperação da condição.'}</p>}{event.sequencia !== null && <small>Leitura {event.sequencia}</small>}</div></li>)}</ol> : <p className="quiet">Nenhum evento registrado nesta execução.</p>}
  </section>;
}

export function ExecutionLabel({ scenario, id }: { scenario: string; id: string }) {
  return <span>{scenarioName(scenario)} · {id.slice(0, 8)}</span>;
}
