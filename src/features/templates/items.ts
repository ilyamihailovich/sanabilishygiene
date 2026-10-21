import type { TemplateItem } from '@/schemas/template';

export const newId = (prefix = 'i') => `${prefix}${Math.random().toString(36).slice(2, 10)}`;

export function newItem(type: TemplateItem['type']): TemplateItem {
  const base = { id: newId(), required: false };
  switch (type) {
    case 'text':
      return { ...base, type, text: '' };
    case 'product':
      return { ...base, type, category: 'OTHER', name: '', usage: '', frequency: '', duration: '', timeOfDay: [], prescription: false };
    case 'choice':
      return { ...base, type, prompt: '', multiple: false, options: [{ id: newId('o'), label: '' }] };
    case 'input':
      return { ...base, type, label: '', inputKind: 'text', suffix: '' };
    case 'warning':
      return { ...base, type, title: 'Когда обратиться в клинику', text: '' };
    case 'brushes':
      return { ...base, type };
  }
}

export const ITEM_TYPES: TemplateItem['type'][] = ['text', 'product', 'choice', 'input', 'warning', 'brushes'];
