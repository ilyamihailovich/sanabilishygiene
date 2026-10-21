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
}

/** Порядок размеров каталога для клавиш 1–9, 0 при вводе карты ёршиков. */
export function HotkeyOrder({ items, initial }: { items: Item[]; initial: string[] }) {
  const toast = useToast();
  const ordered = [...initial.map((id) => items.find((i) => i.id === id)).filter((x): x is Item => Boolean(x)), ...items.filter((i) => !initial.includes(i.id))];
  const [list, setList] = useState(ordered);
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
          {list.map((item, i) => (
            <li key={item.id} className={s.keyRow}>
              <kbd className={s.kbd}>{i < 9 ? i + 1 : i === 9 ? 0 : '—'}</kbd>
              <span className={s.dot} style={{ background: item.colorHex }} aria-hidden="true" />
              <span className={s.keyLabel}>{item.label}</span>
              <IconButton label="Выше" icon={<IconChevronUp size={16} />} variant="ghost" size={36} onClick={() => move(i, -1)} />
              <IconButton label="Ниже" icon={<IconChevronDown size={16} />} variant="ghost" size={36} onClick={() => move(i, 1)} />
            </li>
          ))}
        </ol>
        <div>
          <Button onClick={save}>{ui.common.save}</Button>
        </div>
      </div>
    </Card>
  );
}
