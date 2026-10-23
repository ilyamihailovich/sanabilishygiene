'use client';

import { useState } from 'react';
import { ui } from '@/content/ui.ru';
import type { MapElement } from '@/domain/brushMap';
import { brushBrand } from '@/domain/brushes';
import type { ElementData } from '@/schemas/brushMap';
import type { CatalogItem } from '@/server/services/catalog';
import { BrushSizeButton } from '@/ui/brush/BrushSizeButton';
import { Button } from '@/ui/Button';
import { ToggleChip } from '@/ui/Chip';
import { Switch } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { IconTrash } from '@/ui/icons';
import s from './InterspaceForm.module.css';

interface ElementFormProps {
  element: MapElement;
  catalog: CatalogItem[];
  hotkeys: Map<string, string>;
  density: 'compact' | 'touch';
  /** Выбранный производитель: запоминается между промежутками, у каждого промежутка его можно сменить. */
  brand: string | null;
  onBrand: (brand: string) => void;
  onPatch: (patch: Partial<ElementData>) => void;
  onRemoveExtra?: () => void;
}

const t = ui.interspace;

/** Цвета для своего размера: не совпадают с цветами каталога, чтобы метки не путались. */
const FREE_COLORS = ['#e7a1c4', '#8e63c2', '#3fa9a6', '#9fc54a', '#c98a3c', '#8b8b90', '#2f2f33'];

export function sizeMeta(c: CatalogItem) {
  return `${brushBrand(c)} · ${c.label}${c.isoSize ? ` · ${c.isoSize}` : ''}${c.verified ? '' : ' · не проверен'}`;
}

/** Производители в порядке каталога. */
export function catalogBrands(catalog: CatalogItem[]) {
  return [...new Set(catalog.map(brushBrand))];
}

