import { spawn, spawnSync } from 'node:child_process';
import { existsSync, openSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const QRCode = require('qrcode-svg');
const frontend = dirname(dirname(fileURLToPath(import.meta.url)));
const root = dirname(frontend);
const python = join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const vite = join(frontend, 'node_modules/vite/bin/vite.js');
const typescript = join(frontend, 'node_modules/typescript/bin/tsc');
const api = 'http://127.0.0.1:8000/api/saude';
const site = 'http://127.0.0.1:5173/';

function localAddress() {
  if (process.env.PREVLOSS_HOST) return process.env.PREVLOSS_HOST;
  const addresses = Object.entries(networkInterfaces()).flatMap(([name, items]) =>
    (items ?? []).filter(item => item.family === 'IPv4' && !item.internal)
      .map(item => ({ name, address: item.address })));
  return addresses.find(item => /wi-?fi|wlan/i.test(item.name))?.address
    ?? addresses.find(item => item.address.startsWith('192.168.'))?.address
    ?? addresses.find(item => item.address.startsWith('10.'))?.address
    ?? addresses[0]?.address;
}

async function available(url) {
  try { return (await fetch(url, { signal: AbortSignal.timeout(1500) })).ok; }
  catch { return false; }
}

async function waitFor(url, label) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await available(url)) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`${label} não iniciou. Confira se a porta está livre.`);
}

function launch(program, args, cwd, log) {
  const output = openSync(join(root, '.venv', log), 'a');
  const child = spawn(program, args, { cwd, detached: true, windowsHide: true, stdio: ['ignore', output, output] });
  child.unref();
}

try {
  const address = localAddress();
  if (!address) throw new Error('Nenhum endereço IPv4 de rede encontrado. Conecte o computador ao Wi-Fi.');
  if (!existsSync(python)) throw new Error('Ambiente Python ausente. Execute uv sync --locked na raiz do projeto.');
  if (!existsSync(vite) || !existsSync(typescript)) throw new Error('Dependências do frontend ausentes. Execute npm ci na pasta frontend.');

  const build = spawnSync(process.execPath, [typescript, '-b'], { cwd: frontend, stdio: 'inherit' });
  if (build.status !== 0) throw new Error('Falha na verificação TypeScript.');
  const bundle = spawnSync(process.execPath, [vite, 'build'], { cwd: frontend, stdio: 'inherit' });
  if (bundle.status !== 0) throw new Error('Falha ao gerar o dashboard.');

  if (!(await available(api))) {
    launch(python, ['-m', 'uvicorn', 'backend.app.main:app', '--host', '127.0.0.1', '--port', '8000', '--workers', '1'], root, 'prevloss-api.log');
    await waitFor(api, 'API');
  }
  if (!(await available(site))) {
    launch(process.execPath, [vite, 'preview', '--host', '0.0.0.0', '--port', '5173', '--strictPort'], frontend, 'prevloss-dashboard.log');
    await waitFor(site, 'Dashboard');
  }
  await waitFor('http://127.0.0.1:5173/api/saude', 'Conexão com a API pelo dashboard');

  const url = `http://${address}:5173/`;
  const qrPath = join(frontend, 'dist', 'acesso-mobile.svg');
  writeFileSync(qrPath, new QRCode({ content: url, padding: 4, width: 400, height: 400 }).svg());
  console.log(`\nAbra no celular conectado ao mesmo Wi-Fi: ${url}`);
  console.log(`QR Code: ${qrPath}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
