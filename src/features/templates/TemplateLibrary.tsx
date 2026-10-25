'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ui } from '@/content/ui.ru';
import { fillFromTemplate } from '@/domain/documents';
import type { TemplateStructure } from '@/schemas/template';
import { DocumentBody } from '../patient-card/blocks';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Select, TextField } from '@/ui/Field';
import { Heading } from '@/ui/Heading';
import { IconPlus } from '@/ui/icons';
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
          {rows.map((t) => (
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
              <div>
                <span className={s.kindChip}>{ui.templates.kinds[t.kind]}</span>
                <p className={s.pickTitle} style={{ marginTop: 'var(--space-3)' }}>
                  {t.title}
                </p>
              </div>
              <div className={s.pickFoot}>
                <span>
                  {t.version ? `${ui.templates.version} ${t.version}` : ''} · {formatDate(t.updatedAt)}
                  {t.hasDraft ? ' · черновик' : ''}
                </span>
                <span className={s.docActions} onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => copy(t.id)}>
                    {ui.templates.copy}
                  </Button>
                  {(t.personal || canLibrary) && (
                    <Link href={`/templates/${t.id}`}>
                      <Button variant="secondary" size="sm" tabIndex={-1}>
                        {ui.templates.edit}
                      </Button>
                    </Link>
                  )}
                </span>
              </div>
            </div>
          ))}
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
