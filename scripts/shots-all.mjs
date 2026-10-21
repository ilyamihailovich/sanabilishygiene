// Скриншоты всех экранов в контрольных размерах: node scripts/shots-all.mjs <outDir> <visitId> <patientId> <patientPath>
import { chromium } from 'playwright';

const [outDir, visitId, patientId, patientPath, base = 'http://localhost:3000'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sizes = [
  { name: '1440', width: 1440, height: 900, mobile: false },
  { name: '1280', width: 1280, height: 800, mobile: false },
  { name: '390', width: 390, height: 844, mobile: true },
];

async function ctxFor(size, email, password = 'demo-password') {
  const ctx = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.mobile ? 3 : 2,
    isMobile: size.mobile,
    hasTouch: size.mobile,
    locale: 'ru-RU',
  });
  if (email) {
    const r = await ctx.request.post(`${base}/api/v1/auth/login`, { data: { email, password }, headers: { origin: base } });
    if (!r.ok()) throw new Error(`login ${email}`);
  }
  return ctx;
}

async function shot(page, name, { wait = 1200, full = false } = {}) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: full, timeout: 120_000, animations: 'disabled' });
}

for (const size of sizes) {
  const anon = await ctxFor(size);
  const p0 = await anon.newPage();
  await p0.goto(`${base}/login`);
  await shot(p0, `login-${size.name}`, { wait: 600 });
  await p0.goto(`${base}${patientPath}`);
  await shot(p0, `patient-card-${size.name}`, { wait: 7000 });
  await anon.close();

  const doc = await ctxFor(size, 'doctor@sanabilis.local');
  await doc.request.patch(`${base}/api/v1/me/prefs`, { data: { mapMode: 'three' }, headers: { origin: base } });
  const p = await doc.newPage();
  const pages = [
    ['home', '/', 1200, true],
    ['patients', '/patients', 1000, false],
    ['patient', `/patients/${patientId}`, 1200, true],
    ['visit-map-3d', `/visits/${visitId}?step=map`, 7000, false],
    ['visit-psr', `/visits/${visitId}?step=psr`, 1200, true],
    ['visit-plan', `/visits/${visitId}?step=plan`, 1200, true],
    ['visit-issue', `/visits/${visitId}?step=issue`, 1500, true],
    ['templates', '/templates', 1000, false],
    ['account', '/account', 1000, true],
  ];
  for (const [name, url, wait, full] of pages) {
    await p.goto(`${base}${url}`);
    await shot(p, `${name}-${size.name}`, { wait, full });
  }
  await doc.request.patch(`${base}/api/v1/me/prefs`, { data: { mapMode: 'scheme' }, headers: { origin: base } });
  await p.goto(`${base}/visits/${visitId}?step=map`);
  await shot(p, `visit-map-scheme-${size.name}`, { wait: 1500 });
  await doc.close();

  if (!size.mobile) {
    const adm = await ctxFor(size, 'admin@sanabilis.local', 'admin-password');
    const a = await adm.newPage();
    for (const [name, url] of [
      ['admin', '/admin'],
      ['admin-users', '/admin/users'],
      ['admin-catalog', '/admin/catalog'],
      ['admin-texts', '/admin/texts'],
      ['admin-audit', '/admin/audit'],
      ['admin-settings', '/admin/settings'],
    ]) {
      await a.goto(`${base}${url}`);
      await shot(a, `${name}-${size.name}`, { wait: 900 });
    }
    const tpl = await (await adm.request.get(`${base}/api/v1/templates?kind=HYGIENE_PLAN`)).json();
    await a.goto(`${base}/templates/${tpl[0].id}`);
    await shot(a, `template-editor-${size.name}`, { wait: 1000 });
    await a.goto(`${base}/present/${visitId}`);
    await shot(a, `present-${size.name}`, { wait: 7000 });
    await adm.close();
  }
}
await browser.close();
