import type { Estado } from '../types/api';
const examples = import.meta.glob('../../../docs/fixtures/*.json', { eager: true, import: 'default' });
const fixture = (name: string) => structuredClone(examples[`../../../docs/fixtures/${name}.json`]);
export function fixtureResponse(path: string, name: string): unknown {
  const state = fixture(name) as Estado | undefined;
  if (!state?.versao_contrato || !state.calibracao) throw new Error('Selecione uma fixture de Estado válida.');
  const id = state.execucao_atual_id;
  const records = state.ultima_leitura ? Array.from({ length: state.ultima_leitura.sequencia }, (_, i) => ({ ...state.ultima_leitura, sequencia: i + 1, tempo_simulado_s: i + 1 })) : [];
  if (path === 'estado') return state;
  if (path === 'saude' || path === 'cenarios') return fixture(path);
  if (path === 'configuracao') return fixture('configuracao');
  if (path === 'execucoes') return { referencias: [], execucoes: id ? [{ id, sessao_id: state.sessao_id, tipo: state.calibracao.estado === 'em_andamento' ? 'calibracao' : 'teste', cenario: state.cenario_selecionado, seed: 42, referencia_id: state.calibracao.referencia_id, criada_em: '2026-11-10T12:00:00Z', encerrada_em: null, total_leituras: records.length }] : [] };
  if (path === 'eventos') return { execucao_id: null, itens: [] };
  if (path.startsWith('historico?')) {
    const query = new URLSearchParams(path.split('?')[1]);
    const cursor = Number(query.get('apos_sequencia'));
    return { execucao_id: id, itens: records.slice(cursor, cursor + 500), proxima_sequencia: Math.min(cursor + 500, records.length), tem_mais: cursor + 500 < records.length };
  }
  throw new Error(`Rota sem fixture: ${path}`);
}
