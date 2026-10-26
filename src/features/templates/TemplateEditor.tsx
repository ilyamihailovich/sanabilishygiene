'use client';

import { Reorder, useDragControls } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ui } from '@/content/ui.ru';
import type { TemplateItem, TemplateSection, TemplateStructure } from '@/schemas/template';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CounterChip, ToggleChip } from '@/ui/Chip';
import { IconButton } from '@/ui/IconButton';
import { IconChevronDown, IconChevronLeft, IconChevronUp, IconGrip, IconPlus, IconTrash } from '@/ui/icons';
import { useToast } from '@/ui/Toast';
import { ItemEditor } from './ItemEditor';
import { ITEM_TYPES, newId, newItem } from './items';
import s from './templates.module.css';

interface Props {
  id: string;
  title: string;
  kind: 'HYGIENE_PLAN' | 'AFTERCARE';
  archived: boolean;
  library: boolean;
  version: number;
  hasDraft: boolean;
  structure: TemplateStructure;
}

function move<T>(list: T[], index: number, delta: number): T[] {
  const next = [...list];
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

function DragRow<T>({ value, children, label, onUp, onDown }: { value: T; children: (handle: ReactNode) => ReactNode; label: string; onUp: () => void; onDown: () => void }) {
  const controls = useDragControls();
  const handle = (
    <span className={s.docActions}>
      <span
        role="button"
        aria-label={`Перетащить: ${label}`}
        tabIndex={-1}
        onPointerDown={(e) => controls.start(e)}
        style={{ cursor: 'grab', display: 'grid', placeItems: 'center', width: 32, height: 44, touchAction: 'none', color: 'var(--color-text-secondary)' }}
      >
        <IconGrip size={18} />
      </span>
      <IconButton label="Выше" icon={<IconChevronUp size={16} />} variant="ghost" size={36} onClick={onUp} />
      <IconButton label="Ниже" icon={<IconChevronDown size={16} />} variant="ghost" size={36} onClick={onDown} />
    </span>
  );
  return (
    <Reorder.Item value={value} dragListener={false} dragControls={controls} as="li" style={{ listStyle: 'none', position: 'relative' }}>
      {children(handle)}
    </Reorder.Item>
  );
}

/** Редактор шаблона: разделы и пункты, порядок перетаскиванием, черновик и публикация версии. */
export function TemplateEditor(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState(props.title);
  const [sections, setSections] = useState<TemplateSection[]>(props.structure.sections);
  const [dirty, setDirty] = useState(props.hasDraft);
  const [lintCount, setLintCount] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.put<{ lint: Array<{ issues: unknown[] }> }>(`/api/v1/templates/${props.id}/draft`, {
          title,
          structure: { schema: 1, sections },
        });
        setDirty(true);
        setLintCount(res.lint.reduce((n, x) => n + x.issues.length, 0));
      } catch (err) {
        toast(err instanceof ApiError ? err.message : 'Ошибка сохранения', 'error');
      }
    }, 700);
    return () => clearTimeout(t);
  }, [title, sections, props.id, toast]);

  const updateSection = (id: string, fn: (x: TemplateSection) => TemplateSection) =>
    setSections((list) => list.map((x) => (x.id === id ? fn(x) : x)));

  const publish = async () => {
    try {
      const r = await api.post<{ version: number }>(`/api/v1/templates/${props.id}/publish`);
      toast(`${ui.templates.published}: ${ui.templates.version.toLowerCase()} ${r.version}`);
      setDirty(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
    }
  };

  const archive = async () => {
    await api.post(`/api/v1/templates/${props.id}/archive`, { archived: !props.archived });
    router.push('/templates');
  };

  const saveToLibrary = async (item: TemplateItem) => {
    const name = item.type === 'text' ? item.text.slice(0, 60) : item.type === 'product' ? item.name : item.type === 'warning' ? item.title : item.type === 'choice' ? item.prompt : item.type === 'input' ? item.label : 'Ёршики';
    try {
      await api.post('/api/v1/library-items', { title: name || ui.templates.itemTypes[item.type], item, library: props.library });
      toast('Пункт добавлен в библиотеку');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
    }
  };

  return (
    <div className={s.doc} style={{ gap: 'var(--space-6)' }}>
      {/* выход из редактора к списку шаблонов: черновик уже сохранён */}
      <Link href="/templates" className={s.back}>
        <IconChevronLeft size={18} /> Шаблоны
      </Link>
      <div className={s.docHead}>
        <div className={s.doc} style={{ gap: 'var(--space-2)', flex: '1 1 420px' }}>
          <div className={s.docActions}>
            <CounterChip>{ui.templates.kinds[props.kind]}</CounterChip>
            <CounterChip>{props.library ? ui.templates.library : ui.templates.personal}</CounterChip>
            <CounterChip>{`${ui.templates.version} ${props.version}`}</CounterChip>
            {dirty && <CounterChip tone="surface">{ui.templates.draftChanges}</CounterChip>}
          </div>
          <input
            className={s.inline}
            style={{ fontSize: 'var(--fs-title2)', fontWeight: 600, letterSpacing: '-0.02em', background: 'transparent', paddingLeft: 0 }}
            aria-label="Название шаблона"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {lintCount > 0 && <span className={s.lint}>{ui.templates.lint}: замечаний {lintCount}. Они подсвечены у пунктов.</span>}
        </div>
        <div className={s.docActions}>
          <Button variant="ghost" onClick={archive}>
            {props.archived ? ui.common.restore : ui.common.archive}
          </Button>
          <Button disabled={!dirty} onClick={publish}>
            {ui.templates.publish}
          </Button>
        </div>
      </div>
      <p className={s.kind}>Изменения сохраняются в черновик. Выданные документы и уже заполненные визиты не меняются: в них сохранена своя версия шаблона.</p>

      <Reorder.Group axis="y" values={sections} onReorder={setSections} as="ul" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', margin: 0, padding: 0 }}>
        {sections.map((section, si) => (
          <DragRow
            key={section.id}
            value={section}
            label={section.title}
            onUp={() => setSections((l) => move(l, si, -1))}
            onDown={() => setSections((l) => move(l, si, 1))}
          >
            {(handle) => (
              <Card className={s.section}>
                <div className={s.sectionHead}>
                  <input
                    className={s.inline}
                    style={{ fontSize: 'var(--fs-callout)', fontWeight: 600, background: 'transparent' }}
                    aria-label={ui.templates.sectionTitle}
                    value={section.title}
                    onChange={(e) => updateSection(section.id, (x) => ({ ...x, title: e.target.value }))}
                  />
                  <span className={s.docActions}>
                    {handle}
                    <IconButton label="Удалить раздел" icon={<IconTrash size={16} />} variant="ghost" size={36} onClick={() => setSections((l) => l.filter((x) => x.id !== section.id))} />
                  </span>
                </div>
                <Reorder.Group
                  axis="y"
                  values={section.items}
                  onReorder={(items) => updateSection(section.id, (x) => ({ ...x, items }))}
                  as="ul"
                  className={s.items}
                >
                  {section.items.map((item, ii) => (
                    <DragRow
                      key={item.id}
                      value={item}
                      label={ui.templates.itemTypes[item.type]}
                      onUp={() => updateSection(section.id, (x) => ({ ...x, items: move(x.items, ii, -1) }))}
                      onDown={() => updateSection(section.id, (x) => ({ ...x, items: move(x.items, ii, 1) }))}
                    >
                      {(handle) => (
                        <div className={s.item} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', background: 'var(--color-surface)' }}>
                          <div className={s.body}>
                            <span className={s.kind}>{ui.templates.itemTypes[item.type]}</span>
                            {item.type === 'brushes' ? (
                              <span className={s.text}>Размеры ёршиков подтягиваются из карты визита автоматически</span>
                            ) : (
                              <ItemEditor
                                item={item}
                                mode="template"
                                onChange={(next) => updateSection(section.id, (x) => ({ ...x, items: x.items.map((i) => (i.id === item.id ? next : i)) }))}
                              />
                            )}
                            <div className={s.chips}>
                              {(item.type === 'input' || item.type === 'choice') && (
                                <ToggleChip
                                  pressed={item.required}
                                  onPressedChange={(p) => updateSection(section.id, (x) => ({ ...x, items: x.items.map((i) => (i.id === item.id ? { ...i, required: p } : i)) }))}
                                >
                                  {ui.templates.required}
                                </ToggleChip>
                              )}
                              {item.type !== 'brushes' && (
                                <Button variant="ghost" size="sm" onClick={() => saveToLibrary(item)}>
                                  В библиотеку пунктов
                                </Button>
                              )}
                            </div>
                          </div>
                          <span className={s.docActions} style={{ alignSelf: 'start' }}>
                            {handle}
                            <IconButton
                              label="Удалить пункт"
                              icon={<IconTrash size={16} />}
                              variant="ghost"
                              size={36}
                              onClick={() => updateSection(section.id, (x) => ({ ...x, items: x.items.filter((i) => i.id !== item.id) }))}
                            />
                          </span>
                        </div>
                      )}
                    </DragRow>
                  ))}
                </Reorder.Group>
                <div className={s.addRow}>
                  {ITEM_TYPES.filter((t) => t !== 'brushes' || props.kind === 'HYGIENE_PLAN').map((t) => (
                    <Button key={t} variant="secondary" size="sm" leading={<IconPlus size={16} />} onClick={() => updateSection(section.id, (x) => ({ ...x, items: [...x.items, newItem(t)] }))}>
                      {ui.templates.itemTypes[t]}
                    </Button>
                  ))}
                </div>
              </Card>
            )}
          </DragRow>
        ))}
      </Reorder.Group>
      <div>
        <Button variant="secondary" leading={<IconPlus size={18} />} onClick={() => setSections((l) => [...l, { id: newId('s'), title: 'Новый раздел', items: [] }])}>
          {ui.templates.addSection}
        </Button>
      </div>
      <p className={s.kind}>Текст для пациента: пишите «Вы, Вас, Вам, Ваш» с заглавной, «гигиена», «десна», «имплантат», «ортодонтическая система». Без восклицаний, обещаний и сравнений: линтер подсветит нарушения.</p>
    </div>
  );
}
