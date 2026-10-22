// Сценарий выдачи для локальной проверки (не для рабочего сервера):
// образец каталога и текстов из prisma/sample-content.json, визит с картой, скринингом, схемой и памяткой; выдача; онлайн-карта и PDF.
// node scripts/demo-issue.mjs <outDir> [base]   CARD=номер карты, SKIP_SHOTS=1 без снимков экрана
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const sample = JSON.parse(readFileSync(new URL('../prisma/sample-content.json', import.meta.url), 'utf8'));

const [outDir = 'screenshots/tmp', base = 'http://localhost:3000'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function session(email, password) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'ru-RU' });
  const res = await ctx.request.post(`${base}/api/v1/auth/login`, { data: { email, password }, headers: { origin: base } });
  if (!res.ok()) throw new Error(`login ${email}: ${res.status()} ${await res.text()}`);
  return ctx;
}
const call = async (ctx, method, url, data) => {
  const r = await ctx.request.fetch(`${base}${url}`, { method, data, headers: { origin: base }, timeout: 240_000 });
  if (!r.ok()) throw new Error(`${method} ${url}: ${r.status()} ${await r.text()}`);
  return r.headers()['content-type']?.includes('json') ? r.json() : r.body();
};

const admin = await session('admin@sanabilis.local', 'admin-password');
const doctor = await session('doctor@sanabilis.local', 'demo-password');

// образец каталога (только для локальной проверки)
let catalog = await call(admin, 'GET', '/api/v1/admin/brushes');
const { brand, line, sizes } = sample.brushes;
for (const [i, [label, passage, color]] of sizes.entries()) {
  if (catalog.some((c) => c.brand === brand && c.label === label)) continue;
  await call(admin, 'POST', '/api/v1/admin/brushes', { brand, line, label, passageMm: passage, colorHex: color, verified: true, sortOrder: i + 1 });
}
catalog = (await call(admin, 'GET', '/api/v1/admin/brushes')).filter((c) => c.brand === brand).sort((x, y) => x.passageMm - y.passageMm);
for (const [code, text] of Object.entries(sample.psr)) {
  await call(admin, 'PUT', '/api/v1/admin/psr-texts', { code, staffText: text.staff, patientText: text.patient });
  await call(doctor, 'POST', `/api/v1/admin/psr-texts/${encodeURIComponent(code)}/approve`, { approved: true });
}
await call(admin, 'PUT', '/api/v1/admin/settings', {
  idleTimeoutMin: 30,
  clinic: { name: 'SANABILIS', address: 'Москва, ул. Маршала Тимошенко, д. 17, корп. 2', phone: '+7 (495) 417-00-00', site: 'sanabilis.ru' },
  brushSteps: sample.brushSteps,
});

const card = process.env.CARD ?? `D-${Date.now().toString().slice(-5)}`;
const patient = await call(doctor, 'POST', '/api/v1/patients', { cardNumber: card, displayName: sample.patient.displayName, fullName: sample.patient.fullName });
const visit = await call(doctor, 'POST', `/api/v1/patients/${patient.id}/visits`, { copyBrushMap: false });
const map = await call(doctor, 'POST', `/api/v1/visits/${visit.id}/documents`, { type: 'BRUSH_MAP' });
const ids = catalog.map((c) => c.id);
const upper = ['17-16', '16-15', '15-14', '14-13', '13-12', '12-11', '11-21', '21-22', '22-23', '23-24', '24-25', '25-26', '26-27'];
const lower = ['47-46', '46-45', '45-44', '44-43', '43-42', '42-41', '41-31', '31-32', '32-33', '33-34', '34-35', '35-36', '36-37'];
const pick = (k) => (/1[12]|2[12]|4[12]|3[12]/.test(k) ? ids[0] : /1[34]-|2[34]|4[34]|3[34]/.test(k) ? ids[1] : /16|26|46|36/.test(k) ? ids[3] : ids[2]);
const elements = {};
for (const k of [...upper, ...lower]) elements[k] = { size: { catalogId: pick(k) }, bleeding: ['16-15', '26-27', '35-36'].includes(k), pain: k === '14-13', openContact: false, approach: 'VESTIBULAR', method: 'THROUGH', alternative: null };
elements['11-21'] = { size: null, alternative: 'FLOSS', bleeding: null, pain: false, openContact: false, approach: 'VESTIBULAR', method: 'THROUGH' };
const teeth = {};
for (const t of [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]) teeth[t] = { state: t % 10 === 8 ? 'MISSING' : 'PRESENT', furcation: t === 46 };
await call(doctor, 'PATCH', `/api/v1/documents/${map.id}`, { content: { schema: 1, teeth, elements, extras: [] }, rev: map.rev });

