'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { plural } from '@/content/plural';
import { ui } from '@/content/ui.ru';
import { fillFromTemplate } from '@/domain/documents';
import type { TemplateStructure } from '@/schemas/template';
import { DocumentBody } from '../patient-card/blocks';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Select, TextField } from '@/ui/Field';
import { Heading } from '@/ui/Heading';
import { IconDoc, IconPlus } from '@/ui/icons';
import { Segmented } from '@/ui/Segmented';
import { useToast } from '@/ui/Toast';
import { formatDate } from '@/ui/format';
import { useCan } from '../shell/StaffContext';
import s from './templates.module.css';

interface Row {
  id: string;
  kind: 'HYGIENE_PLAN' | 'AFTERCARE';
  title: string;
  personal: boolean;
  archived: boolean;
  version: number | null;
  updatedAt: string;
  hasDraft: boolean;
  /** Опубликованный текст для просмотра; null — шаблон ещё не опубликован. */
  structure?: TemplateStructure | null;
}

type Tab = 'library' | 'personal' | 'archived';

/** Начало текста шаблона для карточки: первый текстовый пункт или предупреждение. */
function excerpt(structure: TemplateStructure | null | undefined): string | null {
  for (const sec of structure?.sections ?? []) {
    for (const item of sec.items) {
      if (item.type === 'text' && item.text.trim()) return item.text.trim();
      if (item.type === 'warning' && item.text.trim()) return item.text.trim();
    }
  }
  return null;
}

export function TemplateLibrary({ templates }: { templates: Row[] }) {
  const router = useRouter();
  const toast = useToast();
  const canLibrary = useCan('template.library');
  const canPersonal = useCan('template.personal');
  const [tab, setTab] = useState<Tab>('library');
  const tabsRef = useRef<HTMLDivElement>(null);
  // выбранный раздел прокручивается в видимую часть полосы
  useEffect(() => {
    const box = tabsRef.current;
    const el = box?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!box || !el) return;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    box.scrollTo({ left: box.scrollLeft + r.left - b.left - (b.width - r.width) / 2, behavior: 'smooth' });
  }, [tab]);
  const [create, setCreate] = useState(false);
  const [preview, setPreview] = useState<Row | null>(null);
  const editable = (t: Row) => t.personal || canLibrary;
  // карточка открывает редактор, если шаблон можно править, иначе — просмотр текста
  const open = (t: Row) => (editable(t) ? router.push(`/templates/${t.id}`) : setPreview(t));
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'HYGIENE_PLAN' | 'AFTERCARE'>('AFTERCARE');

  const rows = templates.filter((t) =>
    tab === 'archived' ? t.archived : !t.archived && (tab === 'personal' ? t.personal : !t.personal),
  );

  const submit = async () => {
    try {
      const t = await api.post<{ id: string }>('/api/v1/templates', { title, kind, library: tab !== 'personal' && canLibrary });
      router.push(`/templates/${t.id}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
    }
  };

  const copy = async (id: string) => {
    const t = await api.post<{ id: string }>(`/api/v1/templates/${id}/copy`, { library: canLibrary && tab === 'library' });
    router.push(`/templates/${t.id}`);
  };

  return (
    <div className={s.doc} style={{ gap: 'var(--space-6)' }}>
      <div className={s.docHead}>
        <Heading as="h1" level="title1">
          {ui.templates.title}
        </Heading>
        {(canLibrary || canPersonal) && (
          <Button leading={<IconPlus size={18} />} onClick={() => setCreate(true)}>
            {ui.templates.create}
          </Button>
        )}
      </div>
      {/* на узком экране разделы прокручиваются вбок */}
      <div ref={tabsRef} className={s.tabsScroll}>
      <Segmented
        label="Раздел"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'library', label: ui.templates.library },
          { value: 'personal', label: ui.templates.personal },
          { value: 'archived', label: ui.templates.archived },
        ]}
      />
      </div>
      {rows.length ? (
        <div className={s.picker}>
          {rows.map((t) => {
            const sections = t.structure?.sections ?? [];
            return (
              <div
                key={t.id}
                className={s.pickCard}
                role="button"
                tabIndex={0}
                aria-label={`${editable(t) ? ui.templates.edit : 'Открыть'}: ${t.title}`}
                onClick={() => open(t)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    open(t);
                  }
                }}
              >
                <div className={s.pickTop}>
                  <span className={s.kindIcon} data-kind={t.kind} aria-hidden="true">
                    <IconDoc size={20} />
                  </span>
                  <span className={s.kindLabel}>{ui.templates.kinds[t.kind]}</span>
                  {t.hasDraft && <span className={s.draftBadge}>черновик</span>}
                </div>
                <p className={s.pickTitle}>{t.title}</p>
                {excerpt(t.structure) && <p className={s.excerpt}>{excerpt(t.structure)}</p>}
                {sections.length > 0 && (
                  <ul className={s.sectionChips}>
                    {sections.slice(0, 4).map((sec) => (
                      <li key={sec.id}>{sec.title}</li>
                    ))}
                    {sections.length > 4 && <li>+{sections.length - 4}</li>}
                  </ul>
                )}
                <div className={s.pickFoot}>
                  <span>
                    {sections.length ? `${sections.length} ${plural(sections.length, ['раздел', 'раздела', 'разделов'])} · ` : ''}
                    {formatDate(t.updatedAt)}
                  </span>
                  <span className={s.docActions} onClick={(e) => e.stopPropagation()}>
                    {canPersonal && (
                      <Button variant="ghost" size="sm" onClick={() => copy(t.id)}>
                        Копия
                      </Button>
                    )}
                    {editable(t) ? (
                      <Link href={`/templates/${t.id}`}>
                        <Button variant="secondary" size="sm" tabIndex={-1}>
                          {ui.templates.edit}
                        </Button>
                      </Link>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => setPreview(t)}>
                        Открыть
                      </Button>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={s.kind}>{ui.templates.empty}</p>
      )}
      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ''}
        actions={
          preview && canPersonal ? (
            <Button
              onClick={() => {
                const id = preview.id;
                setPreview(null);
                void copy(id);
              }}
            >
              {ui.templates.copy}
            </Button>
          ) : undefined
        }
      >
        {preview?.structure ? (
          <div className={s.preview}>
            <DocumentBody doc={fillFromTemplate(preview.id, preview.version ?? 0, preview.title, preview.structure)} brushes={[]} />
          </div>
        ) : (
          <p className={s.kind}>Шаблон ещё не опубликован.</p>
        )}
      </Dialog>
      <Dialog
        open={create}
        onClose={() => setCreate(false)}
        title={ui.templates.create}
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreate(false)}>
              {ui.common.cancel}
            </Button>
            <Button disabled={!title.trim()} onClick={submit}>
              {ui.common.add}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <TextField label="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select
            label="Тип"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'HYGIENE_PLAN' | 'AFTERCARE')}
            options={[
              { value: 'AFTERCARE', label: ui.templates.kinds.AFTERCARE },
              { value: 'HYGIENE_PLAN', label: ui.templates.kinds.HYGIENE_PLAN },
            ]}
          />
        </div>
      </Dialog>
    </div>
  );
}
