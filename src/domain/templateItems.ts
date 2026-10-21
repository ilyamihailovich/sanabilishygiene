import { hasTodo } from '@/content/styleRules';
import type { FilledItem } from '@/schemas/template';

/** Текстовые поля пункта, которые видит пациент. */
export function itemTexts(item: FilledItem): string[] {
  switch (item.type) {
    case 'text':
      return [item.text];
    case 'product':
      return [item.name, item.usage, item.frequency, item.duration];
    case 'choice':
      return [item.prompt, ...item.options.filter((o) => item.selected.includes(o.id)).map((o) => o.label)];
    case 'input':
      return [item.label, item.value];
    case 'warning':
      return [item.title, item.text];
    case 'brushes':
      return [];
  }
}

/** Почему пункт нельзя выдать пациенту; null — пункт готов или выключен. */
export function itemProblems(item: FilledItem): string | null {
  if (!item.enabled) return null;
  if (itemTexts(item).some(hasTodo)) return 'пункт с TODO';
  if (item.type === 'text' && !item.text.trim()) return 'пустой текст';
  if (item.type === 'product' && !item.name.trim()) return 'не указано средство';
  if (item.type === 'input' && item.required && !item.value.trim()) return `не заполнено поле «${item.label}»`;
  if (item.type === 'choice' && item.required && item.selected.length === 0) return 'не выбран вариант';
  if (item.type === 'choice' && item.selected.length === 0 && !item.required) return 'не выбран вариант';
  return null;
}
