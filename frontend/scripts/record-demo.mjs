import { chromium, expect } from '@playwright/test';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const output = fileURLToPath(new URL(`../../docs/evidencias/pedro/video-reserva/${stamp}/`, import.meta.url));
await mkdir(output, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const start = Date.now();
// Observe only: this recorder never starts, pauses or changes a backend execution.
while (true) {
  if (Date.now() - start > 900000) throw new Error('Múltiplos desvios não iniciou no prazo de 15 minutos.');
  try {
    const state = await (await fetch('http://127.0.0.1:8000/api/estado')).json();
    if (state.cenario_selecionado === 'multiplos_desvios' && state.estado_simulacao === 'executando' && (state.ultima_leitura?.sequencia ?? 0) < 15) break;
  } catch { /* Wait for the independently controlled real scenario. */ }
  await sleep(1000);
}
const browser = await chromium.launch({ channel: 'chrome', proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1,localhost' } });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, recordVideo: { dir: output, size: { width: 1366, height: 900 } } });
await context.addInitScript(() => localStorage.setItem('prevloss:onboarding:v3', 'complete'));
const page = await context.newPage(); const video = page.video();
try {
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByText('Sistema online')).toBeVisible();
  await page.evaluate(() => {
    const label = document.createElement('div'); label.textContent = 'Gravação reserva | Ambiente simulado | Múltiplos desvios · seed 42';
    Object.assign(label.style, { position: 'fixed', bottom: '0', left: '0', right: '0', zIndex: '1000', background: '#183044', color: 'white', padding: '10px 30px', font: '14px Segoe UI', textAlign: 'center' });
    document.body.append(label);
  });
  await sleep(4000);
  await page.getByRole('heading', { name: 'Condição do equipamento' }).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 200));
  await sleep(40000);
  await page.getByRole('heading', { name: 'Evolução das leituras' }).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 240));
  await sleep(15000);
  await page.getByRole('button', { name: /^Histórico/ }).click();
  await page.getByLabel('Execução', { exact: true }).selectOption({ index: 5 });
  await page.getByRole('heading', { name: 'Registros da execução' }).scrollIntoViewIfNeeded();
  await sleep(6000);
  await page.screenshot({ path: `${output}/consulta-final.png`, fullPage: true });
  const state = await (await fetch('http://127.0.0.1:8000/api/estado')).json();
  await writeFile(`${output}/registro.json`, JSON.stringify({ data: new Date().toISOString(), finalidade: 'Gravação reserva identificada, observação da execução real sem comandos de mutação', sessao: state.sessao_id, execucao: state.execucao_atual_id, referencia: state.calibracao.referencia_id, offline: 'Chrome com acesso externo bloqueado por proxy e loopback liberado' }, null, 2));
} finally {
  await context.close(); await rename(await video.path(), `${output}/demonstracao-reserva.webm`); await browser.close();
}
console.log(`Gravação: ${output}`);
