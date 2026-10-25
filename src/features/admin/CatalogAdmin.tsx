'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { countLabel } from '@/content/plural';
import { ui } from '@/content/ui.ru';
import { brushBrand, byBrandOrder, formatMm } from '@/domain/brushes';
import type { CatalogItem } from '@/server/services/catalog';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { ToggleChip } from '@/ui/Chip';
import { Dialog } from '@/ui/Dialog';
import { TextField } from '@/ui/Field';
import { Heading } from '@/ui/Heading';
import { IconPlus } from '@/ui/icons';
import { Notice } from '@/ui/Notice';
import { Segmented } from '@/ui/Segmented';
import { useToast } from '@/ui/Toast';
import s from './admin.module.css';

type Form = Omit<CatalogItem, 'id' | 'hasPhoto' | 'archived'> & { id?: string; archived?: boolean };

const ALL = '__all';

/**
 * Каталог ёршиков по маркам: вкладка на каждого производителя, размеры плитками с цветом и проходом.
 * Нажатие на плитку открывает правку; позиции без отметки «проверено» не попадают в документы пациента.
 */
export function CatalogAdmin({ items: initial, brand: initialBrand }: { items: CatalogItem[]; brand?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  // правки видны сразу: список обновляется локально, сервер подтверждает
  const [items, setItems] = useState(initial);
  const brands = useMemo(() => [...new Set(byBrandOrder(items).map(brushBrand))], [items]);
  const [brand, setBrand] = useState<string>(initialBrand && brands.includes(initialBrand) ? initialBrand : (brands[0] ?? ALL));
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const fail = (err: unknown) => toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');

  const shown = byBrandOrder(items).filter((i) => (brand === ALL || brushBrand(i) === brand) && (showArchived || !i.archived));
  const archivedCount = items.filter((i) => i.archived && (brand === ALL || brushBrand(i) === brand)).length;
  const unverified = items.some((i) => !i.verified && !i.archived);

  const blank = (): Form => {
    const sample = items.find((i) => brushBrand(i) === brand);
    return {
      brand: sample?.brand ?? '',
      line: sample?.line ?? '',
      label: '',
      isoSize: null,
      passageMm: '',
      bristleDiameterMm: null,
      colorHex: '#ededed',
      verified: false,
      sortOrder: items.length + 1,
    };
  };

  const save = async () => {
    if (!form) return;
    const body = {
      brand: form.brand.trim(),
      line: form.line.trim(),
      label: form.label.trim() || formatMm(String(form.passageMm).replace(',', '.')),
      isoSize: form.isoSize || null,
      passageMm: Number(String(form.passageMm).replace(',', '.')),
      bristleDiameterMm: form.bristleDiameterMm ? Number(String(form.bristleDiameterMm).replace(',', '.')) : null,
      colorHex: form.colorHex,
      verified: form.verified,
      sortOrder: Number(form.sortOrder) || 0,
    };
    if (!body.brand || !Number.isFinite(body.passageMm) || body.passageMm <= 0) {
      toast('Укажите производителя и проход в миллиметрах', 'error');
      return;
    }
    try {
      const local = { ...body, passageMm: String(body.passageMm), bristleDiameterMm: body.bristleDiameterMm === null ? null : String(body.bristleDiameterMm) };
      if (form.id) {
        await api.patch(`/api/v1/admin/brushes/${form.id}`, body);
        setItems((list) => list.map((i) => (i.id === form.id ? { ...i, ...local } : i)));
      } else {
        const created = await api.post<{ id?: string }>('/api/v1/admin/brushes', body);
        setItems((list) => [...list, { ...local, id: created?.id ?? `new-${Date.now()}`, hasPhoto: false, archived: false }]);
        setBrand(brushBrand(body));
      }
      setForm(null);
      router.refresh();
    } catch (err) {
      fail(err);
    }
  };

  const patch = async (id: string, body: Partial<Pick<CatalogItem, 'verified' | 'archived'>>) => {
    try {
      await api.patch(`/api/v1/admin/brushes/${id}`, body);
      setItems((list) => list.map((i) => (i.id === id ? { ...i, ...body } : i)));
      router.refresh();
    } catch (err) {
      fail(err);
    }
  };

  const upload = async (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post(`/api/v1/admin/brushes/${id}/photo`, fd);
      setItems((list) => list.map((i) => (i.id === id ? { ...i, hasPhoto: true } : i)));
      router.refresh();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <Heading as="h1" level="title1" rest={countLabel(items.filter((i) => !i.archived).length, ['размер', 'размера', 'размеров'])}>
          {ui.admin.catalog}
        </Heading>
        <div className={s.row}>
          {unverified && <Notice>{ui.catalog.notVerified}</Notice>}
          <Button leading={<IconPlus size={18} />} onClick={() => setForm(blank())}>
            Добавить размер
          </Button>
        </div>
      </div>

      <div className={s.brandBar}>
        <Segmented
          label="Производитель"
          value={brand}
          onChange={setBrand}
          options={[...brands.map((b) => ({ value: b, label: b })), { value: ALL, label: 'Все' }]}
        />
        {archivedCount > 0 && (
          <ToggleChip pressed={showArchived} onPressedChange={setShowArchived}>
            Архив · {archivedCount}
          </ToggleChip>
        )}
      </div>

      <p className={s.muted}>
        Размеры и цвета вносит клиника по упаковкам производителя. Размер попадает в документ пациента только с отметкой «{ui.admin.verified}».
      </p>

      <ul className={s.sizeGrid}>
        {shown.map((i) => (
          <li key={i.id}>
            <button type="button" className={s.sizeTile} data-archived={i.archived || undefined} onClick={() => setForm({ ...i })}>
              <span className={s.sizeSwatch} style={{ background: i.colorHex }} />
              <span className={s.sizeMm}>{formatMm(i.passageMm)}</span>
              <span className={s.sizeMeta}>
                {i.isoSize ? (/^iso/i.test(i.isoSize) ? i.isoSize : `ISO ${i.isoSize}`) : 'ISO —'}
                {i.label && !i.label.startsWith(i.passageMm.replace('.', ',')) ? ` · ${i.label}` : ''}
              </span>
              <span className={s.sizeState}>{i.archived ? 'В архиве' : i.verified ? ui.admin.verified : 'Не проверено'}</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={`${s.sizeTile} ${s.sizeAdd}`} onClick={() => setForm(blank())}>
            <IconPlus size={22} />
            <span>Добавить размер</span>
          </button>
        </li>
      </ul>

      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? `${brushBrand(form)} · ${form.passageMm ? formatMm(String(form.passageMm)) : ''}` : 'Новый размер'}
        width={600}
        actions={
          <>
            {form?.id && (
              <Button
                variant="ghost"
                onClick={() => {
                  const id = form.id!;
                  const archived = !form.archived;
                  setForm(null);
                  void patch(id, { archived });
                }}
              >
                {form.archived ? ui.common.restore : 'Убрать в архив'}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setForm(null)}>
              {ui.common.cancel}
            </Button>
            <Button onClick={save}>{ui.common.save}</Button>
          </>
        }
      >
        {form && (
          <div className={s.form}>
            <div className={s.formHead}>
              <input className={s.colorInput} type="color" aria-label={ui.admin.color} value={form.colorHex} onChange={(e) => setForm({ ...form, colorHex: e.target.value })} />
              <div className={s.grid2} style={{ flex: 1 }}>
                <TextField label={ui.admin.brand} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                <TextField label={ui.admin.line} value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} />
              </div>
            </div>
            <div className={s.grid2}>
              <TextField label={ui.admin.passage} inputMode="decimal" value={form.passageMm} onChange={(e) => setForm({ ...form, passageMm: e.target.value })} />
              <TextField label={ui.admin.iso} value={form.isoSize ?? ''} onChange={(e) => setForm({ ...form, isoSize: e.target.value })} />
              <TextField label={ui.admin.bristle} inputMode="decimal" value={form.bristleDiameterMm ?? ''} onChange={(e) => setForm({ ...form, bristleDiameterMm: e.target.value })} />
              <TextField label={`${ui.admin.color}, HEX`} value={form.colorHex} onChange={(e) => setForm({ ...form, colorHex: e.target.value })} />
              <TextField label={ui.admin.sizeLabel} hint="Если пусто — проход в мм" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              <TextField label={ui.admin.order} hint="Клавиши 1–9, 0 при вводе" inputMode="numeric" value={String(form.sortOrder)} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
            </div>
            <div className={s.row}>
              <ToggleChip pressed={form.verified} onPressedChange={(v) => setForm({ ...form, verified: v })}>
                {ui.admin.verified}
              </ToggleChip>
              {form.id && (
                <label className={s.photoPick}>
                  {items.find((i) => i.id === form.id)?.hasPhoto ? 'Заменить фото упаковки' : 'Загрузить фото упаковки'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(form.id!, e.target.files[0])} />
                </label>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
