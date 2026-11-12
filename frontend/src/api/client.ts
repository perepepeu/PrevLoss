import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import openapi from '../../../docs/openapi.json';
import type { Schema } from '../types/api';

export class ApiError extends Error {
  constructor(message: string, public kind: 'contract' | 'network' | 'http', public status?: number) { super(message); }
}

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ $id: 'prevloss', components: openapi.components });

export function validate<K extends keyof Schema>(name: K, value: unknown): Schema[K] {
  const check = ajv.getSchema(`prevloss#/components/schemas/${name}`);
  if (!check || !check(value)) {
    const reason = check?.errors?.[0];
    throw new ApiError(`Resposta incompatível (${name}): ${reason?.instancePath || '/'} ${reason?.message || 'estrutura desconhecida'}.`, 'contract');
  }
  if ((name === 'Estado' || name === 'Configuracao') && (value as { versao_contrato: string }).versao_contrato !== '1') {
    throw new ApiError('Versão de contrato incompatível. Este dashboard requer contrato 1.', 'contract');
  }
  return value as Schema[K];
}

export class ApiClient {
  readonly base: string;
  constructor(base = import.meta.env.VITE_API_BASE_URL || (['localhost', '127.0.0.1'].includes(location.hostname) ? `${location.protocol}//${location.hostname}:8000` : location.origin), private timeout = 5000) {
    this.base = base.replace(/\/+$/, '');
    const url = new URL(this.base);
    if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('VITE_API_BASE_URL deve conter apenas a origem, sem /api ou outros caminhos.');
    }
  }

  async request(path: string, signal: AbortSignal, body?: object): Promise<unknown> {
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('fixture')) {
      if (body !== undefined) throw new ApiError('Fixture de desenvolvimento: use a API real para operar.', 'http', 409);
      const { fixtureResponse } = await import('../dev/fixtureClient');
      return fixtureResponse(path, new URLSearchParams(location.search).get('fixture') ?? 'estado-inicial');
    }
    const timeout = AbortSignal.timeout(this.timeout);
    try {
      const response = await fetch(`${this.base}/api/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.any([signal, timeout]),
      });
      const text = await response.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch {
        throw new ApiError(`A API devolveu uma resposta não JSON (HTTP ${response.status}).`, response.ok ? 'contract' : 'http', response.status);
      }
      if (!response.ok) {
        const envelope = data as { erro?: { mensagem?: string; codigo?: string } } | null;
        const message = typeof envelope?.erro?.mensagem === 'string' ? envelope.erro.mensagem : 'A requisição não foi concluída.';
        throw new ApiError(`${message} (HTTP ${response.status})`, 'http', response.status);
      }
      return data;
    } catch (error) {
      if (signal.aborted) throw error;
      if (error instanceof ApiError) throw error;
      throw new ApiError(timeout.aborted ? 'A API não respondeu em cinco segundos.' : 'Não foi possível conectar à API. Confira o servidor, a porta e o CORS.', 'network');
    }
  }

  async get<K extends keyof Schema>(path: string, schema: K, signal: AbortSignal): Promise<Schema[K]> {
    return validate(schema, await this.request(path, signal));
  }
}
