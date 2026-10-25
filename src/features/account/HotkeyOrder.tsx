'use client';

import { useState } from 'react';
import { ui } from '@/content/ui.ru';
import { api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Card, CardHeader } from '@/ui/Card';
import { IconButton } from '@/ui/IconButton';
import { IconChevronDown, IconChevronUp } from '@/ui/icons';
import { useToast } from '@/ui/Toast';
import s from './account.module.css';

interface Item {
  id: string;
  label: string;
  colorHex: string;
  /** Производитель: у разных марок бывают одинаковые размеры. */
  brand?: string;
}

/** Порядок размеров каталога для клавиш 1–9, 0 при вводе карты ёршиков. */
export function HotkeyOrder({ items, initial }: { items: Item[]; initial: string[] }) {
  const toast = useToast();
  const ordered = [...initial.map((id) => items.find((i) => i.id === id)).filter((x): x is Item => Boolean(x)), ...items.filter((i) => !initial.includes(i.id))];
  const [list, setList] = useState(ordered);
  // клавиши есть у первых десяти; остальные размеры свёрнуты, чтобы список не растягивал страницу
  const [all, setAll] = useState(false);
  const shown = all ? list : list.slice(0, 10);
  const move = (i: number, d: number) => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setList(next);
  };
  const save = async () => {
    await api.patch('/api/v1/me/prefs', { sizeHotkeys: list.slice(0, 10).map((i) => i.id) });
    toast(ui.common.saved);
  };
  return (
    <Card className={s.card}>
      <div className={s.form}>
        <CardHeader title="Клавиши размеров" />
        <p className={s.muted}>Первые десять размеров получают клавиши 1–9 и 0 при вводе карты ёршиков.</p>
        <ol className={s.keys}>
          {shown.map((item, i) => (
            <li key={item.id} className={s.keyRow}>
              <kbd className={s.kbd}>{i < 9 ? i + 1 : i === 9 ? 0 : '—'}</kbd>
              <span className={s.dot} style={{ background: item.colorHex }} aria-hidden="true" />
              <span className={s.keyLabel}>
                {item.label}
                {item.brand && <span className={s.keyBrand}> · {item.brand}</span>}
              </span>
              <IconButton label="Выше" icon={<IconChevronUp size={16} />} variant="ghost" size={36} onClick={() => move(i, -1)} />
              <IconButton label="Ниже" icon={<IconChevronDown size={16} />} variant="ghost" size={36} onClick={() => move(i, 1)} />
            </li>
          ))}
        </ol>
        <div className={s.keyActions}>
          <Button onClick={save}>{ui.common.save}</Button>
          {list.length > 10 && (
            <Button variant="ghost" onClick={() => setAll((v) => !v)}>
              {all ? 'Свернуть' : `Остальные размеры · ${list.length - 10}`}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
