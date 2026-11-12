import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, validate } from './client';
import { fixture } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());
describe('Contrato real e transporte HTTP', () => {
  it.each(['estado-inicial', 'calibracao-24-de-60', 'normal', 'atencao', 'critico', 'normal-com-alerta-individual', 'dado-ausente', 'dado-invalido', 'pausa', 'execucao-nova-pausada'])('valida fixture %s pelo OpenAPI', name => {
    expect(validate('Estado', fixture(name))).toEqual(fixture(name));
  });
  it('rejeita versão e campos incompatíveis', () => {
    expect(() => validate('Estado', { ...fixture('normal'), versao_contrato: '2' })).toThrow('Versão');
    expect(() => validate('Estado', { ...fixture('normal'), alertas_ativos: null })).toThrow('incompatível');
  });
  it('envia JSON vazio nos comandos', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture('normal'))));
    vi.stubGlobal('fetch', request);
    await new ApiClient().request('iniciar', new AbortController().signal, {});
    expect(request).toHaveBeenCalledWith('http://127.0.0.1:8000/api/iniciar', expect.objectContaining({ method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }));
  });
  it.each([400, 404, 405, 409, 422, 500])('mostra erro HTTP %s', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ erro: { mensagem: 'Confira os parâmetros.' } }), { status })));
    await expect(new ApiClient().request('iniciar', new AbortController().signal, {})).rejects.toThrow(`HTTP ${status}`);
  });
  it('trata corpo não JSON e falha de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>erro</html>')));
    await expect(new ApiClient().request('estado', new AbortController().signal)).rejects.toThrow('não JSON');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(new ApiClient().request('estado', new AbortController().signal)).rejects.toThrow('conectar');
  });
  it('rejeita base com /api duplicado', () => { expect(() => new ApiClient('http://127.0.0.1:8000/api')).toThrow('origem'); });
  it('interrompe consulta no timeout e permite uma nova chamada', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new DOMException('Tempo excedido', 'TimeoutError')));
    })));
    await expect(new ApiClient('http://127.0.0.1:8000', 20).request('estado', new AbortController().signal)).rejects.toThrow('não respondeu');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture('normal')))));
    await expect(new ApiClient().get('estado', 'Estado', new AbortController().signal)).resolves.toHaveProperty('versao_contrato', '1');
  });
});
