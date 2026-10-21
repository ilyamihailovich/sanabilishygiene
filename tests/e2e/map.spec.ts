import { expect, test, type Page } from '@playwright/test';

async function loginAs(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill('demo-password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL('/');
}

async function newVisitWithMap(page: Page, mode: 'scheme' | 'three') {
  const req = page.request;
  const origin = { origin: new URL(page.url()).origin };
  const patient = await (await req.post('/api/v1/patients', { data: { cardNumber: `E2E-${Date.now()}` }, headers: origin })).json();
  const visit = await (await req.post(`/api/v1/patients/${patient.id}/visits`, { data: { copyBrushMap: false }, headers: origin })).json();
  const doc = await (await req.post(`/api/v1/visits/${visit.id}/documents`, { data: { type: 'BRUSH_MAP' }, headers: origin })).json();
  await req.patch('/api/v1/me/prefs', { data: { mapMode: mode }, headers: origin });
  return { visitId: visit.id as string, docId: doc.id as string };
}

test('клавиатура: стрелки по порядку осмотра, цифра ставит размер, B — кровоточивость', async ({ page }) => {
  await loginAs(page, 'doctor@sanabilis.local');
  const { visitId } = await newVisitWithMap(page, 'scheme');
  await page.goto(`/visits/${visitId}?step=map`);
  await page.locator('[data-key="17-16"]').waitFor();

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-key="17-16"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-key="16-15"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-key="46-45"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('1');
  await page.keyboard.press('KeyB');
  await expect(page.getByText('Сохранено')).toBeVisible({ timeout: 10_000 });

  const visit = await (await page.request.get(`/api/v1/visits/${visitId}`)).json();
  const map = visit.documents.find((d: { type: string }) => d.type === 'BRUSH_MAP');
  expect(map.content.elements['16-15'].size).toBeTruthy();
  expect(map.content.elements['16-15'].bleeding).toBe(true);
  expect(map.boibPct).toBe(100);

  await page.keyboard.press('Control+z');
  await expect(page.getByText('Сохранено')).toBeVisible({ timeout: 10_000 });
});

test('3D и схема показывают один и тот же набор промежутков', async ({ page }) => {
  await loginAs(page, 'doctor@sanabilis.local');
  const { visitId } = await newVisitWithMap(page, 'scheme');
  await page.goto(`/visits/${visitId}?step=map`);
  await page.locator('[data-key="17-16"]').waitFor();
  const scheme = (await page.locator('[data-key]').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))).sort();
  await page.getByRole('radio', { name: '3D' }).click();
  await page.locator('button[data-key="17-16"]').waitFor({ timeout: 90_000 });
  const three = (await page.locator('button[data-key]').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))).sort();
  expect(three).toEqual(scheme);
});
