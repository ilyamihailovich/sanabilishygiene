'use client';

import { ui } from '@/content/ui.ru';
import { BrushSizeButton } from '@/ui/brush/BrushSizeButton';
import { ToggleChip } from '@/ui/Chip';
import { Segmented } from '@/ui/Segmented';
import s from './InterspaceForm.module.css';

export type Approach = 'VESTIBULAR' | 'ORAL';
export type Method = 'THROUGH' | 'ANGLED' | 'BOTH';
export type Alternative = 'FLOSS' | 'NONE' | null;

export interface InterspaceValue {
  sizeId: string | null;
  approach: Approach;
  method: Method;
  bleeding: boolean | null;
  pain: boolean;
  openContact: boolean;
  alternative: Alternative;
}

export interface SizeOption {
  id: string;
  label: string;
  meta: string;
  color: string;
  hotkey?: string;
}

interface InterspaceFormProps {
  value: InterspaceValue;
  onChange: (next: InterspaceValue) => void;
  sizes: SizeOption[];
  /** Поповер на десктопе: компактные чипы размеров. Лист на смартфоне: крупные кнопки. */
  density: 'compact' | 'touch';
}

const t = ui.interspace;

export function InterspaceForm({ value, onChange, sizes, density }: InterspaceFormProps) {
  const set = <K extends keyof InterspaceValue>(key: K, v: InterspaceValue[K]) => onChange({ ...value, [key]: v });
  const toggleSize = (id: string) => onChange({ ...value, sizeId: value.sizeId === id ? null : id, alternative: null });

  return (
    <div className={s.form}>
      <div className={s.group} role="group" aria-label={t.size}>
        <span className={s.groupLabel}>{t.size}</span>
        {density === 'touch' ? (
          <div className={s.sizes}>
            {sizes.map((size) => (
              <BrushSizeButton
                key={size.id}
                label={size.label}
                meta={size.meta}
                color={size.color}
                {...(size.hotkey ? { hotkey: size.hotkey } : {})}
                pressed={value.sizeId === size.id}
                onClick={() => toggleSize(size.id)}
              />
            ))}
          </div>
        ) : (
          <div className={s.compactSizes}>
            {sizes.map((size) => (
              <button
                key={size.id}
                type="button"
                aria-pressed={value.sizeId === size.id}
                className={s.dotButton}
                onClick={() => toggleSize(size.id)}
                title={`${size.meta}${size.hotkey ? `, клавиша ${size.hotkey}` : ''}`}
              >
                <span className={s.dot} style={{ background: size.color }} aria-hidden="true" />
                {size.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={s.group}>
        <span className={s.groupLabel}>{t.side}</span>
        <Segmented
          label={t.side}
          block
          value={value.approach}
          onChange={(v) => set('approach', v)}
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
          value={value.method}
          onChange={(v) => set('method', v)}
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
          <ToggleChip pressed={value.bleeding === true} onPressedChange={(p) => set('bleeding', p)}>
            {t.bleeding}
          </ToggleChip>
          <ToggleChip pressed={value.pain} onPressedChange={(p) => set('pain', p)}>
            {t.pain}
          </ToggleChip>
          <ToggleChip pressed={value.openContact} onPressedChange={(p) => set('openContact', p)}>
            {t.openContact}
          </ToggleChip>
        </div>
      </div>

      <div className={s.group} role="group" aria-label={t.alternative}>
        <span className={s.groupLabel}>{t.alternative}</span>
        <div className={s.chips}>
          <ToggleChip
            pressed={value.alternative === 'FLOSS'}
            onPressedChange={(p) => onChange({ ...value, alternative: p ? 'FLOSS' : null, sizeId: p ? null : value.sizeId })}
          >
            {t.floss}
          </ToggleChip>
          <ToggleChip
            pressed={value.alternative === 'NONE'}
            onPressedChange={(p) => onChange({ ...value, alternative: p ? 'NONE' : null, sizeId: p ? null : value.sizeId })}
          >
            {t.notNeeded}
          </ToggleChip>
        </div>
      </div>
    </div>
  );
}
