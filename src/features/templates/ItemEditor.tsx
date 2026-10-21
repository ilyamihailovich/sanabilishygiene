'use client';

import { ui } from '@/content/ui.ru';
import { lintPatientText } from '@/content/styleRules';
import { PRODUCT_CATEGORIES, TIMES_OF_DAY, productCategoryLabels, timeOfDayLabels, type TemplateItem } from '@/schemas/template';
import { ToggleChip } from '@/ui/Chip';
import { Button } from '@/ui/Button';
import { IconPlus, IconTrash } from '@/ui/icons';
import { newId } from './items';
import s from './templates.module.css';

interface Props<T extends TemplateItem> {
  item: T;
  onChange: (item: T) => void;
  /** Режим документа: значения выбора и ввода; в режиме шаблона редактируются формулировки. */
  mode: 'template' | 'document';
  selected?: string[];
  value?: string;
  onSelected?: (ids: string[]) => void;
  onValue?: (v: string) => void;
}

function Lint({ texts }: { texts: string[] }) {
  const issues = texts.flatMap(lintPatientText);
  if (!issues.length) return null;
  return (
    <span className={s.lint}>
      {[...new Set(issues.map((i) => `${i.message}: «${i.match}»`))].join('; ')}
    </span>
  );
}

function Area({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string }) {
  return (
    <textarea
      className={s.inline}
      aria-label={label}
      rows={Math.min(8, Math.max(1, Math.ceil(value.length / 70)))}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Line({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string }) {
  return <input className={s.inline} aria-label={label} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

/** Редактирование пункта: формулировки (шаблон и документ) и значения выбора и ввода (документ). */
export function ItemEditor<T extends TemplateItem>({ item, onChange, mode, selected = [], value = '', onSelected, onValue }: Props<T>) {
  const set = (patch: Partial<TemplateItem>) => onChange({ ...item, ...patch } as T);
  switch (item.type) {
    case 'text':
      return (
        <>
          <Area label={ui.templates.itemTypes.text} value={item.text} onChange={(v) => set({ text: v })} placeholder="Текст пункта" />
          <Lint texts={[item.text]} />
        </>
      );
    case 'warning':
      return (
        <div className={s.warning}>
          <Line label="Заголовок" value={item.title} onChange={(v) => set({ title: v })} />
          <Area label={ui.templates.itemTypes.warning} value={item.text} onChange={(v) => set({ text: v })} placeholder="Текст предупреждения" />
          <Lint texts={[item.title, item.text]} />
        </div>
      );
    case 'product':
      return (
        <>
          <div className={s.fields}>
            <select className={s.inline} aria-label="Категория" value={item.category} onChange={(e) => set({ category: e.target.value as (typeof PRODUCT_CATEGORIES)[number] })}>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {productCategoryLabels[c]}
                </option>
              ))}
            </select>
            <Line label="Название" value={item.name} onChange={(v) => set({ name: v })} placeholder="Название средства" />
            {item.prescription ? (
              <span className={s.kind}>Способ применения: по назначению врача</span>
            ) : (
              <>
                <Line label="Способ применения" value={item.usage} onChange={(v) => set({ usage: v })} placeholder="Способ применения" />
                <Line label="Частота" value={item.frequency} onChange={(v) => set({ frequency: v })} placeholder="Частота" />
                <Line label="Длительность" value={item.duration} onChange={(v) => set({ duration: v })} placeholder="Длительность" />
              </>
            )}
          </div>
          <div className={s.chips}>
            {TIMES_OF_DAY.map((t) => (
              <ToggleChip
                key={t}
                pressed={item.timeOfDay.includes(t)}
                onPressedChange={(p) => set({ timeOfDay: p ? [...item.timeOfDay, t] : item.timeOfDay.filter((x) => x !== t) })}
              >
                {timeOfDayLabels[t]}
              </ToggleChip>
            ))}
            {mode === 'template' && (
              <ToggleChip pressed={item.prescription} onPressedChange={(p) => set({ prescription: p })}>
                Препарат
              </ToggleChip>
            )}
          </div>
          <Lint texts={[item.name, item.usage, item.frequency, item.duration]} />
        </>
      );
    case 'choice':
      return (
        <>
          {mode === 'template' ? (
            <>
              <Line label="Вопрос" value={item.prompt} onChange={(v) => set({ prompt: v })} placeholder="Формулировка" />
              {item.options.map((o, i) => (
                <div key={o.id} style={{ display: 'flex', gap: 8 }}>
                  <Line
                    label={`Вариант ${i + 1}`}
                    value={o.label}
                    onChange={(v) => set({ options: item.options.map((x) => (x.id === o.id ? { ...x, label: v } : x)) })}
                    placeholder={`Вариант ${i + 1}`}
                  />
                  <Button variant="ghost" size="sm" aria-label="Удалить вариант" onClick={() => set({ options: item.options.filter((x) => x.id !== o.id) })}>
                    <IconTrash size={16} />
                  </Button>
                </div>
              ))}
              <div className={s.chips}>
                <Button variant="secondary" size="sm" leading={<IconPlus size={16} />} onClick={() => set({ options: [...item.options, { id: newId('o'), label: '' }] })}>
                  Вариант
                </Button>
                <ToggleChip pressed={item.multiple} onPressedChange={(p) => set({ multiple: p })}>
                  Несколько вариантов
                </ToggleChip>
              </div>
            </>
          ) : (
            <>
              <span className={s.text}>{item.prompt}</span>
              <div className={s.chips}>
                {item.options.map((o) => (
                  <ToggleChip
                    key={o.id}
                    pressed={selected.includes(o.id)}
                    onPressedChange={(p) =>
                      onSelected?.(p ? (item.multiple ? [...selected, o.id] : [o.id]) : selected.filter((x) => x !== o.id))
                    }
                  >
                    {o.label || '—'}
                  </ToggleChip>
                ))}
              </div>
            </>
          )}
          <Lint texts={[item.prompt, ...item.options.map((o) => o.label)]} />
        </>
      );
    case 'input':
      return mode === 'template' ? (
        <div className={s.fields}>
          <Line label="Подпись поля" value={item.label} onChange={(v) => set({ label: v })} placeholder="Например, Срок" />
          <select className={s.inline} aria-label="Тип поля" value={item.inputKind} onChange={(e) => set({ inputKind: e.target.value as 'text' | 'date' | 'number' })}>
            <option value="text">Текст</option>
            <option value="date">Дата</option>
            <option value="number">Число</option>
          </select>
          <Line label="Единицы" value={item.suffix} onChange={(v) => set({ suffix: v })} placeholder="Например, дней" />
        </div>
      ) : (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className={s.kind}>
            {item.label}
            {item.required ? ' · обязательно' : ''}
          </span>
          <input
            className={s.inline}
            type={item.inputKind}
            value={value}
            onChange={(e) => onValue?.(e.target.value)}
            placeholder={item.suffix || undefined}
          />
        </label>
      );
    case 'brushes':
      return null;
  }
}
