import { ApiClient, ApiError, validate } from '../api/client';
import type { Comando, Configuracao, Estado, Evento, Execucoes, InfoCenario, Leitura } from '../types/api';

export type Connection = 'connecting' | 'connected' | 'offline' | 'incompatible';
export interface Snapshot {
  state: Estado | null;
  connection: Connection;
  error: string | null;
  actionError: string | null;
  notice: string | null;
  pending: boolean;
  lastSync: string | null;
  config: Configuracao | null;
  scenarios: InfoCenario[];
  executions: Execucoes['execucoes'];
  references: Execucoes['referencias'];
  history: Record<string, Leitura[]>;
  events: Evento[];
  selected: string | null;
}
const initial = (): Snapshot => ({ state: null, connection: 'connecting', error: null, actionError: null,
  notice: null, pending: false, lastSync: null, config: null, scenarios: [], executions: [], references: [], history: {}, events: [], selected: null });

/** Backend state and browser synchronization are independent: GET never creates samples. */
export class Monitor {
  private value = initial();
  private listeners = new Set<() => void>();
  private active = false;
  private epoch = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private controller: AbortController | null = null;
  private metadataAt = 0;
  private metadataKey = '';
  private cursors = new Map<string, number>();
  constructor(private api = new ApiClient(), private interval = 1000) {}
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private publish(patch: Partial<Snapshot>) { this.value = { ...this.value, ...patch }; this.listeners.forEach(fn => fn()); }
  private cancel() { clearTimeout(this.timer); this.controller?.abort(); this.controller = null; this.epoch++; }
  start = () => { this.active = true; this.retry(); };
  stop = () => { this.active = false; this.cancel(); this.publish({ pending: false }); };
  dismissNotice = () => this.publish({ notice: null });
  select = (id: string | null) => {
    this.publish({ selected: id });
    if (!this.value.pending) this.retry();
  };
  retry = () => {
    if (!this.active || this.value.pending) return;
    this.cancel();
    void this.sync();
  };
  private current(epoch: number) { return this.active && epoch === this.epoch; }
  private schedule() { if (this.active) this.timer = setTimeout(() => void this.sync(), this.interval); }

  private apply(state: Estado): boolean {
    const previous = this.value.state;
    if (state.ultima_leitura && (state.ultima_leitura.sessao_id !== state.sessao_id || state.ultima_leitura.execucao_id !== state.execucao_atual_id)) {
      throw new ApiError('A última leitura não pertence à sessão/execução ativa.', 'contract');
    }
    if (state.alertas_ativos.some(a => a.execucao_id !== state.execucao_atual_id)) throw new ApiError('Alerta de outra execução na resposta.', 'contract');
    if (previous?.sessao_id === state.sessao_id && previous.revisao_estado > state.revisao_estado) return false;
    if (previous && previous.sessao_id !== state.sessao_id) {
      this.cursors.clear(); this.metadataAt = 0; this.metadataKey = '';
      this.publish({ ...initial(), pending: this.value.pending, notice: 'O servidor reiniciou. Uma nova sessão foi aberta; os registros anteriores não estão mais disponíveis.' });
    }
    this.publish({ state });
    return true;
  }

  private failed(error: unknown) {
    this.publish({ connection: error instanceof ApiError && error.kind === 'contract' ? 'incompatible' : 'offline',
      error: error instanceof Error ? error.message : 'Falha inesperada ao sincronizar.' });
  }

