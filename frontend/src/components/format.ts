import type { Leitura } from '../types/api';
export const variables = [
  { id: 'temperatura', field: 'temperatura_c', name: 'Temperatura', unit: '°C', color: '#b75b20', symbol: '°' },
  { id: 'vibracao', field: 'vibracao_rms_ms2', name: 'Vibração', unit: 'm/s² RMS', color: '#6653a1', symbol: '∿' },
  { id: 'corrente', field: 'corrente_a', name: 'Corrente elétrica', unit: 'A', color: '#1565c0', symbol: 'ϟ' },
  { id: 'pressao', field: 'pressao_bar', name: 'Pressão', unit: 'bar', color: '#087f8c', symbol: '↕' },
] as const;
export const names = Object.fromEntries(variables.map(v => [v.id, v.name]));
export const fmt = (value: number | null | undefined, precision = 2) => value == null ? '—' : value.toLocaleString('pt-BR', { minimumFractionDigits: precision, maximumFractionDigits: precision });
export const cleanCopy = (text: string) => text
  .replace(/^Ambiente simulado:\s*/i, '')
  .replace(/^Simulação iniciada ou retomada\.$/i, 'Monitoramento iniciado ou retomado.')
  .replace(/^Simulação pausada\.$/i, 'Monitoramento pausado.');
export function iseText(reading: Leitura | null) {
  if (reading?.ise == null) return '—';
  const n = reading.ise;
  const nearBoundary = [50, 80].some(boundary => n < boundary && n.toFixed(2) === boundary.toFixed(2));
  return nearBoundary ? `${fmt(n, 6)} ≈` : fmt(n, 2);
}
export const date = (iso: string | null | undefined) => !iso ? '—' : new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Bahia', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const scenarioName = (id: string) => ({ normal: 'Normal', aquecimento: 'Aquecimento', vibracao_elevada: 'Vibração elevada', pressao_instavel: 'Pressão instável', multiplos_desvios: 'Múltiplos desvios' })[id] ?? id;
export const conditionClass = (value: string | null | undefined) => value === 'Normal' ? 'normal' : value === 'Atenção' ? 'attention' : value === 'Crítico' ? 'critical' : 'neutral';
export function unavailable(reading: Leitura | null) {
  if (!reading) return 'Aguardando a primeira leitura desta execução.';
  return ({ REFERENCIA_AUSENTE: 'A referência ainda está em preparação.', DADOS_AUSENTES: 'Há dados ausentes nesta leitura.', DADOS_INVALIDOS: 'Há dados inválidos nesta leitura.' })[reading.motivo_indisponibilidade ?? 'REFERENCIA_AUSENTE'];
}
