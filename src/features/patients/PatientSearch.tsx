'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ui } from '@/content/ui.ru';
import { patientTitle } from '@/domain/patient';
import { api } from '@/ui/api';
import { TextField } from '@/ui/Field';
import { Heading } from '@/ui/Heading';
import { IconChevronRight } from '@/ui/icons';
import { formatDate } from '@/ui/format';
import { Num } from '@/ui/Num';
import s from './patients.module.css';

interface Row {
  id: string;
  cardNumber: string;
  displayName: string | null;
  fullName?: string | null;
  lastVisit: string | null;
  visits: number;
}

export function PatientSearch({ initial }: { initial: Row[] }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(initial);

  useEffect(() => {
    if (!q.trim()) {
      setRows(initial);
      return;
    }
    const t = setTimeout(async () => {
      const list = await api.get<Array<{ id: string; cardNumber: string; displayName: string | null; fullName: string | null }>>(
        `/api/v1/patients?card=${encodeURIComponent(q)}`,
      );
      setRows(list.map((p) => ({ ...p, lastVisit: null, visits: -1 })));
    }, 200);
    return () => clearTimeout(t);
  }, [q, initial]);

  return (
    <div className={s.page}>
      <div className={s.head}>
        <Heading as="h1" level="title1">
          {ui.patients.title}
        </Heading>
        <div className={s.search}>
          <TextField label={ui.patients.searchLabel} placeholder={ui.patients.searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
      </div>
      {rows.length ? (
        <ul className={s.list}>
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/patients/${r.id}`} className={s.row}>
                <span className={s.who}>
                  <span className={s.card}>{patientTitle(r) ?? 'Без имени'}</span>
                  <span className={s.number}>{r.cardNumber}</span>
                </span>
                <span className={s.sub}>{r.lastVisit ? <Num>{formatDate(r.lastVisit)}</Num> : ''}</span>
                <span className={s.sub}>{r.visits >= 0 ? `визитов: ${r.visits}` : ''}</span>
                <IconChevronRight size={18} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.empty}>{ui.patients.notFound}. Новый пациент создаётся на главной: «Начать визит».</p>
      )}
    </div>
  );
}