  private async history(id: string, session: string, epoch: number, signal: AbortSignal) {
    let more = true;
    while (more && this.current(epoch)) {
      const cursor = this.cursors.get(id) ?? 0;
      const page = await this.api.get(`historico?execucao_id=${encodeURIComponent(id)}&apos_sequencia=${cursor}&limite=500`, 'PaginaHistorico', signal);
      if (!this.current(epoch)) return;
      if (page.execucao_id !== id || page.itens.some(l => l.execucao_id !== id || l.sessao_id !== session)) {
        throw new ApiError('Histórico recebido pertence a outra execução ou sessão.', 'contract');
      }
      const merged = new Map((this.value.history[id] ?? []).map(l => [l.sequencia, l]));
      page.itens.forEach(l => merged.set(l.sequencia, l));
      const records = [...merged.values()].sort((a, b) => a.sequencia - b.sequencia);
      const max = records.at(-1)?.sequencia ?? cursor;
      if (page.proxima_sequencia !== max || (page.tem_mais && page.proxima_sequencia <= cursor)) {
        throw new ApiError('O cursor do histórico não avançou corretamente.', 'contract');
      }
      // The backend promises an unbroken sequence. Detect gaps rather than hiding lost samples.
      if (records.some((l, i) => l.sequencia !== i + 1)) throw new ApiError('Há uma lacuna de sequência no histórico recebido.', 'contract');
      this.publish({ history: { ...this.value.history, [id]: records } });
      this.cursors.set(id, page.proxima_sequencia);
      more = page.tem_mais;
    }
  }

  private async sync() {
    if (!this.active || this.value.pending) return;
    const epoch = this.epoch;
    const controller = new AbortController(); this.controller = controller;
    const signal = controller.signal;
    try {
      const state = await this.api.get('estado', 'Estado', signal);
      if (!this.current(epoch)) return;
      if (!this.apply(state)) return;
      const key = `${state.sessao_id}/${state.execucao_atual_id}/${state.calibracao.referencia_id}`;
      if (key !== this.metadataKey || Date.now() - this.metadataAt > 5000) {
        const health = await this.api.get('saude', 'Saude', signal);
        if (!this.current(epoch)) return;
        if (health.versao_software !== state.versao_software) throw new ApiError('A versão da API mudou durante a sincronização.', 'contract');
        const config = await this.api.get('configuracao', 'Configuracao', signal);
        const rawScenarios = await this.api.request('cenarios', signal);
        if (!Array.isArray(rawScenarios)) throw new ApiError('Lista de cenários incompatível.', 'contract');
        const scenarios = rawScenarios.map(item => validate('InfoCenario', item));
        const executions = await this.api.get('execucoes', 'Execucoes', signal);
        if (!this.current(epoch)) return;
        if (executions.execucoes.some(e => e.sessao_id !== state.sessao_id)) {
          // A restart between requests: do not attach the new metadata to the previous session.
          throw new ApiError('A sessão mudou durante a consulta. Sincronizando novamente.', 'network');
        }
        this.publish({ config, scenarios, executions: executions.execucoes, references: executions.referencias });
        this.metadataKey = key; this.metadataAt = Date.now();
      }
      const ids = [...new Set([state.execucao_atual_id, this.value.selected].filter((id): id is string => id !== null))];
      for (const id of ids) await this.history(id, state.sessao_id, epoch, signal);
      const events = await this.api.get('eventos', 'Eventos', signal);
      if (!this.current(epoch)) return;
      if (events.itens.some(e => e.sessao_id !== state.sessao_id)) throw new ApiError('Eventos de outra sessão. Aguardando nova sincronização.', 'network');
      this.publish({ events: [...new Map(events.itens.map(e => [e.id, e])).values()], connection: 'connected', error: null, lastSync: new Date().toISOString() });
    } catch (error) {
      if (this.current(epoch) && !signal.aborted) this.failed(error);
    } finally {
      if (this.current(epoch)) { this.controller = null; this.schedule(); }
    }
  }

  async command(command: Comando, body: object = {}) {
    if (!this.active || this.value.pending || this.value.connection !== 'connected') return;
    this.cancel();
    const epoch = this.epoch;
    const controller = new AbortController(); this.controller = controller;
    this.publish({ pending: true, actionError: null });
    try {
      const state = validate('Estado', await this.api.request(command, controller.signal, body));
      if (!this.current(epoch)) return;
      this.apply(state);
      this.metadataAt = 0;
    } catch (error) {
      if (this.current(epoch) && !controller.signal.aborted) {
        this.publish({ actionError: error instanceof Error ? error.message : 'A ação não foi confirmada.' });
        if (!(error instanceof ApiError) || error.kind !== 'http') this.failed(error);
      }
    } finally {
      if (this.current(epoch)) { this.publish({ pending: false }); this.retry(); }
    }
  }
}