const psr = await call(doctor, 'POST', `/api/v1/visits/${visit.id}/documents`, { type: 'PSR' });
const sx = (code, asterisk = false) => ({ code, asterisk });
await call(doctor, 'PATCH', `/api/v1/documents/${psr.id}`, { content: { schema: 1, sextants: { S1: sx(2), S2: sx(1), S3: sx(2), S4: sx(2, true), S5: sx(1), S6: sx(0) } }, rev: psr.rev });

const templates = await call(doctor, 'GET', '/api/v1/templates?kind=HYGIENE_PLAN');
const plan = await call(doctor, 'POST', `/api/v1/visits/${visit.id}/documents`, { type: 'HYGIENE_PLAN', templateId: templates[0].id });
// Текстовые пункты и предупреждения шаблона заполняются образцом по названию раздела
const fill = (doc, texts) => {
  for (const section of doc.sections) {
    const own = texts[section.title];
    for (const item of section.items) {
      if (item.type === 'text' && own) item.text = own[0];
      if (item.type === 'warning') [item.title, item.text] = texts.warning;
    }
  }
  return doc;
};
const filled = fill(plan.content, sample.plan);
const extra = filled.sections.find((x) => x.title === 'Дополнительные средства');
extra.items.push({ id: 'sampleprod1', type: 'product', required: false, usage: '', frequency: '', duration: '', enabled: true, selected: [], value: '', ...sample.plan.product });
await call(doctor, 'PATCH', `/api/v1/documents/${plan.id}`, { content: filled, rev: plan.rev });

const afterTemplates = await call(doctor, 'GET', '/api/v1/templates?kind=AFTERCARE');
const afterTpl = afterTemplates.find((x) => x.title === sample.aftercare.title);
const after = await call(doctor, 'POST', `/api/v1/visits/${visit.id}/documents`, { type: 'AFTERCARE', templateId: afterTpl.id });
await call(doctor, 'PATCH', `/api/v1/documents/${after.id}`, { content: fill(after.content, sample.aftercare), rev: after.rev });
await call(doctor, 'PATCH', `/api/v1/visits/${visit.id}`, { nextVisitMonths: 6 });

const ready = await call(doctor, 'GET', `/api/v1/visits/${visit.id}/readiness`);
console.log('blockers', JSON.stringify(ready.blockers));
const issued = await call(doctor, 'POST', `/api/v1/visits/${visit.id}/issue`);
console.log(JSON.stringify({ visit: visit.id, url: issued.url, issue: issued.issueId }));
const pdf = await call(doctor, 'GET', `/api/v1/issues/${issued.issueId}/pdf`);
await writeFile(`${outDir}/document.pdf`, pdf);

if (process.env.SKIP_SHOTS) {
  await browser.close();
  process.exit(0);
}

const pub = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ru-RU' });
const pp = await pub.newPage();
await pp.goto(issued.url.replace(/^https?:\/\/[^/]+/, base));
await pp.waitForTimeout(6000);
await pp.screenshot({ path: `${outDir}/patient-390.png`, timeout: 120_000, animations: 'disabled' });
const dpub = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'ru-RU' });
const dp = await dpub.newPage();
await dp.goto(issued.url.replace(/^https?:\/\/[^/]+/, base));
await dp.waitForTimeout(6000);
await dp.screenshot({ path: `${outDir}/patient-1440.png`, timeout: 120_000, animations: 'disabled' });

const dpage = await doctor.newPage();
await dpage.goto(`${base}/visits/${visit.id}?step=issue`);
await dpage.waitForTimeout(1500);
await dpage.screenshot({ path: `${outDir}/issue-1440.png`, timeout: 120_000 });
await browser.close();
