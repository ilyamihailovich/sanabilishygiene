'use client';

import { useMemo, useState } from 'react';
import { ui } from '@/content/ui.ru';
import { countLabel } from '@/content/plural';
import { summarizeSizes } from '@/domain/brushMap';
import { itemProblems } from '@/domain/templateItems';
import type { BrushMapContent } from '@/schemas/brushMap';
import { productCategoryLabels, timeOfDayLabels, type FilledDocument, type FilledItem, type TemplateItem } from '@/schemas/template';
import type { CatalogItem } from '@/server/services/catalog';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CounterChip } from '@/ui/Chip';
import { Dialog } from '@/ui/Dialog';
import { Switch, TextField } from '@/ui/Field';
import { IconCheck, IconPlus, IconTrash } from '@/ui/icons';
import { Notice } from '@/ui/Notice';
import { useToast } from '@/ui/Toast';
import { SaveIndicator } from '../visit/SaveIndicator';
import { useAutosave } from '../visit/useAutosave';
import { ItemEditor } from './ItemEditor';
import { ITEM_TYPES, newId, newItem } from './items';
import s from './templates.module.css';

interface Props {
  documentId: string;
  rev: number;
  initial: FilledDocument;
  catalog: CatalogItem[];
  brushMap: BrushMapContent | null;
  canSaveTemplate: boolean;
  onRemove: () => void;
}

type Section = FilledDocument['sections'][number];