/** Ввод данных промежутка: одинаковый для схемы и 3D, поповер на десктопе и лист на смартфоне. */
export function ElementForm({ element, catalog: all, hotkeys, density, brand, onBrand, onPatch, onRemoveExtra }: ElementFormProps) {
  const d = element.data;
  const free = d.size && 'freeText' in d.size ? d.size : null;
  const freeText = free?.freeText ?? '';
  const [showFree, setShowFree] = useState(Boolean(free));
  const [draftColor, setDraftColor] = useState<string | undefined>(free?.color);
  const catalogId = d.size && 'catalogId' in d.size ? d.size.catalogId : null;
  const brands = catalogBrands(all);
  const assigned = catalogId ? all.find((c) => c.id === catalogId) : undefined;
  const [shownBrand, setShownBrand] = useState(assigned ? brushBrand(assigned) : (brand && brands.includes(brand) ? brand : brands[0]));
  const catalog = all.filter((c) => brushBrand(c) === shownBrand);
  const isEdge = element.kind === 'edge';
  const enabled = !isEdge || d.enabled === true;

  const pickSize = (id: string) => {
    setShowFree(false);
    if (shownBrand) onBrand(shownBrand);
    onPatch(catalogId === id ? { size: null } : { size: { catalogId: id }, alternative: null });
  };

  return (
    <div className={s.form}>
      {isEdge && (
        <Switch label={ui.map.edgeEnable} checked={enabled} onCheckedChange={(v) => onPatch({ enabled: v })} />
      )}
      {enabled && (
        <>
          <div className={s.group} role="group" aria-label={t.size}>
            <span className={s.groupLabel}>{t.size}</span>
            {brands.length > 1 && (
              <div className={s.brands} role="radiogroup" aria-label="Производитель">
                {brands.map((b) => (
                  <button
                    key={b}
                    type="button"
                    role="radio"
                    aria-checked={shownBrand === b}
                    className={s.brand}
                    onClick={() => {
                      setShownBrand(b);
                      onBrand(b);
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
            {density === 'touch' ? (
              <div className={s.sizes}>
                {catalog.map((c) => (
                  <BrushSizeButton
                    key={c.id}
                    label={c.label}
                    title={sizeMeta(c)}
                    color={c.colorHex}
                    pressed={catalogId === c.id}
                    onClick={() => pickSize(c.id)}
                  />
                ))}
                <BrushSizeButton
                  label={free?.freeText ?? 'Свой'}
                  color={free ? (free.color ?? null) : (draftColor ?? null)}
                  pressed={showFree}
                  onClick={() => setShowFree((v) => !v)}
                />
              </div>
            ) : (
              <div className={s.compactSizes}>
                {catalog.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={catalogId === c.id}
                    className={s.dotButton}
                    onClick={() => pickSize(c.id)}
                    title={`${sizeMeta(c)}${hotkeys.get(c.id) ? `, клавиша ${hotkeys.get(c.id)}` : ''}`}
                  >
                    <span className={s.dot} style={{ background: c.colorHex }} aria-hidden="true" />
                    {c.label}
                    {hotkeys.get(c.id) && <kbd className={s.kbd}>{hotkeys.get(c.id)}</kbd>}
                  </button>
                ))}
              </div>
            )}
            {showFree ? (
              <div className={s.free}>
              <input
                className={s.freeInput}
                aria-label={ui.map.freeText}
                placeholder={ui.map.freeTextPlaceholder}
                defaultValue={freeText}
                maxLength={40}
                autoFocus={!freeText}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== freeText) onPatch({ size: { freeText: v, ...(draftColor ? { color: draftColor } : {}) }, alternative: null });
                  if (!v && freeText) onPatch({ size: null });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  e.stopPropagation();
                }}
              />
              <div className={s.freeColors} role="radiogroup" aria-label="Цвет своего размера">
                {FREE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={draftColor === color}
                    aria-label={`Цвет ${color}`}
                    className={s.freeColor}
                    style={{ background: color }}
                    onClick={() => {
                      const next = draftColor === color ? undefined : color;
                      setDraftColor(next);
                      if (free) onPatch({ size: { freeText: free.freeText, ...(next ? { color: next } : {}) }, alternative: null });
                    }}
                  />
                ))}
              </div>
              </div>
            ) : density === 'touch' ? null : (
              <button type="button" className={s.linkButton} onClick={() => setShowFree(true)}>
                {ui.map.freeText}
              </button>
            )}
          </div>

          <div className={s.group}>
            <span className={s.groupLabel}>{t.side}</span>
            <Segmented
              label={t.side}
              block
              value={d.approach}
              onChange={(v) => onPatch({ approach: v })}
              options={[
                { value: 'VESTIBULAR', label: t.sideVestibular },
                { value: 'ORAL', label: t.sideOral },
              ]}
            />
          </div>

          <div className={s.group}>
            <span className={s.groupLabel}>{t.method}</span>
            <Segmented
              label={t.method}
              block
              value={d.method}
              onChange={(v) => onPatch({ method: v })}
              options={[
                { value: 'THROUGH', label: t.methodThrough },
                { value: 'ANGLED', label: t.methodAngled },
                { value: 'BOTH', label: t.methodBoth },
              ]}
            />
          </div>

          <div className={s.group} role="group" aria-label={t.marks}>
            <span className={s.groupLabel}>{t.marks}</span>
            <div className={s.chips}>
              <ToggleChip pressed={d.bleeding === true} onPressedChange={(p) => onPatch({ bleeding: p })}>
                {t.bleeding}
              </ToggleChip>
            </div>
          </div>

          <div className={s.group} role="group" aria-label={t.alternative}>
            <span className={s.groupLabel}>{t.alternative}</span>
            <div className={s.chips}>
              <ToggleChip
                pressed={d.alternative === 'FLOSS'}
                onPressedChange={(p) => onPatch(p ? { alternative: 'FLOSS', size: null } : { alternative: null })}
              >
                {t.floss}
              </ToggleChip>
            </div>
          </div>
        </>
      )}
      {onRemoveExtra && (
        <div>
          <Button variant="ghost" size="sm" leading={<IconTrash size={18} />} onClick={onRemoveExtra}>
            {ui.map.removeExtra}
          </Button>
        </div>
      )}
    </div>
  );
}
