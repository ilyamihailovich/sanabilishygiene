import { describe, expect, it } from 'vitest';
import { buildFontCss, parseFontFile } from '@/server/fonts';

describe('parseFontFile', () => {
  it.each([
    ['RelativePro-Book.woff2', 400, 'normal'],
    ['RelativePro-BookItalic.woff2', 400, 'italic'],
    ['RelativePro-Medium.woff2', 500, 'normal'],
    ['relative-pro-semibold-italic.woff2', 600, 'italic'],
    ['RelativePro-Bold.woff2', 700, 'normal'],
    ['RelativePro-Black.woff2', 900, 'normal'],
    ['RelativePro-ExtraLight.woff2', 200, 'normal'],
    ['RelativePro.woff2', 400, 'normal'],
  ])('%s → %i %s', (file, weight, style) => {
    expect(parseFontFile(file)).toEqual({ file, weight, style });
  });

  it('игнорирует не-woff2 и моноширинные', () => {
    expect(parseFontFile('RelativePro-Book.otf')).toBeNull();
    expect(parseFontFile('RelativeMono-Book.woff2')).toBeNull();
  });

  it('строит @font-face с семейством Relative Pro', () => {
    const css = buildFontCss([{ file: 'RelativePro-Book.woff2', weight: 400, style: 'normal' }]);
    expect(css).toContain("font-family: 'Relative Pro'");
    expect(css).toContain("url('/fonts/RelativePro-Book.woff2')");
  });
});