/** Заполнение документа по шаблону: все пункты списком, ненужные снимаются одним касанием. */
export function TemplateDocEditor({ documentId, rev, initial, catalog, brushMap, canSaveTemplate, onRemove }: Props) {
  const toast = useToast();
  const [doc, setDoc] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [library, setLibrary] = useState<{ sectionId: string; items: Array<{ id: string; title: string; payload: TemplateItem }> } | null>(null);
  const [saveTpl, setSaveTpl] = useState(false);
  const [tplTitle, setTplTitle] = useState(`${initial.title} (мой)`);
  const save = useAutosave(documentId, rev, doc);

  const problems = useMemo(
    () => doc.sections.filter((x) => x.enabled).flatMap((x) => x.items.map(itemProblems).filter(Boolean)).length,
    [doc],
  );

  const updateSection = (id: string, fn: (s: Section) => Section) =>
    setDoc((d) => ({ ...d, sections: d.sections.map((x) => (x.id === id ? fn(x) : x)) }));
  const updateItem = (sectionId: string, itemId: string, fn: (i: FilledItem) => FilledItem) =>
    updateSection(sectionId, (x) => ({ ...x, items: x.items.map((i) => (i.id === itemId ? fn(i) : i)) }));
  const addItem = (sectionId: string, item: TemplateItem) => {
    const filled = { ...item, id: newId(), enabled: true, selected: [], value: '' } as FilledItem;
    updateSection(sectionId, (x) => ({ ...x, items: [...x.items, filled] }));
    setEditing(filled.id);
  };

  const brushes = useMemo(() => {
    if (!brushMap) return [];
    const byId = new Map(catalog.map((c) => [c.id, c]));
    return summarizeSizes(brushMap).map((u) => {
      const c = u.catalogId ? byId.get(u.catalogId) : undefined;
      return { ref: u.ref, label: c?.label ?? u.freeText ?? '—', color: c?.colorHex ?? null, count: u.count };
    });
  }, [brushMap, catalog]);

  const openLibrary = async (sectionId: string) => {
    const items = await api.get<Array<{ id: string; title: string; payload: TemplateItem }>>('/api/v1/library-items');
    setLibrary({ sectionId, items });
  };

  const saveAsTemplate = async () => {
    try {
      await api.post(`/api/v1/documents/${documentId}/save-as-template`, { title: tplTitle });
      toast('Личный шаблон сохранён');
      setSaveTpl(false);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
    }
  };

  const preview = (item: FilledItem) => {
    switch (item.type) {
      case 'text':
        return <span className={`${s.text} ${item.text.includes('TODO') ? s.todo : ''}`}>{item.text || 'Пустой пункт'}</span>;
      case 'warning':
        return (
          <div className={s.warning}>
            <div className={s.warningTitle}>{item.title}</div>
            <div className={s.text}>{item.text || '—'}</div>
          </div>
        );
      case 'product':
        return (
          <span className={s.text}>
            <span className={s.kind}>{productCategoryLabels[item.category]}</span>
            <br />
            {item.name || 'Средство не указано'}
            {item.prescription
              ? ' · по назначению врача'
              : [item.usage, item.frequency, item.duration].filter(Boolean).map((x) => ` · ${x}`)}
            {item.timeOfDay.length > 0 && ` · ${item.timeOfDay.map((t) => timeOfDayLabels[t]).join(', ')}`}
          </span>
        );
      case 'brushes':
        return brushes.length ? (
          <div className={s.brushes}>
            {brushes.map((b) => (
              <span key={b.ref} className={s.brush}>
                <span className={s.dot} style={b.color ? { background: b.color } : { background: '#fff' }} />
                {b.label} · {countLabel(b.count, ui.map.interspaces)}
              </span>
            ))}
          </div>
        ) : (
          <span className={s.kind}>Ёршики подтянутся из карты ёршиков визита</span>
        );
      default:
        return null;
    }
  };

  return (
    <Card className={s.doc}>
      <div className={s.docHead}>
        <span className={s.docTitle}>{doc.title}</span>
        <div className={s.docActions}>
          {problems > 0 && <Notice short={`${problems}`}>{`${countLabel(problems, ['пункт', 'пункта', 'пунктов'])} требуют заполнения`}</Notice>}
          <SaveIndicator state={save} />
          {canSaveTemplate && (
            <Button variant="secondary" size="sm" onClick={() => setSaveTpl(true)}>
              {ui.templates.saveAsPersonal}
            </Button>
          )}
          <Button variant="ghost" size="sm" leading={<IconTrash size={18} />} onClick={onRemove}>
            {ui.visit.removeDocument}
          </Button>
        </div>
      </div>

      {doc.sections.map((section) => (
        <section key={section.id} className={`${s.section} ${section.enabled ? '' : s.sectionOff}`}>
          <div className={s.sectionHead}>
            <span className={s.sectionTitle}>{section.title}</span>
            <div className={s.docActions}>
              <CounterChip>{`${section.items.filter((i) => i.enabled).length} из ${section.items.length}`}</CounterChip>
              <Switch label={<span className="visually-hidden">Раздел «{section.title}»</span>} checked={section.enabled} onCheckedChange={(v) => updateSection(section.id, (x) => ({ ...x, enabled: v }))} />
            </div>
          </div>
          {section.enabled && (
            <>
              <ul className={s.items}>
                {section.items.map((item) => {
                  const problem = itemProblems(item);
                  const isEditing = editing === item.id;
                  const interactive = item.type === 'choice' || item.type === 'input';
                  return (
                    <li key={item.id} className={`${s.item} ${item.enabled ? '' : s.itemOff}`}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={item.enabled}
                        aria-label="Включить пункт в документ"
                        className={s.check}
                        onClick={() => updateItem(section.id, item.id, (i) => ({ ...i, enabled: !i.enabled }))}
                      >
                        <span className={s.box}>{item.enabled && <IconCheck size={16} />}</span>
                      </button>
                      <div className={s.body}>
                        {isEditing || interactive ? (
                          <ItemEditor
                            item={item}
                            mode={isEditing ? 'template' : 'document'}
                            selected={item.selected}
                            value={item.value}
                            onChange={(next) => updateItem(section.id, item.id, (i) => ({ ...i, ...next }) as FilledItem)}
                            onSelected={(ids) => updateItem(section.id, item.id, (i) => ({ ...i, selected: ids }))}
                            onValue={(v) => updateItem(section.id, item.id, (i) => ({ ...i, value: v }))}
                          />
                        ) : (
                          preview(item)
                        )}
                        {problem && item.enabled && <span className={s.lint}>{problem}</span>}
                      </div>
                      {item.type !== 'brushes' && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(isEditing ? null : item.id)}>
                          {isEditing ? 'Готово' : ui.common.edit}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className={s.addRow}>
                {ITEM_TYPES.filter((t) => t !== 'brushes').map((t) => (
                  <Button key={t} variant="secondary" size="sm" leading={<IconPlus size={16} />} onClick={() => addItem(section.id, newItem(t))}>
                    {ui.templates.itemTypes[t]}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" onClick={() => openLibrary(section.id)}>
                  {ui.templates.fromLibrary}
                </Button>
              </div>
            </>
          )}
        </section>
      ))}

      <Dialog open={library !== null} onClose={() => setLibrary(null)} title={ui.templates.fromLibrary} width={560}>
        {library?.items.length ? (
          <ul className={s.items}>
            {library.items.map((li) => (
              <li key={li.id} className={s.item} style={{ gridTemplateColumns: '1fr auto' }}>
                <span>
                  <span className={s.kind}>{ui.templates.itemTypes[li.payload.type]}</span>
                  <br />
                  {li.title}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    addItem(library.sectionId, li.payload);
                    setLibrary(null);
                  }}
                >
                  {ui.common.add}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.kind}>Библиотека пунктов пуста. Пункты добавляются в редакторе шаблонов.</p>
        )}
      </Dialog>

      <Dialog
        open={saveTpl}
        onClose={() => setSaveTpl(false)}
        title={ui.templates.saveAsPersonal}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSaveTpl(false)}>
              {ui.common.cancel}
            </Button>
            <Button onClick={saveAsTemplate}>{ui.common.save}</Button>
          </>
        }
      >
        <TextField label="Название шаблона" value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} />
      </Dialog>
    </Card>
  );
}
