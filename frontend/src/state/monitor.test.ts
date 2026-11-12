import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from '../api/client';
import { fixture } from '../test/fixtures';
import type { Estado, Leitura } from '../types/api';
import { Monitor } from './monitor';

class FakeApi extends ApiClient {
  state = fixture('normal');
  historyCalls: number[] = [];
  commands: string[] = [];
  records: Leitura[] = [this.state.ultima_leitura!];
  stateError: Error | null = null;
  deferredState: Promise<Estado> | null = null;
  deferredCommand: Promise<Estado> | null = null;
  override async request(path: string, _signal: AbortSignal, body?: object): Promise<unknown> {
    if (body !== undefined) { this.commands.push(path); return this.deferredCommand ?? this.state; }
    if (path === 'estado') { if (this.stateError) throw this.stateError; return this.deferredState ?? structuredClone(this.state); }
    if (path === 'saude' || path === 'cenarios' || path === 'configuracao') return fixture(path);
    if (path === 'execucoes') return { execucoes: [], referencias: [] };
    if (path === 'eventos') return { execucao_id: null, itens: [] };
    if (path.startsWith('historico')) {
      const q = new URLSearchParams(path.split('?')[1]); const cursor = Number(q.get('apos_sequencia'));
      this.historyCalls.push(cursor);
      const items = this.records.filter(l => l.execucao_id === q.get('execucao_id')).slice(cursor, cursor + 500);
      return { execucao_id: q.get('execucao_id'), itens: items, proxima_sequencia: items.at(-1)?.sequencia ?? cursor, tem_mais: cursor + 500 < this.records.length };
    }
    throw new Error(path);
  }
}
const monitors: Monitor[] = [];
function setup() { const api = new FakeApi(); const monitor = new Monitor(api, 100000); monitors.push(monitor); monitor.start(); return { api, monitor }; }
async function connected(monitor: Monitor) { await vi.waitFor(() => expect(monitor.getSnapshot().connection).toBe('connected')); }
afterEach(() => { monitors.splice(0).forEach(m => m.stop()); });

describe('Sincronização e concorrência', () => {
  it('pagina 1001 leituras sem duplicar após polling', async () => {
    const { api, monitor } = setup();
    api.records = Array.from({ length: 1001 }, (_, i) => ({ ...api.state.ultima_leitura!, sequencia: i + 1, tempo_simulado_s: i + 1 }));
    await connected(monitor);
    expect(monitor.getSnapshot().history[api.state.execucao_atual_id!]).toHaveLength(1001);
    expect(api.historyCalls).toEqual([0, 500, 1000]);
    monitor.retry(); await vi.waitFor(() => expect(api.historyCalls).toContain(1001));
    expect(monitor.getSnapshot().history[api.state.execucao_atual_id!]).toHaveLength(1001);
  });
  it('descarta revisões antigas na mesma sessão', async () => {
    const { api, monitor } = setup(); await connected(monitor);
    const original = monitor.getSnapshot().state;
    api.state.revisao_estado--; api.state.ultima_leitura = null; monitor.retry();
    await vi.waitFor(() => expect(monitor.getSnapshot().state).toEqual(original));
  });
  it('bloqueia comandos durante contrato inválido e recupera sem reload', async () => {
    const { api, monitor } = setup(); await connected(monitor);
    api.state = { ...api.state, versao_contrato: '2' }; monitor.retry();
    await vi.waitFor(() => expect(monitor.getSnapshot().connection).toBe('incompatible'));
    expect(monitor.getSnapshot().state?.versao_contrato).toBe('1');
    await monitor.command('iniciar'); expect(api.commands).toHaveLength(0);
    api.state.versao_contrato = '1'; monitor.retry(); await connected(monitor);
    await monitor.command('pausar'); expect(api.commands).toEqual(['pausar']);
  });
  it('preserva valores e alertas quando a conexão cai', async () => {
    const { api, monitor } = setup(); await connected(monitor);
    const original = monitor.getSnapshot().state;
    api.stateError = new ApiError('Rede indisponível', 'network'); monitor.retry();
    await vi.waitFor(() => expect(monitor.getSnapshot().connection).toBe('offline'));
    expect(monitor.getSnapshot().state).toEqual(original);
    api.stateError = null; monitor.retry(); await connected(monitor);
  });
  it('limpa histórico e seleção quando muda a sessão', async () => {
    const { api, monitor } = setup(); await connected(monitor);
    api.state = { ...fixture('estado-inicial'), sessao_id: 'nova-sessao' }; api.records = [];
    monitor.retry(); await vi.waitFor(() => expect(monitor.getSnapshot().state?.sessao_id).toBe('nova-sessao'));
    expect(monitor.getSnapshot().history).toEqual({}); expect(monitor.getSnapshot().selected).toBeNull();
    expect(monitor.getSnapshot().notice).toContain('reiniciou');
  });
  it('resposta atrasada cancelada não reverte nova sessão', async () => {
    const { api, monitor } = setup(); await connected(monitor);
    const old = structuredClone(api.state); let resolve!: (state: Estado) => void;
    api.deferredState = new Promise(r => { resolve = r; }); monitor.retry();
    api.deferredState = null; api.state = { ...fixture('estado-inicial'), sessao_id: 'nova-sessao' }; api.records = [];
    monitor.retry(); await connected(monitor);
    await vi.waitFor(() => expect(monitor.getSnapshot().state?.sessao_id).toBe('nova-sessao'));
    resolve(old); await Promise.resolve(); await Promise.resolve();
    expect(monitor.getSnapshot().state?.sessao_id).toBe('nova-sessao');
  });
  it('serializa comandos e invalida consulta pendente', async () => {
    const { api, monitor } = setup(); await connected(monitor);
    let resolve!: (state: Estado) => void;
    api.deferredCommand = new Promise(r => { resolve = r; });
    const first = monitor.command('reiniciar', { seed: 42 });
    await monitor.command('reiniciar', { seed: 42 }); expect(api.commands).toHaveLength(1);
    resolve(api.state); await first;
  });
  it('não mistura séries após trocar a execução', async () => {
    const { api, monitor } = setup(); await connected(monitor);
    const oldId = api.state.execucao_atual_id!;
    api.state.execucao_atual_id = 'outra-execucao'; api.state.ultima_leitura = null; api.state.revisao_estado++;
    api.records = []; monitor.retry();
    await vi.waitFor(() => expect(monitor.getSnapshot().history['outra-execucao']).toEqual([]));
    expect(monitor.getSnapshot().history[oldId]).toHaveLength(1);
  });
  it('rejeita histórico de outra execução', async () => {
    const api = new FakeApi(); api.records[0] = { ...api.records[0], sessao_id: 'errada' };
    const monitor = new Monitor(api, 100000); monitors.push(monitor); monitor.start();
    await vi.waitFor(() => expect(monitor.getSnapshot().connection).toBe('incompatible'));
    expect(monitor.getSnapshot().history).toEqual({});
  });
  it('stop/start não aplica resposta anterior nem deixa polling duplicado', async () => {
    const api = new FakeApi(); const request = vi.spyOn(api, 'request');
    const monitor = new Monitor(api, 100000); monitors.push(monitor);
    monitor.start(); monitor.stop(); monitor.start(); await connected(monitor);
    expect(request.mock.calls.filter(([path]) => path === 'estado')).toHaveLength(2);
    monitor.stop(); const count = request.mock.calls.length;
    await new Promise(r => setTimeout(r, 20)); expect(request.mock.calls).toHaveLength(count);
  });
});
