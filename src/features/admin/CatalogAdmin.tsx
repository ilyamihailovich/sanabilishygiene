'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ui } from '@/content/ui.ru';
import type { CatalogItem } from '@/server/services/catalog';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { CounterChip, ToggleChip } from '@/ui/Chip';
import { Dialog } from '@/ui/Dialog';
import { TextField } from '@/ui/Field';
import { Heading } from '@/ui/Heading';
import { IconPlus } from '@/ui/icons';
import { Notice } from '@/ui/Notice';
import { useToast } from '@/ui/Toast';
import s from './admin.module.css';

type Form = Omit<CatalogItem, 'id' | 'hasPhoto' | 'archived'> & { id?: string };

const empty: Form = { brand: 'Curaprox', line: '', label: '', isoSize: null, passageMm: '', bristleDiameterMm: null, colorHex: '#9a9aa0', verified: false, sortOrder: 0 };

/** Каталог ёршиков: позиции без флага «проверено» не попадают в документы пациента. */
export function CatalogAdmin({ items }: { items: CatalogItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const fail = (err: unknown) => toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');

  const save = async () => {
    if (!form) return;
    const body = {
      brand: form.brand,
      line: form.line,
      label: form.label,
      isoSize: form.isoSize || null,
      passageMm: Number(String(form.passageMm).replace(',', '.')),
      bristleDiameterMm: form.bristleDiameterMm ? Number(String(form.bristleDiameterMm).replace(',', '.')) : null,
      colorHex: form.colorHex,
      verified: form.verified,
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      if (form.id) await api.patch(`/api/v1/admin/brushes/${form.id}`, body);
      else await api.post('/api/v1/admin/brushes', body);
      setForm(null);
      router.refresh();
    } catch (err) {
      fail(err);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    await api.patch(`/api/v1/admin/brushes/${id}`, body).catch(fail);
    router.refresh();
  };

  const upload = async (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    await api.post(`/api/v1/admin/brushes/${id}/photo`, fd).catch(fail);
    router.refresh();
  };

  const unverified = items.some((i) => !i.verified && !i.archived);

  return (
    <div className={s.page}>
      <div className={s.head}>
        <Heading as="h1" level="title1" rest="размеры, цвета, проверка">
          {ui.admin.catalog}
        </Heading>
        <div className={s.row}>
          {unverified && <Notice>{ui.catalog.notVerified}</Notice>}
          <Button leading={<IconPlus size={18} />} onClick={() => setForm({ ...empty, sortOrder: items.length + 1 })}>
            {ui.common.add}
          </Button>
        </div>
      </div>
      <p className={s.muted}>
        Данные о размерах и цветах вносит клиника по упаковкам производителя. Позиция попадает в документ пациента только с отметкой «{ui.admin.verified}».
      </p>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>{ui.admin.order}</th>
              <th>{ui.admin.color}</th>
              <th>{ui.admin.sizeLabel}</th>
              <th>{ui.admin.brand}</th>
              <th>{ui.admin.iso}</th>
              <th>{ui.admin.passage}</th>
              <th>{ui.admin.bristle}</th>
              <th>{ui.admin.photo}</th>
              <th>{ui.admin.verified}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} style={i.archived ? { opacity: 0.45 } : undefined}>
                <td>{i.sortOrder}</td>
                <td>
                  <span className={s.swatch} style={{ background: i.colorHex }} /> <span className={s.muted}>{i.colorHex}</span>
                </td>
                <td className={s.cellMain}>{i.label}</td>
                <td>
                  {i.brand}
                  <div className={s.muted}>{i.line}</div>
                </td>
                <td>{i.isoSize ?? '—'}</td>
                <td>{i.passageMm.replace('.', ',')}</td>
                <td>{i.bristleDiameterMm?.replace('.', ',') ?? '—'}</td>
                <td>
                  {i.hasPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/v1/files/catalog/${i.id}`} alt={`Упаковка ${i.label}`} width={40} height={40} style={{ objectFit: 'cover', borderRadius: 8 }} />
                  ) : (
                    <label className={s.muted} style={{ cursor: 'pointer' }}>
                      Загрузить
                      <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(i.id, e.target.files[0])} />
                    </label>
                  )}
                </td>
                <td>
                  <ToggleChip pressed={i.verified} onPressedChange={(v) => patch(i.id, { verified: v })}>
                    {i.verified ? ui.admin.verified : 'Нет'}
                  </ToggleChip>
                </td>
                <td>
                  <div className={s.row} style={{ justifyContent: 'flex-end' }}>
                    <Button variant="ghost" size="sm" onClick={() => setForm({ ...i })}>
                      {ui.common.edit}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => patch(i.id, { archived: !i.archived })}>
                      {i.archived ? ui.common.restore : ui.common.archive}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? ui.common.edit : 'Новая позиция'}
        width={600}
        actions={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>
              {ui.common.cancel}
            </Button>
            <Button onClick={save}>{ui.common.save}</Button>
          </>
        }
      >
        {form && (
          <div className={s.form}>
            <div className={s.grid2}>
              <TextField label={ui.admin.brand} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              <TextField label={ui.admin.line} value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} />
              <TextField label={ui.admin.sizeLabel} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              <TextField label={ui.admin.iso} value={form.isoSize ?? ''} onChange={(e) => setForm({ ...form, isoSize: e.target.value })} />
              <TextField label={ui.admin.passage} inputMode="decimal" value={form.passageMm} onChange={(e) => setForm({ ...form, passageMm: e.target.value })} />
              <TextField label={ui.admin.bristle} inputMode="decimal" value={form.bristleDiameterMm ?? ''} onChange={(e) => setForm({ ...form, bristleDiameterMm: e.target.value })} />
            </div>
            <div className={s.row}>
              <input className={s.colorInput} type="color" aria-label={ui.admin.color} value={form.colorHex} onChange={(e) => setForm({ ...form, colorHex: e.target.value })} />
              <TextField label={`${ui.admin.color}, HEX`} value={form.colorHex} onChange={(e) => setForm({ ...form, colorHex: e.target.value })} />
              <TextField label={ui.admin.order} inputMode="numeric" value={String(form.sortOrder)} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
            </div>
            <ToggleChip pressed={form.verified} onPressedChange={(v) => setForm({ ...form, verified: v })}>
              {ui.admin.verified}
            </ToggleChip>
            <CounterChip>Порядок задаёт клавиши 1–9, 0 при вводе</CounterChip>
          </div>
        )}
      </Dialog>
    </div>
  );
}
