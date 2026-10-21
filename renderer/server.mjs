// Сервис генерации PDF и рендера ракурсов 3D-сцены. Доступен только во внутренней сети контейнеров.
// POST /pdf     { url, footer }        → application/pdf
// POST /renders { url, views: [...] }  → { images: { view: base64png } }
import http from 'node:http';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT ?? 3100);
const ALLOWED = (process.env.ALLOWED_ORIGINS ?? 'http://app:3000,http://localhost:3000').split(',');

let browserPromise = null;
// Браузер перезапускается, если упал или был закрыт
const browser = async () => {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b?.isConnected()) return b;
  }
  browserPromise = chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none'],
  });
  return browserPromise;
};

// Очередь: один рендер за раз, Chromium в контейнере не перегружается
let queue = Promise.resolve();
const serial = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
};

function checkUrl(url) {
  const u = new URL(url);
  if (!ALLOWED.includes(u.origin)) throw new Error(`origin ${u.origin} не разрешён`);
  return u;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function makePdf({ url, footer }) {
  checkUrl(url);
  const b = await browser();
  const ctx = await b.newContext({ locale: 'ru-RU' });
  try {
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForFunction(() => window.__printReady === true, null, { timeout: 15_000 }).catch(() => undefined);
    await page.emulateMedia({ media: 'print' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;padding:0 14mm;font-size:7.5pt;color:#6e6e73;display:flex;justify-content:space-between;font-family:-apple-system,'Segoe UI',Roboto,sans-serif">
        <span>${esc(footer ?? '')}</span><span>Страница <span class="pageNumber"></span> из <span class="totalPages"></span></span></div>`,
      margin: { top: '14mm', bottom: '18mm', left: '14mm', right: '14mm' },
    });
  } finally {
    await ctx.close();
  }
}

async function makeRenders({ url, views }) {
  checkUrl(url);
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1, locale: 'ru-RU' });
  const images = {};
  try {
    const page = await ctx.newPage();
    const first = new URL(url);
    first.searchParams.set('view', views[0]);
    await page.goto(first.toString(), { waitUntil: 'load', timeout: 60_000 });
    for (const view of views) {
      await page.evaluate((v) => window.__setCaptureView?.(v), view);
      await page.waitForTimeout(100);
      await page.waitForFunction(() => window.__sanabilisReady === true, null, { timeout: 120_000 });
      await page.waitForTimeout(300);
      const box = await page.locator('[data-capture]').boundingBox();
      images[view] = (await page.screenshot({ type: 'png', ...(box ? { clip: box } : {}), animations: 'disabled', timeout: 90_000 })).toString('base64');
    }
    return { images };
  } finally {
    await ctx.close();
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e5) reject(new Error('слишком большой запрос'));
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (e) {
        reject(e);
      }
    });
  });
}

http
  .createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200).end('ok');
        return;
      }
      if (req.method !== 'POST') {
        res.writeHead(405).end();
        return;
      }
      const body = await readBody(req);
      if (req.url === '/pdf') {
        const pdf = await serial(() => makePdf(body));
        res.writeHead(200, { 'Content-Type': 'application/pdf' }).end(pdf);
      } else if (req.url === '/renders') {
        const out = await serial(() => makeRenders(body));
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(out));
      } else {
        res.writeHead(404).end();
      }
    } catch (e) {
      console.error(e);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String(e?.message ?? e));
    }
  })
  .listen(PORT, () => console.log(`renderer: порт ${PORT}`));
