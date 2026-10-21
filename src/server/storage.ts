import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from './env';

/** Файлы приложения на томе DATA_DIR: рендеры, PDF, фото каталога. */
export function dataPath(...parts: string[]): string {
  const root = path.resolve(/*turbopackIgnore: true*/ env().DATA_DIR);
  const full = path.resolve(root, ...parts);
  if (!full.startsWith(root + path.sep)) throw new Error('Недопустимый путь');
  return full;
}

export async function writeData(relative: string, data: Buffer | Uint8Array): Promise<void> {
  const full = dataPath(relative);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

export async function readData(relative: string): Promise<Buffer | null> {
  try {
    return await readFile(dataPath(relative));
  } catch {
    return null;
  }
}
