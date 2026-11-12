import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../docs/fixtures/${name}.json`, import.meta.url), 'utf8'));

test.beforeEach(async ({ page }, testInfo) => {
  if (!testInfo.title.includes('tutorial aparece')) {
    await page.addInitScript(() => localStorage.setItem('prevloss:onboarding:v3', 'complete'));
  }
});

async function mock(page: Page, name: string) {
  let state = fixture(name); let offline = false;
  const posts: string[] = [];
  await page.route('http://127.0.0.1:8000/api/**', async route => {
    if (offline) return route.abort();
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.split('/').at(-1)!;
    if (request.method() === 'POST') { posts.push(path); state = fixture(path === 'iniciar' ? 'calibracao-24-de-60' : 'pausa'); return route.fulfill({ json: state }); }
    if (path === 'estado') return route.fulfill({ json: state });
    if (['saude', 'configuracao', 'cenarios'].includes(path)) return route.fulfill({ json: fixture(path) });
    if (path === 'execucoes') return route.fulfill({ json: { execucoes: state.execucao_atual_id ? [{ id: state.execucao_atual_id, sessao_id: state.sessao_id, tipo: 'teste', cenario: state.cenario_selecionado, seed: 42, referencia_id: state.calibracao.referencia_id, criada_em: '2026-11-10T12:00:00Z', encerrada_em: null, total_leituras: state.ultima_leitura?.sequencia ?? 0 }] : [], referencias: [] } });
    if (path === 'eventos') return route.fulfill({ json: { execucao_id: null, itens: [] } });
    if (path === 'historico') {
      const n = state.ultima_leitura?.sequencia ?? 0; const cursor = Number(url.searchParams.get('apos_sequencia'));
      const items = Array.from({ length: n }, (_, i) => ({ ...state.ultima_leitura, sequencia: i + 1, tempo_simulado_s: i + 1 })).slice(cursor);
      return route.fulfill({ json: { execucao_id: url.searchParams.get('execucao_id'), itens: items, proxima_sequencia: n, tem_mais: false } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return { posts, setState: (name: string) => { state = fixture(name); }, incompatible: () => { state = { ...state, versao_contrato: '2' }; }, offline: (value: boolean) => { offline = value; } };
}

test('estado inicial, início explícito e progresso', async ({ page }) => {
  const api = await mock(page, 'estado-inicial'); await page.goto('/');
  await expect(page.getByText('Sistema online')).toBeVisible(); expect(api.posts).toEqual([]);
  await page.getByRole('button', { name: 'Iniciar linha de base', exact: true }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '24');
  await expect(page.locator('#scenario')).toBeDisabled();
  expect(api.posts).toEqual(['iniciar']);
  api.setState('execucao-nova-pausada');
  await expect(page.getByText('Linha de base concluída. Inicie o monitoramento.')).toBeVisible();
  expect(api.posts).toEqual(['iniciar']);
  await page.reload(); await expect(page.getByText('Sistema online')).toBeVisible(); expect(api.posts).toEqual(['iniciar']);
});
test('recupera contrato e conexão preservando últimos dados', async ({ page }) => {
  const api = await mock(page, 'normal'); await page.goto('/'); await expect(page.getByText('Sistema online')).toBeVisible();
  api.incompatible(); await expect(page.getByText('Dados incompatíveis', { exact: true })).toBeVisible();
  await expect(page.getByTestId('ise-value')).toHaveText('100,00'); await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeDisabled();
  api.setState('normal'); await page.getByRole('button', { name: 'Tentar sincronizar novamente' }).click({ force: true }).catch(() => {});
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeEnabled();
  api.offline(true); await expect(page.getByText('Sem conexão', { exact: true })).toBeVisible();
  await expect(page.getByTestId('ise-value')).toHaveText('100,00');
  api.offline(false); await page.getByRole('button', { name: 'Tentar sincronizar novamente' }).click({ force: true }).catch(() => {}); await expect(page.getByText('Sistema online')).toBeVisible();
});
test('alerta com Normal, gráficos e layout estreito', async ({ page }) => {
  await mock(page, 'normal-com-alerta-individual'); await page.goto('/'); await expect(page.getByText('Sistema online')).toBeVisible();
  await expect(page.getByText(fixture('normal-com-alerta-individual').alertas_ativos[0].mensagem.replace(/^Ambiente simulado:\s*/, ''))).toBeVisible();
  await expect(page.getByRole('img', { name: /Gráfico de/ })).toHaveCount(5);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Ir para o conteúdo' })).toBeFocused();
});

test('build de apresentação não ativa fixtures por parâmetro de URL', async ({ page }) => {
  const api = await mock(page, 'estado-inicial');
  await page.goto('/?fixture=critico');
  await expect(page.getByText('Sistema online')).toBeVisible();
  await expect(page.getByTestId('ise-value')).toHaveText('—');
  await expect(page.getByText(/Modo de desenvolvimento/)).toHaveCount(0);
  expect(api.posts).toEqual([]);
});

test('seletor de histórico tem nome acessível exato e mostra registros', async ({ page }) => {
  await mock(page, 'normal'); await page.goto('/');
  await expect(page.getByText('Sistema online')).toBeVisible();
  await page.getByRole('button', { name: /^Histórico/ }).click();
  const selector = page.getByLabel('Execução', { exact: true });
  await expect(selector).toBeEnabled();
  await selector.selectOption(fixture('normal').execucao_atual_id);
  await expect(page.getByText(/1 leituras recuperadas/)).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
});

test('tutorial aparece no primeiro uso, persiste e pode ser reaberto', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mock(page, 'estado-inicial');
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Bem-vindo ao prevLoss' });
  await expect(dialog).toBeVisible();
  await expect(page.getByText('Passo 1 de 6')).toBeVisible();
  await page.getByRole('button', { name: 'Próximo' }).click();
  await expect(page.getByRole('heading', { name: 'Prepare a linha de base' })).toBeVisible();
  await page.getByRole('button', { name: 'Pular tutorial' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ajuda', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Bem-vindo ao prevLoss' })).toBeVisible();
  const tourBox = await page.getByRole('dialog').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width };
  });
  expect(tourBox.left).toBeGreaterThanOrEqual(0);
  expect(tourBox.right).toBeLessThanOrEqual(390);
  expect(tourBox.bottom).toBeLessThanOrEqual(844);
});

test('mobile prioriza condição, ação e navegação sem transbordar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mock(page, 'normal-com-alerta-individual');
  await page.goto('/');
  await expect(page.getByLabel('Resumo da condição')).toBeVisible();
  await expect(page.getByLabel('Navegação principal')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Ação principal', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Gráfico de/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Vibração', exact: true }).click();
  await expect(page.getByRole('img', { name: /Gráfico de Vibração/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toHaveCount(1);
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    headerHeight: document.querySelector('.app-header')!.getBoundingClientRect().height,
    shortButtons: [...document.querySelectorAll('button')].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.height < 44;
    }).map(element => ({ text: element.textContent, height: element.getBoundingClientRect().height })),
  }));
  expect(layout.overflow).toBe(false);
  expect(layout.headerHeight).toBeLessThanOrEqual(70);
  expect(layout.shortButtons).toEqual([]);
  await page.screenshot({ path: 'test-results/mobile-dashboard-390.png', fullPage: true });
});

test('mobile funciona de 320 a 430 px e em paisagem', async ({ page }) => {
  await mock(page, 'normal');
  for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 800 }, { width: 412, height: 915 }, { width: 430, height: 932 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByText('Sistema online')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByLabel('Navegação principal')).toBeVisible();
  }
});

test('histórico mobile usa cartões e nova execução exige confirmação', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await mock(page, 'normal');
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova execução', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Começar uma nova execução?' })).toBeVisible();
  expect(api.posts).toEqual([]);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Ação principal', exact: true })).toHaveCount(0);
  const selector = page.getByLabel('Execução', { exact: true });
  await selector.selectOption(fixture('normal').execucao_atual_id);
  await expect(page.getByLabel('Leituras da execução')).toBeVisible();
  await expect(page.getByRole('table')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-history-390.png', fullPage: true });
});
