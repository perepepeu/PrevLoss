import { chromium, expect } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const repo = resolve(root, '..');
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const output = join(repo, 'docs', 'evidencias', 'pedro', stamp);
await mkdir(output, { recursive: true });
const report = { inicio: new Date().toISOString(), fuso: 'America/Bahia', executor: 'Codex, validação automatizada pelo navegador', revisor: 'Pendente de revisão de Pedro e Caíque', commit_base: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), arquivos_locais: execFileSync('git', ['status', '--short'], { cwd: repo, encoding: 'utf8' }).trim(), node: process.version, pacote_frontend: JSON.parse(await readFile(join(root, 'package.json'), 'utf8')), resultado: 'em execução', cenarios: [], verificacoes: [] };
const golden = JSON.parse(await readFile(join(repo, 'docs/evidencias/cenarios-seed42.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function checkpoint() { await writeFile(join(output, 'validacao-real.json'), JSON.stringify(report, null, 2)); }
async function get(path) {
  const response = await fetch(`http://127.0.0.1:8000/api/${path}`, { signal: AbortSignal.timeout(3000) });
  assert.equal(response.status, 200); return response.json();
}
async function waitFor(fn, message, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await fn()) return; await sleep(250); }
  throw new Error(`Tempo excedido: ${message}`);
}
async function free(port) {
  await new Promise((yes, no) => { const server = createServer(); server.once('error', no); server.listen(port, '127.0.0.1', () => server.close(yes)); });
}
function launch(executable, args, cwd) {
  const child = spawn(executable, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.on('error', error => console.error(error.message));
  child.stdout.on('data', data => { if (String(data).includes('error')) process.stdout.write(data); });
  child.stderr.on('data', () => {});
  return child;
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  const ended = new Promise(r => child.once('exit', r)); child.kill(); await Promise.race([ended, sleep(5000)]);
}
const startBackend = () => launch(join(repo, '.venv', 'Scripts', 'python.exe'), ['-m', 'uvicorn', 'backend.app.main:app', '--host', '127.0.0.1', '--port', '8000', '--workers', '1', '--no-access-log'], repo);
let backend, preview, browser, context, page, video;
const browserErrors = [], remoteRequests = [];
try {
  await free(8000); await free(5173);
  backend = startBackend();
  preview = launch(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], root);
  await waitFor(async () => { try { return (await get('saude')).status === 'ok'; } catch { return false; } }, 'início do backend');
  await waitFor(async () => { try { return (await fetch('http://127.0.0.1:5173')).ok; } catch { return false; } }, 'início do preview');
  // External connectivity is disabled for this isolated browser process, preserving loopback.
  // Do not disable the user's network adapter or unrelated applications.
  browser = await chromium.launch({ channel: 'chrome', headless: true, proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1,localhost' } });
  context = await browser.newContext({ viewport: { width: 1366, height: 768 }, recordVideo: { dir: output, size: { width: 1366, height: 768 } } });
  const probe = await context.newPage(); let externalBlocked = false;
  try { await probe.goto('https://example.com', { timeout: 5000 }); } catch { externalBlocked = true; }
  await probe.close(); assert.ok(externalBlocked, 'A conexão externa do navegador deveria estar bloqueada.');
  report.offline = { metodo: 'Proxy indisponível no processo isolado do Chrome, com exceção de loopback; rede do Windows não alterada.', bloqueio_externo_comprovado: externalBlocked, inicio: new Date().toISOString() };
  page = await context.newPage(); video = page.video();
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('request', request => { if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname)) remoteRequests.push(request.url()); });
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByText('API conectada')).toBeVisible();
  assert.equal((await get('estado')).estado_simulacao, 'parada');
  await page.screenshot({ path: join(output, '01-inicial.png'), fullPage: true });
  await page.getByRole('button', { name: 'Iniciar referência', exact: true }).click();
  await waitFor(async () => (await get('estado')).calibracao.coletadas >= 24, '24 leituras de referência', 40000);
  await page.screenshot({ path: join(output, '02-calibracao.png'), fullPage: true });
  console.log('Calibração inicial: 24/60 leituras.');
  await waitFor(async () => (await get('estado')).calibracao.estado === 'concluida', 'calibração completa', 55000);
  const calibrated = await get('estado');
  assert.equal(calibrated.estado_simulacao, 'pausada'); assert.equal(calibrated.ultima_leitura, null);
  report.sessao_id = calibrated.sessao_id; report.referencia_id = calibrated.calibracao.referencia_id;
  report.configuracao = await get('configuracao');
  assert.deepEqual(report.configuracao.referencia.estatisticas, golden.referencia.estatisticas);
  report.verificacoes.push('Coleta real 60/60; referência igual à evidência seed 42; teste novo pausado, sem leitura.');
  await checkpoint(); console.log('Referência concluída. Iniciando os cinco cenários reais.');
  for (const expected of golden.resultados) {
    const scenario = expected.cenario;
    if (scenario !== 'normal') {
      await page.getByLabel('Cenário ativo').selectOption(scenario);
      await waitFor(async () => { const s = await get('estado'); return s.cenario_selecionado === scenario && s.estado_simulacao === 'pausada'; }, `selecionar ${scenario}`);
    }
    await expect(page.getByRole('button', { name: 'Iniciar simulação', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    const started = await get('estado');
    assert.equal(started.calibracao.referencia_id, report.referencia_id);
    if (scenario === 'normal') {
      await waitFor(async () => (await get('estado')).ultima_leitura?.sequencia >= 10, 'dez leituras Normal');
      await page.getByRole('button', { name: 'Pausar', exact: true }).click();
      const paused = await get('estado'); await sleep(2100);
      assert.equal((await get('estado')).ultima_leitura.sequencia, paused.ultima_leitura.sequencia);
      await page.getByRole('button', { name: 'Retomar simulação', exact: true }).click();
      report.verificacoes.push('Pausa mantém sequência estável; retomada preserva execução.');
    }
    let lastProgress = -1;
    await waitFor(async () => {
      const state = await get('estado'); const n = state.ultima_leitura?.sequencia ?? 0;
      const progress = Math.floor(n / 30); if (progress > lastProgress) { console.log(`${scenario}: ${n}/120 leituras`); lastProgress = progress; }
      return n >= 120;
    }, `120 leituras ${scenario}`, 145000);
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retomar simulação', exact: true })).toBeEnabled();
    const state = await get('estado');
    const records = (await get(`historico?execucao_id=${state.execucao_atual_id}&limite=1000`)).itens.slice(0, 120);
    assert.equal(records.length, 120); assert.ok(records.every((l, i) => l.sequencia === i + 1 && l.execucao_id === state.execucao_atual_id && l.referencia_id === report.referencia_id));
    const events = (await get(`eventos?execucao_id=${state.execucao_atual_id}`)).itens;
    assert.equal(Math.min(...records.map(l => l.ise)), expected.ise_minimo);
    assert.equal(records.at(-1).ise, expected.ise_final); assert.equal(records.at(-1).classificacao, expected.classificacao_final);
    for (const [classification, time] of Object.entries(expected.primeira_classificacao_s)) assert.equal(records.find(l => l.classificacao === classification)?.tempo_simulado_s, time);
    for (const alert of expected.aberturas) assert.ok(events.some(e => e.tipo === 'alerta_aberto' && e.alerta.codigo === alert.codigo && e.alerta.variavel === alert.variavel && e.sequencia === alert.tempo_simulado_s));
    await expect(page.getByTestId('ise-value')).toHaveText(expected.ise_final.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    await expect(page.getByRole('img', { name: /Gráfico de/ })).toHaveCount(5);
    for (const alert of state.alertas_ativos) await expect(page.getByText(alert.mensagem, { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: join(output, `cenario-${scenario}.png`), fullPage: true });
    report.cenarios.push({ cenario: scenario, execucao_id: state.execucao_atual_id, seed: 42, referencia_id: report.referencia_id, leituras: records, eventos: events, estado: state, esperado: expected, resultado: 'aprovado' });
    await checkpoint(); console.log(`${scenario}: aprovado, ISE final ${expected.ise_final}.`);
    if (scenario === 'normal') {
      await page.reload(); await expect(page.getByText('API conectada')).toBeVisible(); assert.equal((await get('estado')).execucao_atual_id, state.execucao_atual_id);
      report.verificacoes.push('Reload do dashboard mantém sessão, execução e histórico.');
    }
  }
  await page.getByRole('button', { name: /Histórico da sessão/ }).click();
  await page.getByLabel('Execução', { exact: true }).selectOption(report.cenarios[0].execucao_id);
  await expect(page.getByText(/120 leituras recuperadas/)).toBeVisible();
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(page.getByText('Página 2 de 3')).toBeVisible();
  await page.screenshot({ path: join(output, 'historico.png'), fullPage: true });
  report.verificacoes.push('Consulta de execução anterior, tabela paginada e séries separadas.');
  await page.getByRole('button', { name: 'Monitoramento', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: join(output, 'mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  const beforeRestart = await get('estado');
  await page.getByRole('button', { name: 'Nova execução', exact: true }).click();
  await waitFor(async () => (await get('estado')).execucao_atual_id !== beforeRestart.execucao_atual_id, 'nova execução');
  assert.equal((await get('estado')).ultima_leitura, null);
  assert.equal((await get(`historico?execucao_id=${beforeRestart.execucao_atual_id}`)).itens.length >= 120, true);
  await page.getByLabel('Cenário ativo').selectOption('normal');
  await page.getByRole('button', { name: 'Detalhes da simulação', exact: true }).click();
  await page.getByRole('button', { name: 'Refazer referência', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar nova referência', exact: true }).click();
  await waitFor(async () => (await get('estado')).calibracao.estado === 'em_andamento', 'nova coleta');
  await waitFor(async () => (await get('estado')).calibracao.estado === 'concluida', 'recalibração completa', 80000);
  assert.notEqual((await get('estado')).calibracao.referencia_id, report.referencia_id);
  assert.equal((await get(`historico?execucao_id=${report.cenarios[0].execucao_id}`)).itens[0].referencia_id, report.referencia_id);
  report.verificacoes.push('Nova execução preserva passado; recalibração completa gera nova referência e preserva referências históricas.');
  await stop(backend);
  await expect(page.getByText('Sem conexão', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: join(output, 'desconexao.png'), fullPage: true });
  backend = startBackend();
  await expect(page.getByText('API conectada')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/O servidor reiniciou/)).toBeVisible();
  assert.notEqual((await get('estado')).sessao_id, report.sessao_id);
  assert.deepEqual((await get('execucoes')).execucoes, []);
  report.verificacoes.push('Queda e reinício do backend: reconexão, aviso de nova sessão e limpeza do histórico anterior.');
  assert.deepEqual(browserErrors, []); assert.deepEqual(remoteRequests, []);
  report.offline.requisicoes_externas_da_aplicacao = remoteRequests;
  report.offline.resultado = 'aprovado com isolamento de rede do navegador; adaptadores do Windows não alterados';
  report.erros_javascript = browserErrors; report.resultado = 'aprovado';
} catch (error) {
  report.resultado = 'reprovado'; report.erro = String(error.stack || error);
  if (page) await page.screenshot({ path: join(output, 'falha.png'), fullPage: true }).catch(() => {});
  console.error(report.erro); process.exitCode = 1;
} finally {
  report.fim = new Date().toISOString(); await checkpoint();
  if (context) await context.close();
  if (video) { const path = await video.path(); await copyFile(path, join(output, 'demonstracao-reserva.webm')); }
  if (browser) await browser.close();
  await stop(backend); await stop(preview);
  console.log(`Evidências: ${output}`);
}
