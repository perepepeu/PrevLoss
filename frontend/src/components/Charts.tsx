import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Leitura } from '../types/api';
import { fmt, variables } from './format';

export function SensorCharts({ readings }: { readings: Leitura[] }) {
  const data = readings.slice(-120);
  const series = [...variables.map(v => ({ field: v.field, name: v.name, unit: v.unit, color: v.color })), { field: 'ise', name: 'Índice de saúde', unit: 'ISE', color: '#1565c0' }];
  return <section className="panel charts-panel" aria-labelledby="charts-title">
    <div className="section-heading"><div><h2 id="charts-title">Evolução das leituras</h2><p>Últimos 120 pontos desta execução · tempo simulado em segundos</p></div><span className="quiet">{data.length} pontos</span></div>
    {!data.length ? <div className="empty-state"><span aria-hidden="true">∿</span><h3>O comportamento aparece aqui</h3><p>Inicie uma execução para acompanhar a evolução das variáveis.</p></div> : <div className="charts-grid">{series.map(s => <figure key={s.field} className={s.field === 'ise' ? 'ise-chart' : ''}>
      <figcaption><strong>{s.name}</strong><span>{s.unit}</span></figcaption>
      <div className="chart" role="img" aria-label={`Gráfico de ${s.name}, ${data.length} leituras; valores disponíveis na tabela do histórico.`}>
        <ResponsiveContainer width="100%" height={180} minWidth={1}>
          <LineChart data={data} margin={{ top: 12, right: 18, bottom: 5, left: 0 }} accessibilityLayer>
            <CartesianGrid stroke="#e4ebf1" vertical={false} />
            <XAxis dataKey="tempo_simulado_s" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={25} unit=" s" />
            <YAxis domain={s.field === 'ise' ? [0, 100] : ['auto', 'auto']} width={52} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={n => fmt(n, 1)} />
            <Tooltip formatter={value => [fmt(typeof value === 'number' ? value : null), s.unit]} labelFormatter={label => `${label} s simulados`} />
            <Line type="linear" dataKey={s.field} stroke={s.color} strokeWidth={2} dot={data.length === 1} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>)}</div>}
  </section>;
}
