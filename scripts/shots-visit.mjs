// Сквозной сценарий для скриншотов: вход, пациент, визит, карта. node scripts/shots-visit.mjs <outDir> [base]
import { chromium } from 'playwright';

const [outDir = 'screenshots/tmp', base = 'http://localhost:3000'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function login(context, email) {
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill('demo-password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL(`${base}/`);
  return page;
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'ru-RU' });
const page = await login(ctx, 'doctor@sanabilis.local');
const card = `T-${Date.now().toString().slice(-6)}`;
const patient = await (await page.request.post(`${base}/api/v1/patients`, { data: { cardNumber: card, displayName: 'Анна' } })).json();
const visit = await (await page.request.post(`${base}/api/v1/patients/${patient.id}/visits`, { data: { copyBrushMap: false } })).json();
await page.request.post(`${base}/api/v1/visits/${visit.id}/documents`, { data: { type: 'BRUSH_MAP' } });
await page.request.patch(`${base}/api/v1/me/prefs`, { data: { mapMode: 'scheme' } });
console.log(JSON.stringify({ visit: visit.id, patient: patient.id }));
await page.screenshot({ path: `${outDir}/home-1440.png` });
await page.goto(`${base}/visits/${visit.id}?step=map`);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/map-scheme-1440.png` });
await page.locator('[data-key="16-15"]').click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}/map-popover-1440.png` });
await page.keyboard.press('Escape');
await page.getByRole('radio', { name: '3D' }).click();
await page.waitForTimeout(6000);
await page.screenshot({ path: `${outDir}/map-3d-1440.png` });
await page.getByRole('button', { name: 'Верхняя' }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/map-3d-upper-1440.png` });
await ctx.close();

const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ru-RU' });
const mp = await login(m, 'hygienist@sanabilis.local');
await mp.request.patch(`${base}/api/v1/me/prefs`, { data: { mapMode: 'scheme' } });
await mp.goto(`${base}/visits/${visit.id}?step=map`);
await mp.waitForTimeout(1500);
await mp.screenshot({ path: `${outDir}/map-scheme-390.png` });
await mp.locator('[data-key="16-15"]').tap();
await mp.waitForTimeout(800);
await mp.screenshot({ path: `${outDir}/map-sheet-390.png` });
await m.close();
await browser.close();
