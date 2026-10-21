import { buildFontCss, readFontFaces } from '@/server/fonts';

export const dynamic = 'force-dynamic';

/** Шрифт подключается добавлением файлов в public/fonts, без правок кода. */
export async function GET() {
  const css = buildFontCss(await readFontFaces());
  return new Response(css, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
