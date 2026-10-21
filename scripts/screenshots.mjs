// Скриншоты страницы в контрольных размерах: node scripts/screenshots.mjs <url> <outDir>
import { chromium } from 'playwright';

const [url = 'http://localhost:3000/dev/ui', outDir = 'screenshots'] = process.argv.slice(2);
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900, mobile: false },
  { name: 'desktop-1280', width: 1280, height: 800, mobile: false },
  { name: 'iphone-390', width: 390, height: 844, mobile: true },
];

const browser = await chromium.launch();
for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${outDir}/${vp.name}-full.png`, fullPage: true });

  const marker = page.getByRole('button', { name: /Промежуток 16\/15/ });
  await marker.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -120));
  await marker.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/${vp.name}-input.png` });
  await context.close();
}
await browser.close();
