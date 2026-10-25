'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ui } from '@/content/ui.ru';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { TextField } from '@/ui/Field';
import { IconButton } from '@/ui/IconButton';
import { IconArrowRight } from '@/ui/icons';
import { useToast } from '@/ui/Toast';
import { useCan } from '../shell/StaffContext';
import s from './home.module.css';

interface Patient {
  id: string;
  cardNumber: string;
  displayName: string | null;
  fullName?: string | null;
}

const normalize = (v: string) => v.trim().replace(/\s+/g, ' ').toUpperCase();
const isCard = (v: string) => /^[\d\s-]+$/.test(v.trim()) || /\d/.test(v.trim().split(' ')[0] ?? '');
/** Имя для обращения из «Фамилия Имя Отчество»: второе слово, а если слово одно — оно само. */
const nameFrom = (full: string) => {
  const w = full.trim().split(/\s+/);
  return w.length >= 2 ? w[1]! : (w[0] ?? '');
};
const title = (p: Patient) => p.fullName || p.displayName || 'Имя не указано';

/** Начать визит по фамилии и имени пациента (номер медкарты тоже подходит): найти в подсказках или создать нового. */
export function StartVisitForm() {
  const router = useRouter();
  const toast = useToast();
  const canCreate = useCan('patient.write');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Patient[]>([]);
  const [found, setFound] = useState<Patient | null>(null);
  const [creating, setCreating] = useState(false);
  const [card, setCard] = useState('');
  const [name, setName] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);

  // подсказки по мере ввода: с двух букв или с первой цифры номера
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 && !/\d/.test(q)) return setHits([]);
    const timer = setTimeout(async () => {
      try {
        setHits((await api.get<Patient[]>(`/api/v1/patients?q=${encodeURIComponent(q)}`)).slice(0, 6));
      } catch {
        setHits([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const openCreate = () => {
    const q = query.trim().replace(/\s+/g, ' ');
    if (isCard(q)) {
      setCard(normalize(q));
      setFullName('');
      setName('');
    } else {
      setCard('');
      setFullName(q);
      setName(nameFrom(q));
    }
    setCreating(true);
  };

  const lookup = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const list = await api.get<Patient[]>(`/api/v1/patients?q=${encodeURIComponent(q)}`);
    const exact = list.find((p) => p.cardNumber === normalize(q) || (p.fullName ?? '').toLowerCase() === q.toLowerCase());
    if (exact || list.length === 1) setFound(exact ?? list[0]!);
    else if (list.length > 1) setHits(list.slice(0, 6));
    else openCreate();
  };

  const startVisit = async (patientId: string, copyBrushMap: boolean) => {
    setBusy(true);
    try {
      const visit = await api.post<{ id: string }>(`/api/v1/patients/${patientId}/visits`, { copyBrushMap });
      router.push(`/visits/${visit.id}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const p = await api.post<Patient>('/api/v1/patients', { cardNumber: card, displayName: name, fullName });
      await startVisit(p.id, false);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
      setBusy(false);
    }
  };

  return (
    <>
      <form className={s.searchRow} onSubmit={lookup} role="search">
        <label htmlFor="start-patient" className="visually-hidden">
          {ui.home.patientPlaceholder}
        </label>
        <div className={s.searchBox}>
          <input
            id="start-patient"
            className={s.searchInput}
            placeholder={ui.home.patientPlaceholder}
            autoComplete="off"
            autoCapitalize="words"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            role="combobox"
            aria-expanded={hits.length > 0 || query.trim().length >= 2}
            aria-controls="start-hits"
          />
          {(hits.length > 0 || query.trim().length >= 2) && (
            <ul id="start-hits" className={s.hits} role="listbox">
              {hits.map((p) => (
                <li key={p.id} role="option" aria-selected={false}>
                  <button type="button" className={s.hit} onClick={() => setFound(p)}>
                    <span>{title(p)}</span>
                    <span className={s.hitCard}>{p.cardNumber}</span>
                  </button>
                </li>
              ))}
              {canCreate && (
                <li role="option" aria-selected={false}>
                  <button type="button" className={`${s.hit} ${s.hitNew}`} onClick={openCreate}>
                    <span>Новый пациент{query.trim() && !isCard(query) ? `: ${query.trim()}` : ''}</span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
        <IconButton label={ui.home.find} icon={<IconArrowRight size={20} />} size={52} type="submit" />
      </form>

      <Dialog
        open={found !== null}
        onClose={() => setFound(null)}
        title={found ? title(found) : ''}
        actions={
          <>
            <Button variant="secondary" disabled={busy} onClick={() => found && startVisit(found.id, true)}>
              {ui.patients.copyMap}
            </Button>
            <Button disabled={busy} onClick={() => found && startVisit(found.id, false)}>
              {ui.patients.newVisit}
            </Button>
          </>
        }
      >
        <div className={s.found}>
          <span className={s.card}>Медкарта {found?.cardNumber}</span>
          <a className={s.sub} href={found ? `/patients/${found.id}` : '#'}>
            Открыть карточку пациента
          </a>
        </div>
      </Dialog>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title={ui.patients.create}
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              {ui.common.cancel}
            </Button>
            <Button disabled={busy || !canCreate || !card.trim()} onClick={create}>
              {ui.patients.newVisit}
            </Button>
          </>
        }
      >
        <div className={s.dialogBody}>
          <TextField
            label="Фамилия Имя Отчество"
            value={fullName}
            onChange={(e) => {
              // имя для обращения следует за ФИО, пока его не поправили вручную
              if (name === nameFrom(fullName)) setName(nameFrom(e.target.value));
              setFullName(e.target.value);
            }}
            maxLength={120}
            autoFocus={!fullName}
          />
          <TextField label={ui.patients.displayName} hint={ui.patients.displayNameHint} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <TextField label={ui.patients.cardNumber} value={card} onChange={(e) => setCard(e.target.value)} maxLength={40} autoFocus={Boolean(fullName)} />
        </div>
      </Dialog>
    </>
  );
}
