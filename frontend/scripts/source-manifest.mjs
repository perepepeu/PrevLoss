import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
const repo = fileURLToPath(new URL('../../', import.meta.url));
const output = join(repo, 'docs/evidencias/pedro/fontes-sha256.json');
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.filter(e => e.name !== '__pycache__').map(e => e.isDirectory() ? files(join(dir, e.name)) : join(dir, e.name)))).flat();
}
const selected = [
  ...await files(join(repo, 'frontend/src')), ...await files(join(repo, 'frontend/e2e')),
  ...await files(join(repo, 'frontend/scripts')), ...await files(join(repo, 'backend/app')),
  ...['frontend/package.json', 'frontend/package-lock.json', 'frontend/vite.config.ts', 'frontend/tsconfig.json', 'frontend/playwright.config.ts', 'frontend/index.html', 'docs/openapi.json', 'docs/contrato-v1.d.ts', 'docs/referencias/ALTERACAO.pdf'].map(p => join(repo, p)),
];
const manifest = {};
for (const path of selected.sort()) manifest[relative(repo, path).replaceAll('\\', '/')] = createHash('sha256').update(await readFile(path)).digest('hex');
await mkdir(join(repo, 'docs/evidencias/pedro'), { recursive: true });
await writeFile(output, JSON.stringify({ data: new Date().toISOString(), algoritmo: 'SHA-256', arquivos: manifest }, null, 2));
console.log(output);
