import { readdir } from 'node:fs/promises';
import path from 'node:path';

export const FONT_FAMILY = 'Relative Pro';
export const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts');

const WEIGHTS: ReadonlyArray<readonly [string, number]> = [
  ['extralight', 200],
  ['ultralight', 200],
  ['semibold', 600],
  ['demibold', 600],
  ['extrabold', 800],
  ['ultrabold', 800],
  ['hairline', 100],
  ['thin', 100],
  ['light', 300],
  ['book', 400],
  ['regular', 400],
  ['normal', 400],
  ['roman', 400],
  ['medium', 500],
  ['bold', 700],
  ['heavy', 800],
  ['black', 900],
];

export interface FontFace {
  file: string;
  weight: number;
  style: 'normal' | 'italic';
}

/** Начертание по имени файла: RelativePro-MediumItalic.woff2, relative-pro-book.woff2 и т. п. */
export function parseFontFile(file: string): FontFace | null {
  if (!file.toLowerCase().endsWith('.woff2')) return null;
  const name = file.toLowerCase().replace(/\.woff2$/, '').replace(/[\s_]/g, '-');
  if (name.includes('mono') || name.includes('faux')) return null;
  const style = /italic|oblique/.test(name) ? 'italic' : 'normal';
  const tokens = name.split('-').join('');
  const found = WEIGHTS.find(([key]) => tokens.includes(key));
  return { file, weight: found ? found[1] : 400, style };
}

export function buildFontCss(faces: FontFace[]): string {
  return faces
    .map(
      (f) => `@font-face {
  font-family: '${FONT_FAMILY}';
  src: url('/fonts/${encodeURIComponent(f.file)}') format('woff2');
  font-weight: ${f.weight};
  font-style: ${f.style};
  font-display: swap;
}`,
    )
    .join('\n');
}

export async function readFontFaces(dir = FONTS_DIR): Promise<FontFace[]> {
  let files: string[];
  try {
    files = await readdir(/*turbopackIgnore: true*/ dir);
  } catch {
    return [];
  }
  const seen = new Set<string>();
  return files
    .sort()
    .map(parseFontFile)
    .filter((f): f is FontFace => f !== null)
    .filter((f) => {
      const key = `${f.weight}-${f.style}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
