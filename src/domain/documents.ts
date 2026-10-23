import type { BrushMapContent } from '@/schemas/brushMap';
import type { FilledDocument, TemplateStructure } from '@/schemas/template';

/* Чистые функции создания документов: общие для сервера и прототипа без сервера. */

export function fillFromTemplate(templateId: string, version: number, title: string, structure: TemplateStructure): FilledDocument {
  return {
    schema: 1,
    templateId,
    templateVersion: version,
    title,
    sections: structure.sections.map((section) => ({
      ...section,
      enabled: true,
      items: section.items.map((item) => ({ ...item, enabled: true, selected: [], value: '' })),
    })),
  };
}

/** Новая карта на основе прошлой: формула и размеры сохраняются, отметки осмотра сбрасываются. */
export function carryOverBrushMap(previous: BrushMapContent): BrushMapContent {
  const elements = Object.fromEntries(
    Object.entries(previous.elements).map(([key, data]) => [key, { ...data, bleeding: null }]),
  );
  return { ...previous, elements };
}
